import type { PersonRecord } from "@/types/location";
import { describe, expect, it } from "vitest";

import { resolveSelectedPerson } from "./person-selection";

function makePerson(overrides: Partial<PersonRecord>): PersonRecord {
  return {
    id: 1,
    personKey: "person-key",
    name: "Michael Boulgaris",
    addressId: 10,
    streetAddress: "192 Remuera Road",
    suburb: "Remuera",
    phone: "",
    email: "michael@example.com",
    purchasingPowerMin: null,
    purchasingPowerMax: null,
    latitude: -36.8761,
    longitude: 174.7875,
    addresses: [],
    lastUpdatedAt: "2026-04-28T00:00:00.000Z",
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveSelectedPerson", () => {
  it("prefers an exact address match over the shared person id", () => {
    const remuera = makePerson({ addressId: 5764, streetAddress: "192 Remuera Road", suburb: "Remuera" });
    const karaka = makePerson({
      addressId: 5765,
      streetAddress: "197 Charles Road",
      suburb: "Karaka",
      latitude: -37.1291,
      longitude: 174.8617,
    });

    const result = resolveSelectedPerson([remuera, karaka], 1, 5765);

    expect(result?.addressId).toBe(5765);
    expect(result?.streetAddress).toBe("197 Charles Road");
  });

  it("falls back to the person id when a marker has no address id", () => {
    const remuera = makePerson({ id: 2, addressId: 5764 });

    const result = resolveSelectedPerson([remuera], 2);

    expect(result).toBe(remuera);
  });
});
