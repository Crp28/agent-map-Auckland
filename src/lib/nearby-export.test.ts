import type { PersonRecord, SoldPropertyRecord } from "@/types/location";
import { describe, expect, it } from "vitest";
import {
  firstNameFromFullName,
  nearbyPersonAddress,
  nearbyPeopleForCsv,
  nearbyPeopleCsv,
  nearbyPeopleExportFilename,
} from "./nearby-export";

const basePerson: PersonRecord = {
  id: 1,
  personKey: "ana-buyer",
  name: "Ana Buyer",
  preferredName: null,
  addressId: 10,
  streetAddress: "1 Queen Street",
  suburb: "Auckland Central",
  phone: "021 000 000",
  email: "ana@example.com",
  purchasingPowerMin: null,
  purchasingPowerMax: null,
  latitude: -36.8,
  longitude: 174.7,
  addresses: [],
  notes: [],
  lastUpdatedAt: "2026-04-16T00:00:00.000Z",
  createdAt: "2026-04-16T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

const baseProperty: SoldPropertyRecord = {
  id: 2,
  streetAddress: "12A Example Road / Unit 3",
  suburb: "Highland Park",
  lastSoldDate: "2026-01-01",
  soldPrice: 1000000,
  latitude: -36.9,
  longitude: 174.9,
  createdAt: "2026-04-16T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

describe("firstNameFromFullName", () => {
  it("uses the first given-name token", () => {
    expect(firstNameFromFullName("Ana Maria Buyer")).toBe("Ana");
  });

  it("handles comma-separated names", () => {
    expect(firstNameFromFullName("Buyer, Ana Maria")).toBe("Ana");
  });
});

describe("nearbyPeopleCsv", () => {
  it("combines street address and suburb for the address column", () => {
    expect(nearbyPersonAddress(basePerson)).toBe("1 Queen Street, Auckland Central");
  });

  it("exports first names, mobile phone numbers, and addresses", () => {
    const csv = nearbyPeopleCsv([
      basePerson,
      {
        ...basePerson,
        id: 2,
        name: "Bob Buyer",
        phone: "021,111",
        streetAddress: "2 Test Lane, Unit 4",
      },
    ]);

    expect(csv).toBe(
      'First Name,Mobile Phone,Address\r\nAna,021 000 000,"1 Queen Street, Auckland Central"\r\nBob,"021,111","2 Test Lane, Unit 4, Auckland Central"',
    );
  });

  it("keeps one row per person and groups exported rows by suburb", () => {
    const remueraPerson = {
      ...basePerson,
      id: 3,
      name: "Rita Remuera",
      streetAddress: "8 Remuera Road",
      suburb: "Remuera",
    };
    const csvPeople = nearbyPeopleForCsv([
      remueraPerson,
      {
        ...basePerson,
        id: 2,
        name: "Harry Howick",
        streetAddress: "4 Howick Road",
        suburb: "Howick",
      },
      {
        ...basePerson,
        id: remueraPerson.id,
        addressId: 99,
        streetAddress: "9 Duplicate Lane",
        suburb: "Howick",
      },
      {
        ...basePerson,
        id: 4,
        name: "Helen Howick",
        streetAddress: "5 Howick Road",
        suburb: "Howick",
      },
    ]);

    expect(csvPeople.map((person) => person.name)).toEqual([
      "Harry Howick",
      "Helen Howick",
      "Rita Remuera",
    ]);
    expect(csvPeople.map((person) => person.streetAddress)).not.toContain("9 Duplicate Lane");
  });
});

describe("nearbyPeopleExportFilename", () => {
  it("builds a sanitized filename from the selected address and selected suburb filters", () => {
    expect(nearbyPeopleExportFilename(baseProperty, ["Highland Park"])).toBe(
      "12A_Example_Road_Unit_3_Highland_Park.csv",
    );
    expect(nearbyPeopleExportFilename(baseProperty, ["Highland Park", "Howick"])).toBe(
      "12A_Example_Road_Unit_3_2_suburbs.csv",
    );
  });
});
