import { describe, expect, it } from "vitest";

import {
  buildAddressSearchVariants,
  expandStreetSuffixAbbreviations,
  scoreAddressCandidate,
} from "./propertysmarts-owner-audit";

describe("PropertySmarts owner audit address normalization", () => {
  it("expands common street suffix abbreviations", () => {
    expect(expandStreetSuffixAbbreviations("40 Ridge Rd")).toBe("40 Ridge Road");
    expect(expandStreetSuffixAbbreviations("12 Example St")).toBe("12 Example Street");
    expect(expandStreetSuffixAbbreviations("3 Sample Ave")).toBe("3 Sample Avenue");
  });

  it("tries the raw address first and then one expanded variant", () => {
    expect(buildAddressSearchVariants("40 Ridge Rd")).toEqual([
      "40 Ridge Rd",
      "40 Ridge Road",
    ]);
  });

  it("scores an expanded PropertySmarts result as a confident match", () => {
    expect(scoreAddressCandidate("40 Ridge Road, Howick, Auckland", "40 Ridge Rd", "Howick")).toBeGreaterThanOrEqual(7);
  });
});
