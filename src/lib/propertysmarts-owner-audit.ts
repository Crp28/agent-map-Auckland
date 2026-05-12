import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { ownersMatch } from "@/lib/owner-name-match";
import { getOwnerAuditAddressRows } from "@/lib/repository";
import type { PersonOwnerAuditResult } from "@/types/location";

const PROPERTYSMARTS_PUBLIC_URL = "https://www.propertysmarts.co.nz/property#";
const PROPERTYSMARTS_APP_URL_PATTERN = /https:\/\/www\.propertysmarts\.co\.nz\/property/i;
const PROPERTYSMARTS_LOGIN_SELECTOR = "#ReinzSSO";
const PROPERTYSMARTS_SEARCH_INPUT_SELECTOR = "#search_text";
const PROPERTYSMARTS_STATE_PATH = path.join(
  process.cwd(),
  "scripts",
  "propertysmarts",
  "state",
  "propertysmarts-auth.json",
);
const PROPERTYSMARTS_BOOTSTRAP_TIMEOUT_MS = 20_000;

type PropertySmartsSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

type SearchSuggestion = {
  id: number;
  type: string;
  name: string;
};

type PropertySearchReference = {
  type: string;
  name: string;
  owners: string[];
};

let activeSession: PropertySmartsSession | null = null;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractHouseNumber(value: string) {
  return value.match(/\b\d+[a-z]?\b/i)?.[0]?.toLowerCase() ?? null;
}

function streetTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !/^\d+[a-z]?$/i.test(token))
    .filter((token) => !["auckland", "new", "zealand"].includes(token));
}

function scoreAddressCandidate(candidateName: string, streetAddress: string, suburb: string) {
  const candidate = normalizeText(candidateName);
  const targetStreet = normalizeText(streetAddress);
  const targetSuburb = normalizeText(suburb);
  const houseNumber = extractHouseNumber(streetAddress);

  if (!candidate) {
    return -1;
  }

  let score = 0;
  if (targetStreet && (candidate.startsWith(targetStreet) || candidate.includes(targetStreet))) {
    score += 6;
  }
  if (targetSuburb && candidate.includes(targetSuburb)) {
    score += 3;
  }
  if (houseNumber && new RegExp(`\\b${escapeRegExp(houseNumber)}\\b`, "i").test(candidate)) {
    score += 2;
  }

  const tokens = streetTokens(streetAddress);
  const matchedTokens = tokens.filter((token) => candidate.includes(token)).length;
  if (matchedTokens > 0) {
    score += Math.min(matchedTokens, 3);
  }

  return score;
}

function pickBestCandidate<T extends { name: string }>(
  candidates: T[],
  streetAddress: string,
  suburb: string,
  minimumScore: number,
) {
  let best: { score: number; item: T } | null = null;

  for (const candidate of candidates) {
    const score = scoreAddressCandidate(candidate.name, streetAddress, suburb);
    if (score < minimumScore) {
      continue;
    }

    if (!best || score > best.score) {
      best = { score, item: candidate };
    }
  }

  return best?.item ?? null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

function extractOwnersFromHtml(html: string) {
  const owners = new Set<string>();
  const ownerLinkPattern = /<a[^>]*class="owner-link"[^>]*>(.*?)<\/a>/gims;
  for (const match of html.matchAll(ownerLinkPattern)) {
    const value = decodeHtml(match[1]?.replace(/<[^>]+>/g, "").trim() ?? "");
    if (value) {
      owners.add(value);
    }
  }

  const ownerLabelPattern = /owners?<\/[^>]+>\s*<[^>]+>(.*?)<\/[^>]+>/gims;
  for (const match of html.matchAll(ownerLabelPattern)) {
    const value = decodeHtml(match[1]?.replace(/<[^>]+>/g, "").trim() ?? "");
    if (value) {
      owners.add(value);
    }
  }

  return [...owners];
}

async function pageRequest(
  page: Page,
  method: "GET" | "POST",
  endpoint: string,
  params: Record<string, string>,
) {
  return page.evaluate(
    async ({ endpoint: innerEndpoint, method: innerMethod, params: innerParams }) => {
      const search = new URLSearchParams(innerParams);
      const response = await fetch(
        innerMethod === "GET" && search.toString()
          ? `${innerEndpoint}?${search.toString()}`
          : innerEndpoint,
        {
          method: innerMethod,
          credentials: "include",
          headers:
            innerMethod === "POST"
              ? {
                  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                  "X-Requested-With": "XMLHttpRequest",
                }
              : undefined,
          body: innerMethod === "POST" ? search.toString() : undefined,
        },
      );

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
      };
    },
    { endpoint, method, params },
  );
}

async function createSession() {
  if (!existsSync(PROPERTYSMARTS_STATE_PATH)) {
    throw new Error(
      `No saved PropertySmarts auth state found at ${PROPERTYSMARTS_STATE_PATH}. Run "cmd /c npm run propertysmarts:login-capture -- --address \\"82 Picnic Point Road\\"" first.`,
    );
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: PROPERTYSMARTS_STATE_PATH });
  const page = await context.newPage();
  await page.goto(PROPERTYSMARTS_PUBLIC_URL, { waitUntil: "domcontentloaded" });

  const loginLink = page.locator(PROPERTYSMARTS_LOGIN_SELECTOR).first();
  if (await loginLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await loginLink.click();
  }

  await page.waitForURL(PROPERTYSMARTS_APP_URL_PATTERN, {
    timeout: PROPERTYSMARTS_BOOTSTRAP_TIMEOUT_MS,
  });
  await page.waitForSelector(PROPERTYSMARTS_SEARCH_INPUT_SELECTOR, {
    timeout: PROPERTYSMARTS_BOOTSTRAP_TIMEOUT_MS,
  });

  return { browser, context, page } satisfies PropertySmartsSession;
}

