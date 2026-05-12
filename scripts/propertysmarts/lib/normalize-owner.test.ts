import { describe, expect, it } from "vitest";

import { normalizeOwnerName, ownerNameVariants, ownersMatch } from "./normalize-owner";

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
