import { describe, expect, it } from "vitest";
import { nearbySchema, personInputSchema, soldPropertyInputSchema } from "./validation";

describe("personInputSchema", () => {
  it("parses multiple addresses for one person", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
        {
          streetAddress: "2 High Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate addresses", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.addresses).toContain("Duplicate addresses are not allowed");
    }
  });

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

  it("accepts missing email addresses", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      phone: "021 000 000",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("");
    }
  });

  it("accepts missing phone numbers when email is present", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      email: "ana@example.com",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("");
    }
  });

  it("requires at least one contact method", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toContain("Enter phone or email");
    }
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

  it("still accepts legacy single-address payloads", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      streetAddress: "1 Queen Street",
      suburb: "Auckland Central",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      latitude: "",
      longitude: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addresses).toHaveLength(1);
      expect(result.data.addresses[0]?.streetAddress).toBe("1 Queen Street");
    }
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
