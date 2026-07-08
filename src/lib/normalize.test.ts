import { describe, expect, it } from "vitest";
import { normalizeSuburbKey, suburbsEqual } from "./normalize";

describe("normalizeSuburbKey", () => {
  it("expands common suburb abbreviations without changing partial words", () => {
    expect(normalizeSuburbKey(" Mt. Wellington ")).toBe("mount wellington");
    expect(normalizeSuburbKey("Pt Chevalier")).toBe("point chevalier");
    expect(normalizeSuburbKey("Unsworth Hts")).toBe("unsworth heights");
    expect(normalizeSuburbKey("St Lukes")).toBe("saint lukes");
    expect(normalizeSuburbKey("Stonefields")).toBe("stonefields");
  });

  it("compares expanded and unabbreviated suburb names equally", () => {
    expect(suburbsEqual("Browns Bch", "Browns Beach")).toBe(true);
    expect(suburbsEqual("Wairau Vly", "Wairau Valley")).toBe(true);
    expect(suburbsEqual("Northcote", "Northcote Point")).toBe(false);
  });
});
