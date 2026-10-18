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
  vi.doUnmock("./geomaps");
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
  it("preserves addresses and skips Google prompts for a note-only PATCH", async () => {
    const { personInputSchema } = await import("./validation");
    const fields = { name: "Note Edit Regression", phone: "021 123 9900" };
    const person = await repository.createOrUpdatePerson(personInputSchema.parse({
      ...fields,
      addresses: [
        { streetAddress: "10 Test Road", suburb: "Howick", latitude: -36.9, longitude: 174.9 },
        { streetAddress: "20 Unmapped Road", suburb: "Howick", latitude: null, longitude: null },
      ],
    }), { geocode: false });
    const { PATCH } = await import("../app/api/people/route");
    const response = await PATCH(new Request("http://localhost/api/people", {
      method: "PATCH",
      body: JSON.stringify({ id: person!.id, ...fields, notes: [{ type: "General Note", content: "Added a note" }] }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.person.addresses).toEqual(person!.addresses);
    expect(payload.person.notes[0].content).toBe("Added a note");
    expect(payload.geocodeFailures).toEqual([]);
  });

  it("persists one geocode result consistently when editing an address", async () => {
    const geocodeAddress = vi.fn()
      .mockResolvedValueOnce({ latitude: -36.85, longitude: 174.75, matchedAddress: "20 Corrected Road" })
      .mockResolvedValue(null);
    vi.doMock("./geomaps", async () => ({ ...await vi.importActual("./geomaps"), geocodeAddress }));
    await loadRepository();
    const { personInputSchema } = await import("./validation");
    const input = personInputSchema.parse({ name: "One Geocode", phone: "021 123 9901", addresses: [
      { streetAddress: "10 Original Road", suburb: "Howick", latitude: -36.9, longitude: 174.9 },
    ] });
    const created = await repository.createOrUpdatePerson(input, { geocode: false });
    const updated = await repository.updatePersonById(created!.id, { ...input, addresses: [{
      ...input.addresses[0]!, id: created!.addresses[0]!.id, streetAddress: "20 Corrected Road",
    }] });
    expect(geocodeAddress).toHaveBeenCalledTimes(1);
    expect(updated?.addresses[0]).toMatchObject({ latitude: -36.85, longitude: 174.75 });
    expect((await repository.listPropertyRecords())[0]).toMatchObject({ latitude: -36.85, longitude: 174.75 });
  });

  it("keeps repaired address coordinates across a restart with an older parent snapshot", async () => {
    const { personInputSchema } = await import("./validation");
    const input = personInputSchema.parse({ name: "Coordinate Repair", phone: "021 123 9902", addresses: [
      { streetAddress: "10 Repair Road", suburb: "Howick", latitude: null, longitude: null },
    ] });
    const created = await repository.createOrUpdatePerson(input, { geocode: false });
    const { getRawDb } = await import("@/db/client");
    const db = getRawDb();
    db.prepare("UPDATE people_addresses SET latitude = ?, longitude = ? WHERE id = ?")
      .run(-36.85, 174.75, created!.addresses[0]!.id);
    db.close();
    await loadRepository();
    const updated = (await repository.listPeopleRecords())[0];
    expect(updated?.addresses[0]).toMatchObject({ id: created!.addresses[0]!.id, latitude: -36.85, longitude: 174.75 });
  });

  it("preserves Google-supplied coordinates through a name edit and restart", async () => {
    const { personInputSchema } = await import("./validation");
    const input = personInputSchema.parse({ name: "Fallback Regression", phone: "021 123 9903", notes: [
      { type: "General Note", content: "Keep this note" },
    ], addresses: [
      { streetAddress: "10 Fallback Road", suburb: "Howick", latitude: null, longitude: null },
    ] });
    const created = await repository.createOrUpdatePerson(input, { geocode: false });
    await repository.updatePersonById(created!.id, { ...input, addresses: [{
      ...input.addresses[0]!, id: created!.addresses[0]!.id, latitude: -36.85, longitude: 174.75,
    }] });
    const { addresses, notes, ...fields } = input;
    await repository.updatePersonById(created!.id, { ...fields, name: "Fallback Renamed" });
    const { getRawDb } = await import("@/db/client");
    getRawDb().close();
    await loadRepository();
    const updated = (await repository.listPeopleRecords())[0];
    expect(updated?.addresses).toHaveLength(addresses.length);
    expect(updated?.addresses[0]).toMatchObject({ id: created!.addresses[0]!.id, latitude: -36.85, longitude: 174.75 });
    expect(updated?.addresses[0]?.identityKey).toContain("fallback renamed");
    expect(updated?.notes[0]?.content).toBe(notes[0]!.content);
    expect((await repository.listPropertyRecords())[0]).toMatchObject({ latitude: -36.85, longitude: 174.75 });
    expect((await repository.listContactPropertyRelations(created!.id))[0]?.relationshipType).toBe("owner");
  });

  it("defaults Allow SMS to true and preserves opt-outs across edits and upserts", async () => {
    const { personInputSchema } = await import("./validation");
    const input = personInputSchema.parse({ name: "SMS Preference", phone: "021 000 999", addresses: [] });
    const created = await repository.createOrUpdatePerson(input, { geocode: false });
    expect(created?.allowSms).toBe(true);

    const optedOut = await repository.updatePersonById(created!.id, { ...input, allowSms: false });
    expect(optedOut?.allowSms).toBe(false);
    const edited = await repository.updatePersonById(created!.id, {
      ...input,
      notes: [{ type: "General Note", content: "Preference should stay saved" }],
    });
    expect(edited?.allowSms).toBe(false);
    expect((await repository.createOrUpdatePerson(input, { geocode: false }))?.allowSms).toBe(false);
    expect((await repository.listPeopleRecords())[0]?.allowSms).toBe(false);
    expect((await repository.updatePersonById(created!.id, { ...input, allowSms: true }))?.allowSms).toBe(true);
    expect((await repository.createOrUpdatePerson({ ...input, allowSms: false }, { geocode: false }))?.allowSms).toBe(false);
  });

  it("migrates existing People to Allow SMS true", async () => {
    const { personInputSchema } = await import("./validation");
    const input = personInputSchema.parse({ name: "Legacy SMS Preference", phone: "021 000 998", addresses: [] });
    const created = await repository.createOrUpdatePerson(input, { geocode: false });
    const { getRawDb } = await import("@/db/client");
    const rawDb = getRawDb();
    rawDb.exec("ALTER TABLE people DROP COLUMN allow_sms");
    rawDb.close();
    await loadRepository();

    expect((await repository.listPeopleRecords()).find((person) => person.id === created!.id)?.allowSms).toBe(true);
  });

  it("creates and lists a person without addresses", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Addressless Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [],
    }, { geocode: false });

    expect(created?.addressId).toBeNull();
    expect(created?.streetAddress).toBe("");
    expect(created?.suburb).toBe("");
    expect(created?.latitude).toBeNull();
    expect(created?.longitude).toBeNull();
    expect(created?.addresses).toEqual([]);

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Addressless Buyer");
    expect(listed[0]?.addresses).toEqual([]);
  });

  it("preserves a person when their final address row is deleted", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Address Optional",
      preferredName: "",
      phone: "021 000 001",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    }, { geocode: false });

    const result = await repository.deletePersonAddressRows([created!.addresses[0]!.id]);
    expect(result.deletedAddressIds).toEqual([created!.addresses[0]!.id]);
    expect(result.deletedPersonIds).toEqual([]);

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created?.id);
    expect(listed[0]?.addressId).toBeNull();
    expect(listed[0]?.addresses).toEqual([]);
  });

  it("stores and updates person-level notes independently from addresses", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [
        { type: "General Note", content: "First note" },
        { type: "Inspection", content: "Viewed on Sunday" },
      ],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    }, { geocode: false });

    expect(created?.notes).toHaveLength(2);
    expect(created?.notes[0]?.type).toBe("General Note");

    const updated = await repository.updatePersonById(created!.id, {
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [
        {
          id: created!.notes[0]!.id,
          type: "Living",
          content: "Now owner occupied",
        },
      ],
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    });

    expect(updated?.notes).toHaveLength(1);
    expect(updated?.notes[0]?.type).toBe("Living");
    expect(updated?.notes[0]?.content).toBe("Now owner occupied");
  }, 15000);

  it("updates notes without re-geocoding unchanged addresses and reuses property coordinates", async () => {
    const geocodeAddress = vi.fn(async () => ({
      latitude: -36.847,
      longitude: 174.763,
      matchedAddress: "1 Queen Street Auckland Central",
    }));

    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress,
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: null,
          longitude: null,
        },
      ],
    }, { geocode: false });

    expect(created?.notes).toEqual([]);

    const { getRawDb } = await import("@/db/client");
    getRawDb()
      .prepare("UPDATE properties SET latitude = ?, longitude = ?")
      .run(-36.847, 174.763);

    const updated = await repository.updatePersonById(created!.id, {
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [
        {
          type: "General Note",
          content: "Met at open home",
        },
      ],
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: null,
          longitude: null,
        },
      ],
    });

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(updated?.notes).toHaveLength(1);
    expect(updated?.notes[0]?.content).toBe("Met at open home");
    expect(updated?.addresses[0]?.latitude).toBe(-36.847);
    expect(updated?.addresses[0]?.longitude).toBe(174.763);
  });

  it("reuses the same person when the legal name changes but contact and address stay the same", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Russell Li",
      preferredName: "",
      phone: "027 364 2139",
      email: "li.zishu@outlook.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
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
      preferredName: "Russell",
      phone: "027 364 2139",
      email: "li.zishu@outlook.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
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
    expect(updated?.preferredName).toBe("Russell");

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Zishu Li");
    expect(listed[0]?.preferredName).toBe("Russell");
  });

  it("preserves address ids when an address street or suburb is edited", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
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
      notes: [],
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

  it("re-geocodes when an address text changes but the payload still carries the old coordinates", async () => {
    const geocodeAddress = vi.fn<(streetAddress: string, suburb: string) => Promise<{ latitude: number; longitude: number; matchedAddress: string }>>(async (streetAddress) => ({
      latitude: streetAddress === "9 Albert Street" ? -36.8485 : -36.847,
      longitude: streetAddress === "9 Albert Street" ? 174.7633 : 174.763,
      matchedAddress: streetAddress,
    }));

    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress,
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    }, { geocode: false });

    const updated = await repository.updatePersonById(created!.id, {
      name: "Ana Buyer",
      preferredName: "",
      phone: "021 000 000",
      email: "ana@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "9 Albert Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
      ],
    });

    expect(geocodeAddress).toHaveBeenCalled();
    expect(geocodeAddress.mock.calls.every((call) => call[0] === "9 Albert Street" && call[1] === "Auckland Central")).toBe(true);
    expect(updated?.streetAddress).toBe("9 Albert Street");
    expect(updated?.latitude).toBe(-36.8485);
    expect(updated?.longitude).toBe(174.7633);
  });

  it("returns the requested selected address after updating a secondary address", async () => {
    const geocodeAddress = vi.fn(async (streetAddress: string) => ({
      latitude: streetAddress === "199 Charles Road" ? -37.1295 : -36.8761,
      longitude: streetAddress === "199 Charles Road" ? 174.8619 : 174.7875,
      matchedAddress: streetAddress,
    }));

    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress,
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Michael Boulgaris",
      preferredName: "",
      phone: "021 111 111",
      email: "michael@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
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
      notes: [],
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
      notes: [],
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
      notes: [],
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
      notes: [],
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
      notes: [],
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

  it("deletes one mismatched address row without deleting the whole person", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Multi Address",
      preferredName: "",
      phone: "021 333 3333",
      email: "multi@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
        {
          streetAddress: "2 High Street",
          suburb: "Auckland Central",
          latitude: -36.848,
          longitude: 174.764,
        },
      ],
    }, { geocode: false });

    const secondAddressId = created?.addresses[1]?.id;
    expect(secondAddressId).toBeTypeOf("number");

    const deleted = await repository.deletePersonAddressRows([secondAddressId!]);
    expect(deleted.deletedAddressIds).toEqual([secondAddressId]);
    expect(deleted.deletedPersonIds).toEqual([]);

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.addresses).toHaveLength(1);
    expect(listed[0]?.addresses[0]?.streetAddress).toBe("1 Queen Street");
  });

  it("materializes people addresses as properties and owner relations", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Property Owner",
      preferredName: "",
      phone: "021 555 5555",
      email: "owner@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "10 Test Road",
          suburb: "Remuera",
          latitude: -36.87,
          longitude: 174.78,
        },
      ],
    }, { geocode: false });

    const properties = await repository.listPropertyRecords();
    expect(properties).toHaveLength(1);
    expect(properties[0]?.streetAddress).toBe("10 Test Road");
    expect(properties[0]?.suburb).toBe("Remuera");

    const relations = await repository.listContactPropertyRelations(created!.id);
    expect(relations).toHaveLength(1);
    expect(relations[0]?.relationshipType).toBe("owner");
    expect(relations[0]?.propertyId).toBe(properties[0]?.id);
  });

  it("marks deleted person addresses as former owner relations", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Two Homes",
      preferredName: "",
      phone: "021 666 6666",
      email: "two@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "11 Test Road",
          suburb: "Remuera",
          latitude: -36.871,
          longitude: 174.781,
        },
        {
          streetAddress: "12 Test Road",
          suburb: "Remuera",
          latitude: -36.872,
          longitude: 174.782,
        },
      ],
    }, { geocode: false });

    expect(await repository.listContactPropertyRelations(created!.id)).toHaveLength(2);

    await repository.deletePersonAddressRows([created!.addresses[0]!.id]);

    const relations = await repository.listContactPropertyRelations(created!.id);
    const properties = await repository.listPropertyRecords();
    const relationByAddress = new Map(
      relations.map((relation) => [
        properties.find((property) => property.id === relation.propertyId)?.streetAddress,
        relation.relationshipType,
      ]),
    );
    expect(relationByAddress.get("11 Test Road")).toBe("former_owner");
    expect(relationByAddress.get("12 Test Road")).toBe("owner");
  });

  it("updates the canonical property in place when a person address is edited", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Address Change",
      preferredName: "",
      phone: "021 666 7777",
      email: "change@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "14 Old Road",
          suburb: "Remuera",
          latitude: -36.873,
          longitude: 174.783,
        },
      ],
    }, { geocode: false });
    const originalProperty = (await repository.listPropertyRecords())[0]!;

    await repository.updatePersonById(created!.id, {
      name: "Address Change",
      preferredName: "",
      phone: "021 666 7777",
      email: "change@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "15 New Road",
          suburb: "Remuera",
          latitude: -36.874,
          longitude: 174.784,
        },
      ],
    });

    const relations = await repository.listContactPropertyRelations(created!.id);
    const properties = await repository.listPropertyRecords();

    expect(properties).toHaveLength(1);
    expect(properties[0]?.id).toBe(originalProperty.id);
    expect(properties[0]?.streetAddress).toBe("15 New Road");
    expect(properties[0]?.latitude).toBe(-36.874);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toEqual(
      expect.objectContaining({
        propertyId: originalProperty.id,
        relationshipType: "owner",
      }),
    );
  });

  it("propagates a person address edit to matching sold property source rows", async () => {
    await repository.createOrUpdateSoldProperty({
      streetAddress: "17 Shared Road",
      suburb: "Remuera",
      lastSoldDate: "2026-05-01",
      soldPrice: 1230000,
      latitude: -36.873,
      longitude: 174.783,
    });
    const created = await repository.createOrUpdatePerson({
      name: "Shared Address Change",
      preferredName: "",
      phone: "021 666 7788",
      email: "shared-change@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "17 Shared Road",
          suburb: "Remuera",
          latitude: -36.873,
          longitude: 174.783,
        },
      ],
    }, { geocode: false });
    const originalProperty = (await repository.listPropertyRecords())[0]!;

    await repository.updatePersonById(created!.id, {
      name: "Shared Address Change",
      preferredName: "",
      phone: "021 666 7788",
      email: "shared-change@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          id: created!.addresses[0]!.id,
          streetAddress: "18 Shared Road",
          suburb: "Remuera",
          latitude: -36.874,
          longitude: 174.784,
        },
      ],
    });

    const [soldProperty] = await repository.listSoldPropertyRecords();
    const [property] = await repository.listPropertyRecords();
    expect(property?.id).toBe(originalProperty.id);
    expect(property?.streetAddress).toBe("18 Shared Road");
    expect(soldProperty?.streetAddress).toBe("18 Shared Road");
    expect(soldProperty?.latitude).toBe(-36.874);
  });

  it("removes relations and interactions when a person is deleted", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Cascade Delete",
      preferredName: "",
      phone: "021 777 8888",
      email: "cascade@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "16 Cascade Road",
          suburb: "Howick",
          latitude: -36.875,
          longitude: 174.785,
        },
      ],
    }, { geocode: false });
    const property = (await repository.listPropertyRecords())[0];
    expect(property).toBeDefined();
    await repository.createInteraction({
      personId: created!.id,
      propertyId: property!.id,
      interactionType: "enquiry",
      interactionDate: "2026-06-23",
    });

    expect(await repository.listContactPropertyRelations(created!.id)).toHaveLength(1);
    expect(await repository.listPersonInteractions(created!.id)).toHaveLength(1);

    await repository.deletePersonById(created!.id);

    expect(await repository.listContactPropertyRelations(created!.id)).toEqual([]);
    expect(await repository.listPersonInteractions(created!.id)).toEqual([]);
  });

  it("materializes sold properties as canonical properties", async () => {
    await repository.createOrUpdateSoldProperty({
      streetAddress: "20 Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1000000,
      latitude: -36.9,
      longitude: 174.9,
    });

    const properties = await repository.listPropertyRecords();
    expect(properties).toHaveLength(1);
    expect(properties[0]?.streetAddress).toBe("20 Sold Street");
    expect(properties[0]?.latitude).toBe(-36.9);
  });

  it("reuses canonical property coordinates for a new person address", async () => {
    await repository.createOrUpdateSoldProperty({
      streetAddress: "22 Stored Road",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1000000,
      latitude: -36.905,
      longitude: 174.905,
    });

    const person = await repository.createOrUpdatePerson({
      name: "Stored Coordinate Owner",
      preferredName: "",
      phone: "021 555 0101",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "22 Stored Rd",
          suburb: "Howick",
          latitude: null,
          longitude: null,
        },
      ],
    }, { geocode: false });

    expect(person?.addresses[0]?.latitude).toBe(-36.905);
    expect(person?.addresses[0]?.longitude).toBe(174.905);
  });

  it("updates the canonical property in place when a sold property address is edited", async () => {
    const created = await repository.createOrUpdateSoldProperty({
      streetAddress: "24 Old Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1000000,
      latitude: -36.9,
      longitude: 174.9,
    });
    const originalProperty = (await repository.listPropertyRecords())[0]!;

    const updated = await repository.updateSoldPropertyById(created!.id, {
      streetAddress: "24 New Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1025000,
      latitude: -36.91,
      longitude: 174.91,
    });

    const properties = await repository.listPropertyRecords();
    expect(updated?.streetAddress).toBe("24 New Sold Street");
    expect(updated?.latitude).toBe(-36.91);
    expect(properties).toHaveLength(1);
    expect(properties[0]?.id).toBe(originalProperty.id);
    expect(properties[0]?.streetAddress).toBe("24 New Sold Street");
    expect(properties[0]?.latitude).toBe(-36.91);
  });

  it("propagates a sold property address edit to matching people address source rows", async () => {
    const created = await repository.createOrUpdateSoldProperty({
      streetAddress: "25 Shared Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1000000,
      latitude: -36.9,
      longitude: 174.9,
    });
    const person = await repository.createOrUpdatePerson({
      name: "Sold Edit Owner",
      preferredName: "",
      phone: "021 888 9999",
      email: "sold-edit-owner@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "25 Shared Sold Street",
          suburb: "Howick",
          latitude: -36.9,
          longitude: 174.9,
        },
      ],
    }, { geocode: false });
    const originalProperty = (await repository.listPropertyRecords())[0]!;

    await repository.updateSoldPropertyById(created!.id, {
      streetAddress: "26 Shared Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1025000,
      latitude: -36.91,
      longitude: 174.91,
    });

    const [property] = await repository.listPropertyRecords();
    const updatedPerson = (await repository.listPeopleRecords()).find((item) => item.id === person!.id);
    const relations = await repository.listContactPropertyRelations(person!.id);
    const interactions = await repository.listPersonInteractions(person!.id);
    expect(property?.id).toBe(originalProperty.id);
    expect(property?.streetAddress).toBe("26 Shared Sold Street");
    expect(updatedPerson?.addresses[0]?.streetAddress).toBe("26 Shared Sold Street");
    expect(updatedPerson?.addresses[0]?.latitude).toBe(-36.91);
    expect(updatedPerson?.streetAddress).toBe("26 Shared Sold Street");
    expect(relations).toEqual([
      expect.objectContaining({
        propertyId: originalProperty.id,
        relationshipType: "owner",
      }),
    ]);
    expect(interactions).toEqual([]);
  });

  it("preserves current owners when a sold property edit is corrected onto their address", async () => {
    const sold = await repository.createOrUpdateSoldProperty({
      streetAddress: "27 Wrong Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1000000,
      latitude: -36.91,
      longitude: 174.91,
    });
    const person = await repository.createOrUpdatePerson({
      name: "Corrected Sale Owner",
      preferredName: "",
      phone: "021 888 1111",
      email: "corrected-sale@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "28 Correct Sold Street",
          suburb: "Howick",
          latitude: -36.92,
          longitude: 174.92,
        },
      ],
    }, { geocode: false });

    await repository.updateSoldPropertyById(sold!.id, {
      streetAddress: "28 Correct Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-03",
      soldPrice: 1025000,
      latitude: -36.92,
      longitude: 174.92,
    });

    const updatedPerson = (await repository.listPeopleRecords()).find((item) => item.id === person!.id);
    const property = (await repository.listPropertyRecords()).find(
      (item) => item.streetAddress === "28 Correct Sold Street",
    );
    const relations = await repository.listContactPropertyRelations(person!.id);
    const interactions = await repository.listPersonInteractions(person!.id);

    expect(updatedPerson?.addresses[0]?.streetAddress).toBe("28 Correct Sold Street");
    expect(property).toBeDefined();
    expect(relations).toEqual([
      expect.objectContaining({
        propertyId: property!.id,
        relationshipType: "owner",
      }),
    ]);
    expect(interactions).toEqual([]);
  });

  it("uses an existing canonical property's address and coordinates for matching sold properties", async () => {
    const geocodeAddress = vi.fn(async () => {
      throw new Error("Sold Property should use the matched Property coordinates before geocoding.");
    });

    vi.doMock("./geomaps", async () => {
      const actual = await vi.importActual<typeof import("./geomaps")>("./geomaps");
      return {
        ...actual,
        geocodeAddress,
      };
    });
    await loadRepository();

    try {
      const person = await repository.createOrUpdatePerson({
        name: "Existing Property Owner",
        preferredName: "",
        phone: "021 444 5555",
        email: "existing-property@example.com",
        purchasingPowerMin: null,
        purchasingPowerMax: null,
        notes: [],
        addresses: [
          {
            streetAddress: "40 Ridge Road",
            suburb: "Howick",
            latitude: -36.88,
            longitude: 174.93,
          },
        ],
      }, { geocode: false });
      const originalProperty = (await repository.listPropertyRecords())[0]!;

      const sold = await repository.createOrUpdateSoldProperty({
        streetAddress: "40 Ridge Rd",
        suburb: "Howick",
        lastSoldDate: "2026-07-02",
        soldPrice: 1550000,
        latitude: null,
        longitude: null,
      });

      const properties = await repository.listPropertyRecords();
      expect(geocodeAddress).not.toHaveBeenCalled();
      expect(sold?.streetAddress).toBe("40 Ridge Road");
      expect(sold?.latitude).toBe(-36.88);
      expect(sold?.longitude).toBe(174.93);
      expect(properties).toHaveLength(1);
      expect(properties[0]?.id).toBe(originalProperty.id);
      expect((await repository.listPeopleRecords()).find((item) => item.id === person!.id)?.addresses).toEqual([]);
    } finally {
      vi.doUnmock("./geomaps");
    }
  });

  it("matches raw contact import lookups across street suffix variants", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Import Alias Contact",
      preferredName: "",
      phone: "021 444 6666",
      email: "import-alias@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "40 Ridge Road",
          suburb: "Howick",
          latitude: -36.88,
          longitude: 174.93,
        },
      ],
    }, { geocode: false });

    const row = repository.getRawPersonByContactAndAddress({
      streetAddress: "40 Ridge Rd",
      suburb: "Howick",
      email: "import-alias@example.com",
      phone: "021 444 6666",
    }) as Record<string, unknown> | undefined;

    expect(row?.person_id).toBe(person!.id);
    expect(row?.street_address).toBe("40 Ridge Road");
  });

  it("reuses canonical properties and transitions owners across suburb abbreviations", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Abbreviated Suburb Owner",
      preferredName: "",
      phone: "021 333 4455",
      email: "suburb-alias@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "8 Alias Road",
          suburb: "Mt Eden",
          latitude: -36.88,
          longitude: 174.76,
        },
      ],
    }, { geocode: false });
    const originalProperty = (await repository.listPropertyRecords())[0]!;

    await repository.createOrUpdateSoldProperty({
      streetAddress: "8 alias road",
      suburb: "Mount Eden",
      lastSoldDate: "2026-07-01",
      soldPrice: 1450000,
      latitude: -36.88,
      longitude: 174.76,
    });

    const properties = await repository.listPropertyRecords();
    expect(properties).toHaveLength(1);
    expect(properties[0]?.id).toBe(originalProperty.id);
    expect((await repository.listPeopleRecords())[0]?.addresses).toEqual([]);
    expect(await repository.listContactPropertyRelations(person!.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyId: originalProperty.id,
          relationshipType: "former_owner",
        }),
      ]),
    );
  });

  it("moves current owner addresses to former owner and records a sale when a sold property is added", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Selling Owner",
      preferredName: "",
      phone: "021 111 2222",
      email: "seller@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "22 Sale Road",
          suburb: "Howick",
          latitude: -36.902,
          longitude: 174.902,
        },
      ],
    }, { geocode: false });

    await repository.createOrUpdateSoldProperty({
      streetAddress: "22 Sale Road",
      suburb: "Howick",
      lastSoldDate: "2026-06-03",
      soldPrice: 1300000,
      latitude: -36.902,
      longitude: 174.902,
    });

    const listedPeople = await repository.listPeopleRecords();
    expect(listedPeople.find((item) => item.id === person!.id)?.addresses).toEqual([]);

    const property = (await repository.listPropertyRecords()).find(
      (item) => item.streetAddress === "22 Sale Road" && item.suburb === "Howick",
    );
    expect(property).toBeDefined();

    const relations = await repository.listContactPropertyRelations(person!.id);
    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyId: property!.id,
          relationshipType: "former_owner",
        }),
      ]),
    );
    expect(relations.some((relation) => relation.propertyId === property!.id && relation.relationshipType === "owner")).toBe(false);

    const interactions = await repository.listPersonInteractions(person!.id);
    expect(interactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyId: property!.id,
          interactionType: "sell",
          interactionDate: "2026-06-03",
        }),
      ]),
    );
  });

  it("does not duplicate sell interactions when the same sold property is saved again", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Repeat Seller",
      preferredName: "",
      phone: "021 222 3333",
      email: "repeat@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "23 Sale Road",
          suburb: "Howick",
          latitude: -36.903,
          longitude: 174.903,
        },
      ],
    }, { geocode: false });
    const input = {
      streetAddress: "23 Sale Road",
      suburb: "Howick",
      lastSoldDate: "2026-06-04",
      soldPrice: 1400000,
      latitude: -36.903,
      longitude: 174.903,
    };

    await repository.createOrUpdateSoldProperty(input);
    await repository.createOrUpdateSoldProperty(input);

    const interactions = await repository.listPersonInteractions(person!.id);
    expect(
      interactions.filter(
        (interaction) =>
          interaction.interactionType === "sell" &&
          interaction.interactionDate === "2026-06-04",
      ),
    ).toHaveLength(1);
  });

  it("creates sold properties when the cached Drizzle query surface lacks new tables", async () => {
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const { getRawDb } = await import("@/db/client");
    const { soldProperties } = await import("@/db/schema");
    const globalWithDb = globalThis as typeof globalThis & {
      locationFinderDrizzle?: unknown;
    };
    globalWithDb.locationFinderDrizzle = drizzle(getRawDb(), {
      schema: { soldProperties },
    }) as unknown as NonNullable<typeof globalThis.locationFinderDrizzle>;

    const created = await repository.createOrUpdateSoldProperty({
      streetAddress: "21 Sold Street",
      suburb: "Howick",
      lastSoldDate: "2026-06-02",
      soldPrice: 1100000,
      latitude: -36.901,
      longitude: 174.901,
    });

    expect(created?.streetAddress).toBe("21 Sold Street");
    const properties = await repository.listPropertyRecords();
    expect(properties).toHaveLength(1);
    expect(properties[0]?.streetAddress).toBe("21 Sold Street");
  });

  it("supports scoped People, Properties, and Sold Properties search", async () => {
    await repository.createOrUpdatePerson({
      name: "Search Person",
      preferredName: "",
      phone: "021 777 0000",
      email: "search@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "30 Search Road",
          suburb: "Howick",
          latitude: -36.91,
          longitude: 174.91,
        },
      ],
    }, { geocode: false });
    await repository.createOrUpdateSoldProperty({
      streetAddress: "31 Search Road",
      suburb: "Howick",
      lastSoldDate: "2026-06-01",
      soldPrice: 1200000,
      latitude: -36.92,
      longitude: 174.92,
    });

    const peopleResults = await repository.searchRecords("Search Person", "people");
    const propertyResults = await repository.searchRecords("Search Road", "properties");
    const soldResults = await repository.searchRecords("31 Search", "soldProperties");

    expect(peopleResults.map((result) => result.type)).toEqual(["person"]);
    expect(propertyResults.every((result) => result.type === "property")).toBe(true);
    expect(propertyResults).toHaveLength(2);
    expect(soldResults.map((result) => result.type)).toEqual(["soldProperty"]);
  });

  it("returns property details with relationships, interactions, sold records, and newest-first timeline", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Timeline Owner",
      preferredName: "",
      phone: "021 555 1212",
      email: "timeline@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "40 Timeline Road",
          suburb: "Howick",
          latitude: -36.91,
          longitude: 174.91,
        },
      ],
    }, { geocode: false });
    const property = (await repository.listPropertyRecords())[0]!;
    await repository.createInteraction({
      personId: person!.id,
      propertyId: property.id,
      interactionType: "inspection",
      interactionDate: "2026-06-20",
    });
    await repository.createOrUpdateSoldProperty({
      streetAddress: "40 Timeline Road",
      suburb: "Howick",
      lastSoldDate: "2026-06-25",
      soldPrice: 1500000,
      latitude: -36.91,
      longitude: 174.91,
    });

    const detail = await repository.getPropertyDetailById(property.id);

    expect(detail?.relations.some((relation) => relation.relationshipType === "former_owner")).toBe(true);
    expect(detail?.interactions.map((interaction) => interaction.interactionType)).toEqual(
      expect.arrayContaining(["inspection", "sell"]),
    );
    expect(detail?.soldProperties).toHaveLength(1);
    expect(detail?.timeline.some((event) => event.eventType === "sold")).toBe(true);
    expect(detail?.timeline.some((event) => event.id.startsWith("property-"))).toBe(false);
    const timelineTimes = detail?.timeline.map((event) => Date.parse(event.date)) ?? [];
    expect(timelineTimes).toEqual([...timelineTimes].sort((a, b) => b - a));
  });

  it("deletes a canonical property and matching source address records", async () => {
    await repository.createOrUpdateSoldProperty({
      streetAddress: "80 Delete Road",
      suburb: "Remuera",
      lastSoldDate: "2026-07-01",
      soldPrice: 1100000,
      latitude: -36.87,
      longitude: 174.78,
    });
    const person = await repository.createOrUpdatePerson({
      name: "Property Delete Owner",
      preferredName: "",
      phone: "021 800 000",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "80 Delete Road",
          suburb: "Remuera",
          latitude: -36.87,
          longitude: 174.78,
        },
      ],
    }, { geocode: false });
    const property = (await repository.listPropertyRecords()).find(
      (record) => record.streetAddress === "80 Delete Road",
    );

    expect(person).not.toBeNull();
    expect(property).toBeDefined();
    await repository.createInteraction({
      personId: person!.id,
      propertyId: property!.id,
      interactionType: "inspection",
      interactionDate: "2026-07-02",
    });

    const result = await repository.deletePropertyById(property!.id);

    expect(result).toMatchObject({
      deleted: true,
      deletedSoldPropertyIds: [expect.any(Number)],
      deletedAddressIds: [person!.addressId],
    });
    expect(
      (await repository.listPropertyRecords()).some((record) => record.id === property!.id),
    ).toBe(false);
    expect(
      (await repository.listSoldPropertyRecords()).some(
        (record) => record.streetAddress === "80 Delete Road" && record.suburb === "Remuera",
      ),
    ).toBe(false);
    const updatedPerson = (await repository.listPeopleRecords()).find((record) => record.id === person!.id);
    expect(updatedPerson?.addresses).toEqual([]);
    expect(updatedPerson?.streetAddress).toBe("");
    expect(await repository.listPersonInteractions(person!.id)).toEqual([
      expect.objectContaining({
        propertyId: null,
        property: null,
        interactionType: "inspection",
      }),
    ]);
  });

  it("deletes source rows with equivalent street suffixes when deleting a canonical property", async () => {
    await repository.createOrUpdateSoldProperty({
      streetAddress: "81 Delete Road",
      suburb: "Remuera",
      lastSoldDate: "2026-06-20",
      soldPrice: 1850000,
      latitude: -36.902,
      longitude: 174.802,
    });
    const person = await repository.createOrUpdatePerson({
      name: "Delete Alias Owner",
      preferredName: "",
      phone: "021 999 0000",
      email: "delete-alias@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "81 Delete Rd",
          suburb: "Remuera",
          latitude: -36.902,
          longitude: 174.802,
        },
      ],
    }, { geocode: false });
    const property = (await repository.listPropertyRecords())[0]!;

    const result = await repository.deletePropertyById(property.id);

    expect(result).toEqual({
      deleted: true,
      deletedAddressIds: [person!.addresses[0]!.id],
      deletedPersonIds: [],
      deletedSoldPropertyIds: [expect.any(Number)],
    });
    expect(await repository.listPropertyRecords()).toEqual([]);
    expect(await repository.listSoldPropertyRecords()).toEqual([]);
    expect((await repository.listPeopleRecords())[0]?.addresses).toEqual([]);
  });

  it("filters person interactions by date and includes linked property information", async () => {
    const person = await repository.createOrUpdatePerson({
      name: "Interaction Contact",
      preferredName: "",
      phone: "021 444 1313",
      email: "interactions@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "41 Interaction Road",
          suburb: "Howick",
          latitude: -36.92,
          longitude: 174.92,
        },
      ],
    }, { geocode: false });
    const property = (await repository.listPropertyRecords())[0]!;
    await repository.createInteraction({
      personId: person!.id,
      propertyId: property.id,
      interactionType: "enquiry",
      interactionDate: "2025-01-01",
    });
    await repository.createInteraction({
      personId: person!.id,
      propertyId: property.id,
      interactionType: "inspection",
      interactionDate: "2026-06-15",
    });

    const filtered = await repository.listPersonInteractions(person!.id, {
      from: "2026-01-01",
      to: "2026-06-30",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.interactionType).toBe("inspection");
    expect(filtered[0]?.property?.streetAddress).toBe("41 Interaction Road");
  });

  it("promotes a remaining address when the primary address row is deleted", async () => {
    const created = await repository.createOrUpdatePerson({
      name: "Primary Swap",
      preferredName: "",
      phone: "021 444 4444",
      email: "swap@example.com",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          latitude: -36.847,
          longitude: 174.763,
        },
        {
          streetAddress: "2 High Street",
          suburb: "Auckland Central",
          latitude: -36.848,
          longitude: 174.764,
        },
      ],
    }, { geocode: false });

    const primaryAddressId = created?.addresses[0]?.id;
    expect(primaryAddressId).toBeTypeOf("number");

    const deleted = await repository.deletePersonAddressRows([primaryAddressId!]);
    expect(deleted.deletedAddressIds).toEqual([primaryAddressId]);

    const listed = await repository.listPeopleRecords();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.streetAddress).toBe("2 High Street");
    expect(listed[0]?.suburb).toBe("Auckland Central");
    expect(listed[0]?.addresses).toHaveLength(1);
  });

  it("maps only missing Person addresses through Google Maps", async () => {
    const googleGeocodeAddress = vi.fn(async () => ({
      latitude: -36.8078,
      longitude: 174.7816,
      matchedAddress: "2/5 Keys Street, Belmont, Auckland, New Zealand",
    }));

    vi.doMock("./google-maps", async () => {
      const actual = await vi.importActual<typeof import("./google-maps")>("./google-maps");
      return {
        ...actual,
        googleGeocodeAddress,
      };
    });
    await loadRepository();

    const created = await repository.createOrUpdatePerson({
      name: "Google Backfill",
      preferredName: "",
      phone: "021 555 5555",
      email: "",
      purchasingPowerMin: null,
      purchasingPowerMax: null,
      notes: [],
      addresses: [
        {
          streetAddress: "2/5 Keys Street",
          suburb: "Belmont",
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
    }, { geocode: false });

    const results = await repository.googleGeocodeMissingPersonAddresses(
      created!.addresses.map((address) => address.id),
    );

    expect(results.map((result) => result.status)).toEqual(["mapped", "already_mapped"]);
    expect(googleGeocodeAddress).toHaveBeenCalledTimes(1);

    const listed = await repository.listPeopleRecords();
    expect(listed[0]?.addresses[0]?.latitude).toBe(-36.8078);
    expect(listed[0]?.addresses[0]?.longitude).toBe(174.7816);
    expect(listed[0]?.addresses[1]?.latitude).toBe(-36.847);
  });
});
