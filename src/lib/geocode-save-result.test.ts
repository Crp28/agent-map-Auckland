import { describe, expect, it } from "vitest";

import { identifyPersonGeocodeFailures, identifySoldPropertyGeocodeFailure } from "./geocode-save-result";

describe("identifyPersonGeocodeFailures", () => {
  it("returns unresolved saved addresses that were submitted without manual coordinates", () => {
    const failures = identifyPersonGeocodeFailures(
      {
        name: "Ana Buyer",
        preferredName: "",
        phone: "021 000 000",
        email: "ana@example.com",
        purchasingPowerMin: null,
        purchasingPowerMax: null,
        notes: [],
        addresses: [
          {
            streetAddress: "40 Ridge Rd",
            suburb: "Howick",
            latitude: null,
            longitude: null,
          },
          {
            streetAddress: "1 Queen Street",
            suburb: "Auckland Central",
            latitude: -36.847,
            longitude: 174.763,
          },
        ],
      },
      {
        id: 12,
        personKey: "key",
        name: "Ana Buyer",
        preferredName: null,
        addressId: 2,
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        phone: "021 000 000",
        email: "ana@example.com",
        purchasingPowerMin: null,
        purchasingPowerMax: null,
        latitude: null,
        longitude: null,
        notes: [],
        addresses: [
          {
            id: 2,
            personId: 12,
            identityKey: "a",
            streetAddress: "40 Ridge Rd",
            suburb: "Howick",
            latitude: null,
            longitude: null,
            createdAt: "",
            updatedAt: "",
          },
          {
            id: 3,
            personId: 12,
            identityKey: "b",
            streetAddress: "1 Queen Street",
            suburb: "Auckland Central",
            latitude: -36.847,
            longitude: 174.763,
            createdAt: "",
            updatedAt: "",
          },
        ],
        lastUpdatedAt: "",
        createdAt: "",
        updatedAt: "",
      },
    );

    expect(failures).toEqual([
      {
        addressId: 2,
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
      },
    ]);
  });
});

describe("identifySoldPropertyGeocodeFailure", () => {
  it("returns null when manual coordinates were supplied", () => {
    const failure = identifySoldPropertyGeocodeFailure(
      {
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        lastSoldDate: "2026-06-01",
        soldPrice: 1000000,
        latitude: -36.9,
        longitude: 174.9,
      },
      {
        id: 1,
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        lastSoldDate: "2026-06-01",
        soldPrice: 1000000,
        latitude: null,
        longitude: null,
        createdAt: "",
        updatedAt: "",
      },
    );

    expect(failure).toBeNull();
  });

  it("returns the unresolved property when geocoding still failed", () => {
    const failure = identifySoldPropertyGeocodeFailure(
      {
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        lastSoldDate: "2026-06-01",
        soldPrice: 1000000,
        latitude: null,
        longitude: null,
      },
      {
        id: 1,
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        lastSoldDate: "2026-06-01",
        soldPrice: 1000000,
        latitude: null,
        longitude: null,
        createdAt: "",
        updatedAt: "",
      },
    );

    expect(failure).toEqual({
      addressId: 1,
      streetAddress: "40 Ridge Rd",
      suburb: "Howick",
    });
  });
});