async function getSession() {
  if (activeSession && !activeSession.page.isClosed()) {
    return activeSession;
  }

  activeSession = await createSession();
  return activeSession;
}

async function showSearch(page: Page, streetAddress: string, suburb: string) {
  const input = page.locator(PROPERTYSMARTS_SEARCH_INPUT_SELECTOR).first();
  await input.fill(`${streetAddress}, ${suburb}`);
  await page.waitForTimeout(150);
}

async function resolvePropertyReference(
  page: Page,
  streetAddress: string,
  suburb: string,
) {
  const roadLookup = await pageRequest(page, "POST", "/search/find_closest", {
    type: "Address",
    search: streetAddress,
  });
  const roadCandidates = roadLookup.ok
    ? (JSON.parse(roadLookup.text) as SearchSuggestion[])
    : [];
  const roadCandidate = pickBestCandidate(roadCandidates, streetAddress, suburb, 3);
  if (!roadCandidate) {
    return null;
  }

  const addressLookup = await pageRequest(page, "POST", "/search/search_address", {
    search: roadCandidate.name,
    roadId: String(roadCandidate.id),
  });
  const addressCandidates = addressLookup.ok
    ? (JSON.parse(addressLookup.text) as SearchSuggestion[])
    : [];
  const addressCandidate = pickBestCandidate(addressCandidates, streetAddress, suburb, 7);
  if (!addressCandidate) {
    return null;
  }

  const propertySearch = await pageRequest(page, "POST", "/property/search", {
    Id: String(addressCandidate.id),
    Type: "0",
  });
  if (!propertySearch.ok) {
    throw new Error(`PropertySmarts search failed with status ${propertySearch.status}.`);
  }

  const ownersFromSearch = extractOwnersFromHtml(propertySearch.text);
  const referenceMatch =
    propertySearch.text.match(/data-type="([^"]+)"[^>]*data-name="([^"]+)"/i) ??
    propertySearch.text.match(/data-name="([^"]+)"[^>]*data-type="([^"]+)"/i);
  if (!referenceMatch) {
    return {
      type: "valuation",
      name: "",
      owners: ownersFromSearch,
    } satisfies PropertySearchReference;
  }

  const reference =
    propertySearch.text.indexOf('data-type="') <= propertySearch.text.indexOf('data-name="')
      ? {
          type: referenceMatch[1] ?? "",
          name: referenceMatch[2] ?? "",
        }
      : {
          type: referenceMatch[2] ?? "",
          name: referenceMatch[1] ?? "",
        };

  return {
    ...reference,
    owners: ownersFromSearch,
  } satisfies PropertySearchReference;
}

async function fetchPropertyOwners(page: Page, reference: PropertySearchReference) {
  if (!reference.name || !reference.type) {
    return reference.owners;
  }

  const itemInfo = await pageRequest(page, "GET", "/property/item_info", {
    Type: reference.type,
    Name: reference.name,
  });
  const owners = new Set(reference.owners);
  if (itemInfo.ok) {
    for (const owner of extractOwnersFromHtml(itemInfo.text)) {
      owners.add(owner);
    }
  }

  return [...owners];
}

function buildResult(
  row: ReturnType<typeof getOwnerAuditAddressRows>[number],
  status: PersonOwnerAuditResult["status"],
  propertySmartsOwners: string[] = [],
  matchedOwner: string | null = null,
) {
  return {
    personId: row.person_id,
    addressId: row.address_id,
    streetAddress: row.street_address,
    suburb: row.suburb,
    status,
    propertySmartsOwners,
    matchedOwner,
  } satisfies PersonOwnerAuditResult;
}

export async function auditPersonAddressOwners(addressIds: number[]) {
  const rows = getOwnerAuditAddressRows(addressIds);
  if (rows.length === 0) {
    return [] as PersonOwnerAuditResult[];
  }

  let session: PropertySmartsSession;
  try {
    session = await getSession();
  } catch (error) {
    const status: PersonOwnerAuditResult["status"] =
      error instanceof Error && /auth state|waitForURL|selector|PropertySmarts/i.test(error.message)
        ? "auth_expired"
        : "unverified";
    return rows.map((row) => buildResult(row, status));
  }

  const results: PersonOwnerAuditResult[] = [];
  for (const row of rows) {
    try {
      await showSearch(session.page, row.street_address, row.suburb);
      const reference = await resolvePropertyReference(session.page, row.street_address, row.suburb);
      if (!reference) {
        results.push(buildResult(row, "not_found"));
        continue;
      }

      const propertySmartsOwners = await fetchPropertyOwners(session.page, reference);
      if (propertySmartsOwners.length === 0) {
        results.push(buildResult(row, "unverified"));
        continue;
      }

      const dbOwnerNames = [row.name, row.preferred_name ?? ""].filter(Boolean);
      const matchedOwner =
        propertySmartsOwners.find((candidate) => ownersMatch(candidate, dbOwnerNames)) ?? null;
      results.push(
        buildResult(
          row,
          matchedOwner ? "match" : "mismatch",
          propertySmartsOwners,
          matchedOwner,
        ),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (/ERR_ABORTED/i.test(error.message) ||
          /Target page, context or browser has been closed/i.test(error.message))
      ) {
        results.push(buildResult(row, "auth_expired"));
        await closePropertySmartsOwnerAuditSession();
        break;
      }

      results.push(buildResult(row, "unverified"));
    }
  }

  return results;
}

export async function closePropertySmartsOwnerAuditSession() {
  if (!activeSession) {
    return;
  }

  try {
    await activeSession.context.close();
  } finally {
    try {
      await activeSession.browser.close();
    } finally {
      activeSession = null;
    }
  }
}
