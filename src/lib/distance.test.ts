import { describe, expect, it } from "vitest";
import { distanceKm, purchasingPowerIncludesPrice } from "./distance";

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
