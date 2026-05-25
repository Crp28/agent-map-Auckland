import { existsSync } from "node:fs";

import { getArgValue, getFlag } from "./lib/args";
import { findOwnersByAddress } from "./lib/db";
import { PROPERTYSMARTS_PROFILE_DIR } from "./lib/constants";
import { personOwnerNames, preferredDisplayName } from "../../src/lib/person-name";
import { isStrictFirstLastSubsetMatch, normalizeOwnerName, ownersMatch } from "./lib/normalize-owner";
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

  if (!existsSync(PROPERTYSMARTS_PROFILE_DIR)) {
    throw new Error(
      `No saved PropertySmarts Playwright profile found at ${PROPERTYSMARTS_PROFILE_DIR}. Run "cmd /c npm run propertysmarts:login-capture -- --address \\"${address}\\""` +
        " first and complete the manual login in the Playwright browser.",
    );
  }

  const { context, page } = await launchPropertySmartsContext({
    headless,
  });

  try {
    await openPropertySmarts(page);
    const entries = await captureSearchFlow(page, manual ? undefined : address);
    const domOwners = await extractOwnerFromDom(page);
    const networkOwners = extractOwnerCandidatesFromCapture(entries);
    const propertySmartsOwners = [...new Set([...domOwners, ...networkOwners])];
    const dbOwnerNames = dbOwners.flatMap((owner) =>
      personOwnerNames({
        name: owner.name,
        preferredName: owner.preferredName,
      }),
    );

    const matchedOwner = propertySmartsOwners.find((candidate) => ownersMatch(candidate, dbOwnerNames)) ?? null;
    const incompleteNameMatchedOwner =
      matchedOwner
        ? null
        : propertySmartsOwners.find((candidate) =>
            dbOwners.some((owner) => isStrictFirstLastSubsetMatch(candidate, owner.name)),
          ) ?? null;

    console.log(JSON.stringify({
      address,
      suburb: suburb ?? null,
      status:
        propertySmartsOwners.length === 0
          ? "OWNER_NOT_FOUND"
          : matchedOwner
            ? "MATCH"
            : incompleteNameMatchedOwner
              ? "INCOMPLETE_NAME_MATCH"
            : "MISMATCH",
      matchedOwner: matchedOwner ?? incompleteNameMatchedOwner,
      propertySmartsOwners: propertySmartsOwners.map((owner) => ({
        raw: owner,
        normalized: normalizeOwnerName(owner),
      })),
      dbOwners: dbOwners.map((owner) => ({
        name: owner.name,
        preferredName: owner.preferredName,
        normalized: normalizeOwnerName(owner.name),
        preferredDisplayName: owner.preferredName ? preferredDisplayName(owner.name, owner.preferredName) : null,
        normalizedPreferredDisplayName:
          owner.preferredName ? normalizeOwnerName(preferredDisplayName(owner.name, owner.preferredName)) : null,
        streetAddress: owner.streetAddress,
        suburb: owner.suburb,
        personId: owner.personId,
        addressId: owner.addressId,
      })),
    }, null, 2));
  } finally {
    await context.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
