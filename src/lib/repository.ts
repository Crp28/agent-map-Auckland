import { getDb, getRawDb } from "@/db/client";
import { ensureDatabase } from "@/db/init";
import { people, peopleAddresses, soldProperties, syncMetadata } from "@/db/schema";
import { GEOMAPS_BOUNDARY_SOURCE_NAME } from "@/lib/constants";
import { distanceKm, matchesNearbyFilter, purchasingPowerIncludesPrice } from "@/lib/distance";
import { geocodeAddress } from "@/lib/geomaps";
import { normalizeKey, normalizeText } from "@/lib/normalize";
import type { PersonAddressInput, PersonInput, SoldPropertyInput } from "@/lib/validation";
import type { PersonAddressRecord, PersonRecord } from "@/types/location";
import { and, desc, eq, gte, lte, notInArray, or, sql } from "drizzle-orm";

type JoinedPersonAddressRow = {
  person_id: number;
  person_key: string;
  name: string;
  phone: string;
  email: string;
  purchasing_power_min: number | null;
  purchasing_power_max: number | null;
  last_updated_at: string;
  created_at: string;
  updated_at: string;
  address_id: number | null;
  address_identity_key: string | null;
  street_address: string | null;
  suburb: string | null;
  latitude: number | null;
  longitude: number | null;
  address_created_at: string | null;
  address_updated_at: string | null;
};

type ResolvedAddress = PersonAddressInput & {
  streetAddress: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
  identityKey: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function resolveAddressCoordinates(
  input: PersonAddressInput | SoldPropertyInput,
  options: { geocode?: boolean } = {},
) {
  if (input.latitude !== null && input.longitude !== null) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  if (options.geocode === false) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  const result = await geocodeAddress(input.streetAddress, input.suburb);
  if (!result) {
    return { latitude: null, longitude: null };
  }

  return { latitude: result.latitude, longitude: result.longitude };
}

function buildPersonRecord(
  rows: JoinedPersonAddressRow[],
  selectedAddressId: number | null = rows[0]?.address_id ?? null,
): PersonRecord {
  const first = rows[0];
  const addresses: PersonAddressRecord[] = rows
    .filter((row) => row.address_id !== null && row.street_address !== null && row.suburb !== null)
    .map((row) => ({
      id: row.address_id ?? 0,
      personId: row.person_id,
      identityKey: row.address_identity_key ?? "",
      streetAddress: row.street_address ?? "",
      suburb: row.suburb ?? "",
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: row.address_created_at ?? first.created_at,
      updatedAt: row.address_updated_at ?? first.updated_at,
    }));

  const selectedAddress =
    addresses.find((address) => address.id === selectedAddressId) ?? addresses[0] ?? null;

  return {
    id: first.person_id,
    personKey: first.person_key,
    name: first.name,
    addressId: selectedAddress?.id ?? null,
    streetAddress: selectedAddress?.streetAddress ?? "",
    suburb: selectedAddress?.suburb ?? "",
    phone: first.phone,
    email: first.email,
    purchasingPowerMin: first.purchasing_power_min,
    purchasingPowerMax: first.purchasing_power_max,
    latitude: selectedAddress?.latitude ?? null,
    longitude: selectedAddress?.longitude ?? null,
    addresses,
    lastUpdatedAt: first.last_updated_at,
    createdAt: first.created_at,
    updatedAt: first.updated_at,
  };
}

function flattenPeopleByAddress(records: PersonRecord[]) {
  return records.flatMap((person) =>
    person.addresses.map((address) => ({
      ...person,
      addressId: address.id,
      streetAddress: address.streetAddress,
      suburb: address.suburb,
      latitude: address.latitude,
      longitude: address.longitude,
    })),
  );
}

async function listPeopleWithAddresses() {
  ensureDatabase();

  const rows = getRawDb()
    .prepare(
      `SELECT
         p.id AS person_id,
         p.person_key,
         p.name,
         p.phone,
         p.email,
         p.purchasing_power_min,
         p.purchasing_power_max,
         p.last_updated_at,
         p.created_at,
         p.updated_at,
         a.id AS address_id,
         a.identity_key AS address_identity_key,
         a.street_address,
         a.suburb,
         a.latitude,
         a.longitude,
         a.created_at AS address_created_at,
         a.updated_at AS address_updated_at
       FROM people p
       LEFT JOIN people_addresses a ON a.person_id = p.id
       ORDER BY datetime(p.updated_at) DESC, a.id ASC`,
    )
    .all() as JoinedPersonAddressRow[];

  const grouped = new Map<number, JoinedPersonAddressRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.person_id);
    if (group) {
      group.push(row);
    } else {
      grouped.set(row.person_id, [row]);
    }
  }

  return [...grouped.values()].map((group) => buildPersonRecord(group));
}

