import { describe, expect, it } from "vitest";

import {
  normalizePreferredFirstName,
  personOwnerNames,
  preferredDisplayName,
} from "./person-name";

describe("person name helpers", () => {
  it("normalizes preferred names down to the first token", () => {
    expect(normalizePreferredFirstName("Russell Li")).toBe("Russell");
    expect(normalizePreferredFirstName("  Ana   Maria ")).toBe("Ana");
    expect(normalizePreferredFirstName("")).toBeNull();
  });

  it("builds a display name by replacing the legal first name only", () => {
    expect(preferredDisplayName("Zishu Li", "Russell")).toBe("Russell Li");
    expect(preferredDisplayName("Ana Maria Buyer", "Annie")).toBe("Annie Maria Buyer");
    expect(preferredDisplayName("Prince", "Symbol")).toBe("Symbol");
  });

  it("builds owner comparison names from legal and preferred-first variants", () => {
    expect(personOwnerNames({ name: "Zishu Li", preferredName: "Russell" })).toEqual([
      "Zishu Li",
      "Russell Li",
    ]);
  });
});
