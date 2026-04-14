import { describe, expect, it } from "vitest";
import { distanceKm, matchesNearbyFilter, purchasingPowerIncludesPrice } from "./distance";

describe("distanceKm", () => {
  it("calculates nearby Auckland coordinates", () => {
    const distance = distanceKm(
      { latitude: -36.8485, longitude: 174.7633 },
      { latitude: -36.8587, longitude: 174.7588 },
    );

    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
  });
});

describe("purchasingPowerIncludesPrice", () => {
  it("includes blank ranges", () => {
    expect(purchasingPowerIncludesPrice(null, null, 1200000)).toBe(true);
  });

  it("includes prices inside min and max", () => {
    expect(purchasingPowerIncludesPrice(900000, 1300000, 1200000)).toBe(true);
  });

  it("excludes prices outside min and max", () => {
    expect(purchasingPowerIncludesPrice(900000, 1300000, 1500000)).toBe(false);
  });
});

describe("matchesNearbyFilter", () => {
  it("uses distance only when sameSuburb is off", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        sameSuburb: false,
        personSuburb: "Auckland",
        propertySuburb: "Glenfield",
      }),
    ).toBe(true);
  });

  it("requires both distance and suburb match when sameSuburb is on", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        sameSuburb: true,
        personSuburb: "Auckland",
        propertySuburb: "Glenfield",
      }),
    ).toBe(false);
  });

  it("still excludes far same-suburb people when sameSuburb is on", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 1.1,
        maxDistanceKm: 1,
        sameSuburb: true,
        personSuburb: "Glenfield",
        propertySuburb: "Glenfield",
      }),
    ).toBe(false);
  });
});
