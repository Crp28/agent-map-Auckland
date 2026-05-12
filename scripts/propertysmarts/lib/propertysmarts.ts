import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium, type BrowserContext, type Page } from "playwright";

import {
  PROPERTYSMARTS_CAPTURE_BODY_LIMIT,
  PROPERTYSMARTS_OUTPUT_DIR,
  PROPERTYSMARTS_OWNER_LABEL_PATTERNS,
  PROPERTYSMARTS_OWNER_SELECTORS,
  PROPERTYSMARTS_RESULT_SELECTORS,
  PROPERTYSMARTS_SEARCH_INPUT_SELECTORS,
  PROPERTYSMARTS_SEARCH_SUBMIT_SELECTORS,
  PROPERTYSMARTS_STATE_PATH,
  PROPERTYSMARTS_URL,
} from "./constants";

export type CapturedRequest = {
  timestamp: string;
  url: string;
  method: string;
  resourceType: string;
  status: number | null;
  requestHeaders: Record<string, string>;
  postData: string | null;
  responseHeaders: Record<string, string> | null;
  responseBodyPreview: string | null;
};

export async function launchPropertySmartsContext(options?: {
  headless?: boolean;
  storageStatePath?: string;
}) {
  const browser = await chromium.launch({ headless: options?.headless ?? false });
  const storageStatePath = options?.storageStatePath ?? PROPERTYSMARTS_STATE_PATH;
  const context = await browser.newContext(
    existsSync(storageStatePath)
      ? {
          storageState: storageStatePath,
        }
      : undefined,
  );
  const page = await context.newPage();
  return { browser, context, page };
}

export async function openPropertySmarts(page: Page) {
  await page.goto(PROPERTYSMARTS_URL, { waitUntil: "domcontentloaded" });
}

export async function prompt(question: string) {
  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

export async function waitForManualLoginAndSave(context: BrowserContext, page: Page) {
  await openPropertySmarts(page);
  await prompt(
    `Log into PropertySmarts in the opened browser. When you can see the authenticated PropertySmarts app, press Enter here to save auth state to ${PROPERTYSMARTS_STATE_PATH}.`,
  );
  mkdirSync(path.dirname(PROPERTYSMARTS_STATE_PATH), { recursive: true });
  await context.storageState({ path: PROPERTYSMARTS_STATE_PATH });
}

export function startNetworkCapture(page: Page) {
  const captured: CapturedRequest[] = [];

  const onResponse = async (response: import("playwright").Response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!["xhr", "fetch"].includes(resourceType)) {
      return;
    }

    let responseBodyPreview: string | null = null;
    try {
      const body = await response.text();
      responseBodyPreview = body.slice(0, PROPERTYSMARTS_CAPTURE_BODY_LIMIT);
    } catch {
      responseBodyPreview = null;
    }

    captured.push({
      timestamp: new Date().toISOString(),
      url: response.url(),
      method: request.method(),
      resourceType,
      status: response.status(),
      requestHeaders: await request.allHeaders(),
      postData: request.postData(),
      responseHeaders: await response.allHeaders(),
      responseBodyPreview,
    });
  };

  page.on("response", onResponse);

  return {
    stop() {
      page.off("response", onResponse);
      return captured;
    },
  };
}

export function writeCapture(entries: CapturedRequest[], address?: string) {
  mkdirSync(PROPERTYSMARTS_OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeAddress = (address ?? "manual").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const outputPath = path.join(PROPERTYSMARTS_OUTPUT_DIR, `${timestamp}-${safeAddress || "manual"}-capture.json`);
  writeFileSync(outputPath, JSON.stringify(entries, null, 2));
  return outputPath;
}

async function firstVisibleLocator(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 750 })) {
        return locator;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function searchPropertyByAddress(page: Page, address: string) {
  const searchInput = await firstVisibleLocator(page, PROPERTYSMARTS_SEARCH_INPUT_SELECTORS);
  if (!searchInput) {
    return false;
  }

  await searchInput.fill(address);
  const submitButton = await firstVisibleLocator(page, PROPERTYSMARTS_SEARCH_SUBMIT_SELECTORS);
  if (submitButton) {
    await submitButton.click();
  } else {
    await searchInput.press("Enter");
  }

  await page.waitForTimeout(2500);

  const resultLink = await firstVisibleLocator(page, PROPERTYSMARTS_RESULT_SELECTORS);
  if (resultLink) {
    await resultLink.click();
    await page.waitForTimeout(2500);
  }

  return true;
}

export async function captureSearchFlow(page: Page, address?: string) {
  const capture = startNetworkCapture(page);
  if (address) {
    const automated = await searchPropertyByAddress(page, address);
    if (!automated) {
      await prompt(
        `Automated search input was not detected. In the opened browser, manually search for "${address}" and open the property details, then press Enter here to finish capture.`,
      );
    }
  } else {
    await prompt("In the opened browser, manually perform one property search and open the property details, then press Enter here to finish capture.");
  }

  await page.waitForTimeout(1000);
  return capture.stop();
}

export async function extractOwnerFromDom(page: Page) {
  for (const selector of PROPERTYSMARTS_OWNER_SELECTORS) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 250 })) {
        const text = (await locator.textContent())?.trim();
        if (text) {
          return [text];
        }
      }
    } catch {
      continue;
    }
  }

  return page.evaluate((patternsSource) => {
    const patterns = patternsSource.map((source) => new RegExp(source, "i"));
    const candidates = new Set<string>();

    for (const element of Array.from(document.querySelectorAll("body *"))) {
      const text = element.textContent?.trim();
      if (!text) {
        continue;
      }

      if (!patterns.some((pattern) => pattern.test(text))) {
        continue;
      }

      const siblingText =
        element.nextElementSibling?.textContent?.trim() ??
        element.parentElement?.lastElementChild?.textContent?.trim() ??
        "";

      if (siblingText && siblingText !== text) {
        candidates.add(siblingText);
      }
    }

    return [...candidates];
  }, PROPERTYSMARTS_OWNER_LABEL_PATTERNS.map((pattern) => pattern.source));
}

function extractOwnerStringsFromValue(value: unknown, keyHint?: string, bucket?: Set<string>) {
  const owners = bucket ?? new Set<string>();

  if (typeof value === "string") {
    if (keyHint && /owner/i.test(keyHint) && value.trim()) {
      owners.add(value.trim());
    }
    return owners;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractOwnerStringsFromValue(item, keyHint, owners);
    }
    return owners;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      extractOwnerStringsFromValue(nested, key, owners);
    }
  }

  return owners;
}

export function extractOwnerCandidatesFromCapture(entries: CapturedRequest[]) {
  const owners = new Set<string>();

  for (const entry of entries) {
    if (!entry.responseBodyPreview) {
      continue;
    }

    try {
      const parsed = JSON.parse(entry.responseBodyPreview) as unknown;
      for (const owner of extractOwnerStringsFromValue(parsed)) {
        owners.add(owner);
      }
    } catch {
      continue;
    }
  }

  return [...owners];
}
