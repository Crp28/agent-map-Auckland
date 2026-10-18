import { describe, expect, it } from "vitest";
import {
  interactionInputSchema,
  nearbySchema,
  personInputSchema,
  personUpdateInputSchema,
  searchSchema,
  soldPropertyInputSchema,
} from "./validation";

describe("personInputSchema", () => {
  it("accepts boolean Allow SMS in legacy and multi-address payloads", () => {
    const person = { name: "Ana Buyer", phone: "021 000 000", allowSms: false };
    expect(personInputSchema.parse(person).allowSms).toBe(false);
    expect(personInputSchema.parse({ ...person, addresses: [], allowSms: true }).allowSms).toBe(true);
    for (const allowSms of ["false", 0, null]) {
      expect(personInputSchema.safeParse({ ...person, allowSms }).success).toBe(false);
    }
  });

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
    if (result.success) {
      expect(result.data.notes).toEqual([]);
    }
  });

  it("accepts people without addresses", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "",
      purchasingPowerMin: "",
      purchasingPowerMax: "",
      addresses: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addresses).toEqual([]);
    }
  });

  it("parses person notes with valid types", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      notes: [
        {
          type: "General Note",
          content: "Met at open home",
        },
      ],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toHaveLength(1);
      expect(result.data.notes[0]?.type).toBe("General Note");
    }
  });

  it("rejects notes with unsupported types", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      notes: [
        {
          type: "Random",
          content: "Met at open home",
        },
      ],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: "",
          longitude: "",
        },
      ],
    });

    expect(result.success).toBe(false);
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

  it("rejects duplicate addresses that use equivalent suburb abbreviations", () => {
    const result = personInputSchema.safeParse({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      addresses: [
        {
          streetAddress: "1 Valley Road",
          suburb: "Mt Eden",
          latitude: "",
          longitude: "",
        },
        {
          streetAddress: "1  Valley Road",
          suburb: "Mount Eden",
          latitude: "",
          longitude: "",
        },
      ],
    });

    expect(result.success).toBe(false);
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

describe("personUpdateInputSchema", () => {
  it("distinguishes omitted addresses/notes from an explicit empty list", () => {
    const fields = { name: "Note Edit", phone: "021 123 9900" };
    expect(personUpdateInputSchema.parse(fields)).toMatchObject({ addresses: undefined, notes: undefined });
    expect(personUpdateInputSchema.parse({ ...fields, addresses: [], notes: [] })).toMatchObject({ addresses: [], notes: [] });
    expect(personInputSchema.parse(fields)).toMatchObject({ addresses: [], notes: [] });
  });

  it("still validates legacy addresses and rejects duplicate update addresses", () => {
    const fields = { name: "Note Edit", phone: "021 123 9900" };
    const address = { streetAddress: "10 Test Road", suburb: "Howick", latitude: null, longitude: null };
    expect(personUpdateInputSchema.parse({ ...fields, ...address }).addresses).toEqual([address]);
    expect(personUpdateInputSchema.safeParse({ ...fields, addresses: [address, address] }).success).toBe(false);
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
  it("parses optional distance and selected suburbs", () => {
    const result = nearbySchema.parse({
      propertyId: "1",
      distanceKm: "",
      suburbs: [" Remuera ", "Mt Eden"],
    });

    expect(result.distanceKm).toBeNull();
    expect(result.suburbs).toEqual(["Remuera", "Mt Eden"]);
  });
});

describe("searchSchema", () => {
  it("defaults scoped search to people", () => {
    const result = searchSchema.parse({ q: "smith" });

    expect(result.scope).toBe("people");
  });

  it("accepts properties search scope", () => {
    const result = searchSchema.parse({ q: "queen", scope: "properties" });

    expect(result.scope).toBe("properties");
  });
});

describe("interactionInputSchema", () => {
  it("accepts an interaction without a property", () => {
    const result = interactionInputSchema.parse({
      personId: 1,
      propertyId: "",
      interactionType: "enquiry",
      interactionDate: "2026-07-01",
    });

    expect(result.propertyId).toBeNull();
  });

  it("rejects unknown interaction types", () => {
    const result = interactionInputSchema.safeParse({
      personId: 1,
      propertyId: null,
      interactionType: "phone_call",
      interactionDate: "2026-07-01",
    });

    expect(result.success).toBe(false);
  });
});
