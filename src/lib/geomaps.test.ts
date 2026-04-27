import { describe, expect, it } from "vitest";
import { pickBestGeocodeCandidate } from "./geomaps";

describe("pickBestGeocodeCandidate", () => {
  it("rejects substring house-number collisions", () => {
    const match = pickBestGeocodeCandidate(
      [
        {
          fullNumber: "171",
          fullAddress: "171 QUEEN STREET AUCKLAND CENTRAL AUCKLAND 1010",
          latitude: -36.85,
          longitude: 174.76,
        },
      ],
      "1 Queen Street",
      "Auckland Central",
    );

    expect(match).toBeNull();
  });

  it("accepts the exact address prefix match", () => {
    const match = pickBestGeocodeCandidate(
      [
        {
          fullNumber: "1",
          fullAddress: "1 QUEEN STREET AUCKLAND CENTRAL AUCKLAND 1010",
          latitude: -36.84,
          longitude: 174.76,
        },
        {
          fullNumber: "171",
          fullAddress: "171 QUEEN STREET AUCKLAND CENTRAL AUCKLAND 1010",
          latitude: -36.85,
          longitude: 174.77,
        },
      ],
      "1 Queen Street",
      "Auckland Central",
    );

    expect(match).toMatchObject({
      latitude: -36.84,
      longitude: 174.76,
      matchedAddress: "1 QUEEN STREET AUCKLAND CENTRAL AUCKLAND 1010",
    });
  });

  it("accepts unit-prefixed service addresses for the same base number", () => {
    const match = pickBestGeocodeCandidate(
      [
        {
          fullNumber: "1/171",
          fullAddress: "1/171 QUEEN STREET AUCKLAND CENTRAL AUCKLAND 1010",
          latitude: -36.84,
          longitude: 174.76,
        },
      ],
      "171 Queen Street",
      "Auckland Central",
    );

    expect(match).not.toBeNull();
    expect(match?.matchedAddress).toContain("1/171 QUEEN STREET");
  });
});
