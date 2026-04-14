import { describe, expect, it } from "vitest";
import { AUCKLAND_SUBURBS } from "./auckland-suburbs";

describe("AUCKLAND_SUBURBS", () => {
  it("stores a valid hard-coded center for every sidebar suburb", () => {
    for (const suburb of AUCKLAND_SUBURBS) {
      expect(suburb.center[0], `${suburb.name} longitude`).toBeGreaterThan(174);
      expect(suburb.center[0], `${suburb.name} longitude`).toBeLessThan(176);
      expect(suburb.center[1], `${suburb.name} latitude`).toBeGreaterThan(-38);
      expect(suburb.center[1], `${suburb.name} latitude`).toBeLessThan(-35);
    }
  });

  it("keeps Highland Park aligned with the default map center", () => {
    const highlandPark = AUCKLAND_SUBURBS.find((suburb) => suburb.name === "Highland Park");

    expect(highlandPark?.center).toEqual([174.90934999723996, -36.89934423319057]);
  });
});