async function resolvePersonAddresses(
  personKey: string,
  addressesInput: PersonInput["addresses"],
  timestamp: string,
  options: { geocode?: boolean } = {},
) {
  const resolved: ResolvedAddress[] = [];

  for (const address of addressesInput) {
    const streetAddress = normalizeText(address.streetAddress);
    const suburb = normalizeText(address.suburb);
    const coordinates = await resolveAddressCoordinates({ ...address, streetAddress, suburb }, options);

    resolved.push({
      ...address,
      streetAddress,
      suburb,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      identityKey: normalizeKey(personKey, streetAddress, suburb),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return resolved;
}

async function upsertPersonCore(
  input: PersonInput,
  primaryAddress: ResolvedAddress,
  timestamp: string,
) {
  const db = getDb();
  const personKey = normalizeKey(input.name, input.email, input.phone);

  await db
    .insert(people)
    .values({
      identityKey: personKey,
      personKey,
      name: normalizeText(input.name),
      streetAddress: primaryAddress.streetAddress,
      suburb: primaryAddress.suburb,
      phone: normalizeText(input.phone),
      email: input.email.trim().toLowerCase(),
      purchasingPowerMin: input.purchasingPowerMin,
      purchasingPowerMax: input.purchasingPowerMax,
      latitude: primaryAddress.latitude,
      longitude: primaryAddress.longitude,
      lastUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: people.personKey,
      set: {
        identityKey: personKey,
        name: normalizeText(input.name),
        streetAddress: primaryAddress.streetAddress,
        suburb: primaryAddress.suburb,
        phone: normalizeText(input.phone),
        email: input.email.trim().toLowerCase(),
        purchasingPowerMin: input.purchasingPowerMin,
        purchasingPowerMax: input.purchasingPowerMax,
        latitude: primaryAddress.latitude,
        longitude: primaryAddress.longitude,
        lastUpdatedAt: timestamp,
        updatedAt: timestamp,
      },
    });

  return db.query.people.findFirst({ where: eq(people.personKey, personKey) });
}

async function syncPersonAddresses(
  personId: number,
  personKey: string,
  addressesInput: PersonInput["addresses"],
  timestamp: string,
  options: { geocode?: boolean; replaceMissing?: boolean } = {},
) {
  const db = getDb();
  const resolvedAddresses = await resolvePersonAddresses(personKey, addressesInput, timestamp, options);

  for (const address of resolvedAddresses) {
    const shouldPreserveExistingCoordinates =
      options.geocode === false && address.latitude === null && address.longitude === null;

    await db
      .insert(peopleAddresses)
      .values({
        personId,
        identityKey: address.identityKey,
        streetAddress: address.streetAddress,
        suburb: address.suburb,
        latitude: address.latitude,
        longitude: address.longitude,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt,
      })
      .onConflictDoUpdate({
        target: peopleAddresses.identityKey,
        set: {
          personId,
          streetAddress: address.streetAddress,
          suburb: address.suburb,
          latitude: shouldPreserveExistingCoordinates ? sql`${peopleAddresses.latitude}` : address.latitude,
          longitude: shouldPreserveExistingCoordinates ? sql`${peopleAddresses.longitude}` : address.longitude,
          updatedAt: address.updatedAt,
        },
      });
  }

  if (options.replaceMissing) {
    const keptIdentityKeys = resolvedAddresses.map((address) => address.identityKey);
    if (keptIdentityKeys.length > 0) {
      await db
        .delete(peopleAddresses)
        .where(and(eq(peopleAddresses.personId, personId), notInArray(peopleAddresses.identityKey, keptIdentityKeys)));
    }
  }

  return resolvedAddresses;
}

async function getPersonRecordById(id: number) {
  const peopleRecords = await listPeopleWithAddresses();
  return peopleRecords.find((person) => person.id === id) ?? null;
}

export async function createOrUpdatePerson(
  input: PersonInput,
  options: { geocode?: boolean } = {},
) {
  ensureDatabase();

  const timestamp = nowIso();
  const personKey = normalizeKey(input.name, input.email, input.phone);
  const resolvedAddresses = await resolvePersonAddresses(personKey, input.addresses, timestamp, options);
  const primaryAddress = resolvedAddresses[0];
  const person = await upsertPersonCore(input, primaryAddress, timestamp);
  if (!person) {
    return null;
  }

  await syncPersonAddresses(person.id, personKey, input.addresses, timestamp, options);
  return getPersonRecordById(person.id);
}

export async function createOrUpdateSoldProperty(input: SoldPropertyInput) {
  ensureDatabase();
  const db = getDb();

  const timestamp = nowIso();
  const coordinates = await resolveAddressCoordinates(input);
  const identityKey = normalizeKey(input.streetAddress, input.suburb, input.lastSoldDate);

  await db
    .insert(soldProperties)
    .values({
      identityKey,
      streetAddress: normalizeText(input.streetAddress),
      suburb: normalizeText(input.suburb),
      lastSoldDate: input.lastSoldDate,
      soldPrice: input.soldPrice,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: soldProperties.identityKey,
      set: {
        streetAddress: normalizeText(input.streetAddress),
        suburb: normalizeText(input.suburb),
        lastSoldDate: input.lastSoldDate,
        soldPrice: input.soldPrice,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        updatedAt: timestamp,
      },
    });

  return db.query.soldProperties.findFirst({ where: eq(soldProperties.identityKey, identityKey) });
}

export async function listPeopleRecords() {
  return listPeopleWithAddresses();
}

export async function listSoldPropertyRecords() {
  ensureDatabase();
  return getDb().query.soldProperties.findMany({ orderBy: desc(soldProperties.updatedAt) });
}

export async function updatePersonById(id: number, input: PersonInput) {
  ensureDatabase();
  const db = getDb();
  const existing = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!existing) {
    return null;
  }

  const timestamp = nowIso();
  const personKey = normalizeKey(input.name, input.email, input.phone);
  const resolvedAddresses = await resolvePersonAddresses(personKey, input.addresses, timestamp);
  const primaryAddress = resolvedAddresses[0];

  await db
    .update(people)
    .set({
      identityKey: personKey,
      personKey,
      name: normalizeText(input.name),
      streetAddress: primaryAddress.streetAddress,
      suburb: primaryAddress.suburb,
      phone: normalizeText(input.phone),
      email: input.email.trim().toLowerCase(),
      purchasingPowerMin: input.purchasingPowerMin,
      purchasingPowerMax: input.purchasingPowerMax,
      latitude: primaryAddress.latitude,
      longitude: primaryAddress.longitude,
      lastUpdatedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(people.id, id));

  await syncPersonAddresses(id, personKey, input.addresses, timestamp, {
    replaceMissing: true,
  });

  return getPersonRecordById(id);
}

export async function updateSoldPropertyById(id: number, input: SoldPropertyInput) {
  ensureDatabase();
  const db = getDb();
  const existing = await db.query.soldProperties.findFirst({ where: eq(soldProperties.id, id) });
  if (!existing) {
    return null;
  }

  const timestamp = nowIso();
  const coordinates = await resolveAddressCoordinates(input);

  await db
    .update(soldProperties)
    .set({
      identityKey: normalizeKey(input.streetAddress, input.suburb, input.lastSoldDate),
      streetAddress: normalizeText(input.streetAddress),
      suburb: normalizeText(input.suburb),
      lastSoldDate: input.lastSoldDate,
      soldPrice: input.soldPrice,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updatedAt: timestamp,
    })
    .where(eq(soldProperties.id, id));

  return db.query.soldProperties.findFirst({ where: eq(soldProperties.id, id) });
}

export async function deletePersonById(id: number) {
  ensureDatabase();
  const db = getDb();
  const existing = await db.query.people.findFirst({ where: eq(people.id, id) });
  if (!existing) {
    return false;
  }

  await db.delete(people).where(eq(people.id, id));
  return true;
}

export async function deleteSoldPropertyById(id: number) {
  ensureDatabase();
  const db = getDb();
  const existing = await db.query.soldProperties.findFirst({ where: eq(soldProperties.id, id) });
  if (!existing) {
    return false;
  }

  await db.delete(soldProperties).where(eq(soldProperties.id, id));
  return true;
}

export async function getMapData(filters: {
  from: string;
  to: string;
  price?: number | null;
}) {
  ensureDatabase();
  const db = getDb();

  const [propertyRows, peopleRows, boundaryRows, syncRow] = await Promise.all([
    db.query.soldProperties.findMany({
      where: and(
        gte(soldProperties.lastSoldDate, filters.from),
        lte(soldProperties.lastSoldDate, filters.to),
      ),
      orderBy: desc(soldProperties.lastSoldDate),
    }),
    listPeopleWithAddresses(),
    db.query.councilAreaBoundaries.findMany(),
    db.query.syncMetadata.findFirst({
      where: eq(syncMetadata.sourceName, GEOMAPS_BOUNDARY_SOURCE_NAME),
    }),
  ]);

  const flattenedPeople = flattenPeopleByAddress(peopleRows)
    .filter((item) => item.latitude !== null && item.longitude !== null)
    .filter((item) =>
      purchasingPowerIncludesPrice(item.purchasingPowerMin, item.purchasingPowerMax, filters.price),
    );

  return {
    soldProperties: propertyRows.filter((item) => item.latitude !== null && item.longitude !== null),
    people: flattenedPeople,
    boundaries: boundaryRows.map((item) => ({
      ...item,
      geometry: JSON.parse(item.geojson) as unknown,
      geojson: undefined,
    })),
    sync: syncRow ?? null,
  };
}

export async function searchRecords(query: string) {
  ensureDatabase();
  const db = getDb();
  const normalizedQuery = query.trim().toLowerCase();
  const [personResults, propertyResults] = await Promise.all([
    listPeopleWithAddresses(),
    db.query.soldProperties.findMany({
      where: or(
        sql`${soldProperties.streetAddress} LIKE ${`%${query.trim()}%`}`,
        sql`${soldProperties.suburb} LIKE ${`%${query.trim()}%`}`,
      ),
      limit: 8,
    }),
  ]);

  const personMatches = flattenPeopleByAddress(personResults)
    .filter(
      (item) =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.streetAddress.toLowerCase().includes(normalizedQuery) ||
        item.suburb.toLowerCase().includes(normalizedQuery) ||
        item.email.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 8);

  return [
    ...personMatches.map((item) => ({
      type: "person" as const,
      id: item.addressId ?? item.id,
      title: item.name,
      subtitle: `${item.streetAddress}, ${item.suburb}`,
      item,
    })),
    ...propertyResults.map((item) => ({
      type: "soldProperty" as const,
      id: item.id,
      title: item.streetAddress,
      subtitle: `${item.suburb} - $${item.soldPrice.toLocaleString()}`,
      item,
    })),
  ];
}

export async function findNearbyPeople(input: {
  propertyId: number;
  distanceKm: number;
  sameSuburb: boolean;
}) {
  ensureDatabase();
  const db = getDb();

  const property = await db.query.soldProperties.findFirst({
    where: eq(soldProperties.id, input.propertyId),
  });
  if (!property || property.latitude === null || property.longitude === null) {
    return { property, people: [] };
  }

  const allPeople = flattenPeopleByAddress(await listPeopleWithAddresses());
  const nearby = allPeople
    .filter((person) => person.latitude !== null && person.longitude !== null)
    .map((person) => ({
      ...person,
      distanceKm: distanceKm(
        { latitude: property.latitude ?? 0, longitude: property.longitude ?? 0 },
        { latitude: person.latitude ?? 0, longitude: person.longitude ?? 0 },
      ),
    }))
    .filter((person) =>
      matchesNearbyFilter({
        distanceKm: person.distanceKm,
        maxDistanceKm: input.distanceKm,
        sameSuburb: input.sameSuburb,
        personSuburb: person.suburb,
        propertySuburb: property.suburb,
      }),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { property, people: nearby };
}

export function getRawPeopleByIdentity(identityKey: string) {
  ensureDatabase();
  return getRawDb()
    .prepare(
      `SELECT
         p.id AS person_id,
         p.person_key,
         p.name,
         p.phone,
         p.email,
         p.purchasing_power_min,
         p.purchasing_power_max,
         p.last_updated_at,
         p.created_at,
         p.updated_at,
         a.id AS address_id,
         a.identity_key AS address_identity_key,
         a.street_address,
         a.suburb,
         a.latitude,
         a.longitude,
         a.created_at AS address_created_at,
         a.updated_at AS address_updated_at
       FROM people_addresses a
       JOIN people p ON p.id = a.person_id
       WHERE a.identity_key = ?`,
    )
    .get(identityKey);
}
