import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RepositoryModule = typeof import("./repository");

let repository: RepositoryModule;
let databaseDir: string;

async function loadRepository() {
  vi.resetModules();
  (globalThis as typeof globalThis & {
    locationFinderSqlite?: unknown;
    locationFinderDrizzle?: unknown;
  }).locationFinderSqlite = undefined;
  (globalThis as typeof globalThis & {
    locationFinderSqlite?: unknown;
    locationFinderDrizzle?: unknown;
  }).locationFinderDrizzle = undefined;
  repository = await import("./repository");
}

beforeEach(async () => {
  databaseDir = mkdtempSync(path.join(tmpdir(), "locationfinder-repo-"));
  process.env.DATABASE_PATH = path.join(databaseDir, "locationfinder.db");
  await loadRepository();
});

afterEach(() => {
  const globalWithDb = globalThis as typeof globalThis & {
    locationFinderSqlite?: { close?: () => void };
    locationFinderDrizzle?: unknown;
  };
  globalWithDb.locationFinderSqlite?.close?.();
  globalWithDb.locationFinderSqlite = undefined;
  globalWithDb.locationFinderDrizzle = undefined;
  delete process.env.DATABASE_PATH;
  rmSync(databaseDir, { recursive: true, force: true });
});

describe("multi-address repository behavior", () => {
  it("preserves address ids when an address street or suburb is edited", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: null,
          longitude: null,
        },
      ],
    }, { geocode: false });

    expect(created).not.toBeNull();
    const originalAddressId = created?.addresses[0]?.id;
    expect(originalAddressId).toBeTypeOf("number");

    const updated = await repository.updatePersonById(created!.id, {
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          id: originalAddressId,
          streetAddress: "9 Albert Street",
          suburb: "Auckland Central",
          latitude: -36.8485,
          longitude: 174.7633,
        },
      ],
    }, originalAddressId);

    expect(updated?.addresses).toHaveLength(1);
    expect(updated?.addresses[0]?.id).toBe(originalAddressId);
    expect(updated?.streetAddress).toBe("9 Albert Street");
  });

  it("returns the requested selected address after updating a secondary address", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Michael Boulgaris",
      phone: "021 111 111",
      email: "michael@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "192 Remuera Road",
          suburb: "Remuera",
          latitude: -36.8761,
          longitude: 174.7875,
        },
        {
          streetAddress: "197 Charles Road",
          suburb: "Karaka",
          latitude: -37.1291,
          longitude: 174.8617,
        },
      ],
    }, { geocode: false });

    const secondAddress = created?.addresses.find((address) => address.streetAddress === "197 Charles Road");
    expect(secondAddress).toBeDefined();

    const updated = await repository.updatePersonById(created!.id, {
      name: "Michael Boulgaris",
      phone: "021 111 111",
      email: "michael@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "192 Remuera Road",
          suburb: "Remuera",
          latitude: -36.8761,
          longitude: 174.7875,
        },
        {
          id: secondAddress!.id,
          streetAddress: "199 Charles Road",
          suburb: "Karaka",
          latitude: -37.1291,
          longitude: 174.8617,
        },
      ],
    }, secondAddress!.id);

    expect(updated?.addressId).toBe(secondAddress!.id);
    expect(updated?.streetAddress).toBe("199 Charles Road");
    expect(updated?.suburb).toBe("Karaka");
  });

  it("uses the stored primary address snapshot when listing a multi-address person", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: null,
          longitude: null,
        },
        {
          streetAddress: "2 High Street",
          suburb: "Auckland Central",
          latitude: null,
          longitude: null,
        },
      ],
    }, { geocode: false });

    const remapped = await repository.updatePersonById(created!.id, {
      name: "Ana Buyer",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          id: created!.addresses[1]!.id,
          streetAddress: "2 High Street",
          suburb: "Auckland Central",
          latitude: -36.848,
          longitude: 174.764,
        },
        {
          id: created!.addresses[0]!.id,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    });

    expect(remapped?.streetAddress).toBe("2 High Street");

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.streetAddress).toBe("2 High Street");
  });

  it("treats timed out geocode audits as unverified instead of throwing", async () => {
    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress: vi.fn(async () => {
          throw new DOMException("This operation was aborted", "AbortError");
        }),
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Timeout Case",
      phone: "021 999 9999",
      email: "timeout@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    }, { geocode: false });

    const result = await repository.auditPersonAddressCoordinates([created!.addresses[0]!.id]);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("unverified");
  });

  it("retries timed out geocode audits before giving up", async () => {
    const geocodeAddress = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("This operation was aborted", "AbortError"))
      .mockRejectedValueOnce(new DOMException("This operation was aborted", "AbortError"))
      .mockResolvedValueOnce({
        latitude: -36.847,
        longitude: 174.763,
        matchedAddress: "1 Queen Street Auckland Central",
      });

    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress,
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Retry Case",
      phone: "021 777 7777",
      email: "retry@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    }, { geocode: false });

    const result = await repository.auditPersonAddressCoordinates([created!.addresses[0]!.id]);

    expect(geocodeAddress).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("ok");
  });
});
