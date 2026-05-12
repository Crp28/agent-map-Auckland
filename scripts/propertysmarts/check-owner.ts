import { existsSync } from "node:fs";

import { getArgValue, getFlag } from "./lib/args";
import { findOwnersByAddress } from "./lib/db";
import { PROPERTYSMARTS_STATE_PATH } from "./lib/constants";
import { normalizeOwnerName, ownersMatch } from "./lib/normalize-owner";
import {
  captureSearchFlow,
  extractOwnerCandidatesFromCapture,
  extractOwnerFromDom,
  launchPropertySmartsContext,
  openPropertySmarts,
} from "./lib/propertysmarts";

async function main() {
  const address = getArgValue("--address");
  const suburb = getArgValue("--suburb");
  const headless = getFlag("--headless");
  const manual = getFlag("--manual");

  if (!address) {
    throw new Error("Pass --address \"<street address>\".");
  }

  const dbOwners = findOwnersByAddress(address, suburb);
  if (dbOwners.length === 0) {
    console.log(JSON.stringify({
      address,
      suburb: suburb ?? null,
      status: "DB_NOT_FOUND",
      dbOwners: [],
      propertySmartsOwners: [],
    }, null, 2));
    return;
  }

  if (!existsSync(PROPERTYSMARTS_STATE_PATH)) {
    throw new Error(
      `No saved PropertySmarts auth state found at ${PROPERTYSMARTS_STATE_PATH}. Run "cmd /c npm run propertysmarts:login-capture -- --address \\"${address}\\""` +
        " first and complete the manual login in the Playwright browser.",
    );
  }

  const { browser, context, page } = await launchPropertySmartsContext({
    headless,
    storageStatePath: PROPERTYSMARTS_STATE_PATH,
  });

  try {
    await openPropertySmarts(page);
    const entries = await captureSearchFlow(page, manual ? undefined : address);
    const domOwners = await extractOwnerFromDom(page);
    const networkOwners = extractOwnerCandidatesFromCapture(entries);
    const propertySmartsOwners = [...new Set([...domOwners, ...networkOwners])];
    const dbOwnerNames = dbOwners.map((owner) => owner.name);

    const matchedOwner = propertySmartsOwners.find((candidate) => ownersMatch(candidate, dbOwnerNames)) ?? null;

    console.log(JSON.stringify({
      address,
      suburb: suburb ?? null,
      status:
        propertySmartsOwners.length === 0
          ? "OWNER_NOT_FOUND"
          : matchedOwner
            ? "MATCH"
            : "MISMATCH",
      matchedOwner,
      propertySmartsOwners: propertySmartsOwners.map((owner) => ({
        raw: owner,
        normalized: normalizeOwnerName(owner),
      })),
      dbOwners: dbOwners.map((owner) => ({
        name: owner.name,
        normalized: normalizeOwnerName(owner.name),
        streetAddress: owner.streetAddress,
        suburb: owner.suburb,
        personId: owner.personId,
        addressId: owner.addressId,
      })),
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
