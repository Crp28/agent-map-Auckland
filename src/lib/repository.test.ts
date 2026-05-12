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
  it("reuses the same person when the legal name changes but contact and address stay the same", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Russell Li",
      preferredName: "",
      phone: "027 364 2139",
      email: "li.zishu@outlook.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "82 Picnic Point Road",
          suburb: "Hobsonville",
          latitude: -36.8063,
          longitude: 174.6641,
        },
      ],
    }, { geocode: false });

    const updated = await repository.createOrUpdatePerson({
      name: "Zishu Li",
      preferredName: "Russell Li",
      phone: "027 364 2139",
      email: "li.zishu@outlook.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      addresses: [
        {
          streetAddress: "82 Picnic Point Road",
          suburb: "Hobsonville",
          latitude: -36.8063,
          longitude: 174.6641,
        },
      ],
    }, { geocode: false });

    expect(updated?.id).toBe(created?.id);
    expect(updated?.name).toBe("Zishu Li");
    expect(updated?.preferredName).toBe("Russell Li");

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Zishu Li");
    expect(listed[0]?.preferredName).toBe("Russell Li");
  });

  it("preserves address ids when an address street or suburb is edited", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
      preferredName: "",
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
