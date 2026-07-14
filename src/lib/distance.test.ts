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
  it("uses distance only when no suburb filter is selected", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        allowedSuburbs: [],
        personSuburb: "Auckland",
      }),
    ).toBe(true);
  });

  it("ignores distance when no distance limit is supplied", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 20,
        maxDistanceKm: null,
        allowedSuburbs: ["Auckland"],
        personSuburb: "Auckland",
      }),
    ).toBe(true);
  });

  it("requires both distance and a selected suburb match when suburb filters are selected", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        allowedSuburbs: ["Glenfield"],
        personSuburb: "Auckland",
      }),
    ).toBe(false);
  });

  it("still excludes far people in a selected suburb", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 1.1,
        maxDistanceKm: 1,
        allowedSuburbs: ["Glenfield"],
        personSuburb: "Glenfield",
      }),
    ).toBe(false);
  });

  it("treats common suburb abbreviations as the same suburb", () => {
    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        allowedSuburbs: ["Mount Eden"],
        personSuburb: "Mt. Eden",
      }),
    ).toBe(true);

    expect(
      matchesNearbyFilter({
        distanceKm: 0.6,
        maxDistanceKm: 1,
        allowedSuburbs: ["Saint Heliers"],
        personSuburb: "St Heliers",
      }),
    ).toBe(true);
  });
});
