import { getArgValue, getFlag } from "./lib/args";
import { PROPERTYSMARTS_STATE_PATH } from "./lib/constants";
import {
  captureSearchFlow,
  extractOwnerCandidatesFromCapture,
  extractOwnerFromDom,
  launchPropertySmartsContext,
  openPropertySmarts,
  waitForManualLoginAndSave,
  writeCapture,
} from "./lib/propertysmarts";

async function main() {
  const address = getArgValue("--address");
  const skipLogin = getFlag("--skip-login");
  const headless = getFlag("--headless");

  const { browser, context, page } = await launchPropertySmartsContext({
    headless,
    storageStatePath: PROPERTYSMARTS_STATE_PATH,
  });

  try {
    await openPropertySmarts(page);

    if (!skipLogin) {
      await waitForManualLoginAndSave(context, page);
      await openPropertySmarts(page);
    }

    const entries = await captureSearchFlow(page, address);
    const outputPath = writeCapture(entries, address);
    const domOwners = await extractOwnerFromDom(page);
    const networkOwners = extractOwnerCandidatesFromCapture(entries);

    console.log(JSON.stringify({
      outputPath,
      capturedRequests: entries.length,
      domOwners,
      networkOwners,
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
