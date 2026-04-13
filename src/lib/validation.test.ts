import { describe, expect, it } from "vitest";
import { nearbySchema, personInputSchema, soldPropertyInputSchema } from "./validation";

describe("personInputSchema", () => {
  it("rejects invalid email addresses", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      phone: "021 000 000",
      email: "not-an-email",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires purchasing power min to be below max", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: "1200000",
      purchasingPowerMax: "900000",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("soldPropertyInputSchema", () => {
  it("requires coordinate fallbacks to be supplied as a pair", () => {
    const result = soldPropertyInputSchema.safeParse({
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      lastSoldDate: "2026-01-01",
      soldPrice: "1000000",
      latitude: "-36.8485",
      longitude: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("nearbySchema", () => {
  it("parses sameSuburb=false as false", () => {
    const result = nearbySchema.parse({
      propertyId: "1",
      distanceKm: "2",
      sameSuburb: "false",
    });

    expect(result.sameSuburb).toBe(false);
  });
});
