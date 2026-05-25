import { describe, expect, it } from "vitest";

import { isStrictFirstLastSubsetMatch, normalizeOwnerName, ownerNameVariants, ownersMatch } from "./normalize-owner";

describe("normalizeOwnerName", () => {
  it("normalizes punctuation, spacing, and ampersands", () => {
    expect(normalizeOwnerName("John & Jane, Smith")).toBe("john and jane smith");
  });
});

describe("ownerNameVariants", () => {
  it("adds a reversed variant for comma-separated names", () => {
    expect(ownerNameVariants("Smith, John")).toContain("john smith");
  });
});

describe("ownersMatch", () => {
  it("matches normalized owner names against db names", () => {
    expect(ownersMatch("Smith, John", ["John Smith"])).toBe(true);
  });
});

describe("isStrictFirstLastSubsetMatch", () => {
  it("matches when the DB legal name is first and last only", () => {
    expect(isStrictFirstLastSubsetMatch("John Michael Smith", "John Smith")).toBe(true);
  });

  it("does not match when the DB name already includes middle names", () => {
    expect(isStrictFirstLastSubsetMatch("John Michael Smith", "John Michael Smith")).toBe(false);
  });

  it("does not match when first or last name differs", () => {
    expect(isStrictFirstLastSubsetMatch("John Michael Smith", "Jack Smith")).toBe(false);
    expect(isStrictFirstLastSubsetMatch("John Michael Smith", "John Smythe")).toBe(false);
  });
});
