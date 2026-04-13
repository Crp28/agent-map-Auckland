import { getDb, getRawDb } from "@/db/client";
import { ensureDatabase } from "@/db/init";
import { people, soldProperties, syncMetadata } from "@/db/schema";
import { GEOMAPS_BOUNDARY_SOURCE_NAME } from "@/lib/constants";
import { distanceKm, purchasingPowerIncludesPrice } from "@/lib/distance";
import { geocodeAddress } from "@/lib/geomaps";
import { normalizeKey, normalizeText } from "@/lib/normalize";
import type { PersonInput, SoldPropertyInput } from "@/lib/validation";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

function nowIso() {
  return new Date().toISOString();
}

async function resolveCoordinates(input: {
  streetAddress: string;
  suburb: string;
  latitude: number | null;
  longitude: number | null;
}) {
  if (input.latitude !== null && input.longitude !== null) {
    return { latitude: input.latitude, longitude: input.longitude };
  }

  const result = await geocodeAddress(input.streetAddress, input.suburb);
  if (!result) {
    return { latitude: null, longitude: null };
  }

  return { latitude: result.latitude, longitude: result.longitude };
}

export async function createOrUpdatePerson(
  input: PersonInput,
  options: { geocode?: boolean } = {},
) {
  ensureDatabase();
  const db = getDb();

  const timestamp = nowIso();
  const coordinates =
    options.geocode === false
      ? { latitude: input.latitude, longitude: input.longitude }
      : await resolveCoordinates(input);
  const shouldPreserveExistingCoordinates =
    options.geocode === false && coordinates.latitude === null && coordinates.longitude === null;
  const identityKey = normalizeKey(input.name, input.streetAddress, input.suburb);

  await db
    .insert(people)
    .values({
      identityKey,
      name: normalizeText(input.name),
      streetAddress: normalizeText(input.streetAddress),
      suburb: normalizeText(input.suburb),
      phone: normalizeText(input.phone),
      email: input.email.trim().toLowerCase(),
      purchasingPowerMin: input.purchasingPowerMin,
      purchasingPowerMax: input.purchasingPowerMax,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      lastUpdatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: people.identityKey,
      set: {
        name: normalizeText(input.name),
        streetAddress: normalizeText(input.streetAddress),
        suburb: normalizeText(input.suburb),
        phone: normalizeText(input.phone),
        email: input.email.trim().toLowerCase(),
        purchasingPowerMin: input.purchasingPowerMin,
        purchasingPowerMax: input.purchasingPowerMax,
        latitude: shouldPreserveExistingCoordinates ? sql`${people.latitude}` : coordinates.latitude,
        longitude: shouldPreserveExistingCoordinates ? sql`${people.longitude}` : coordinates.longitude,
        lastUpdatedAt: timestamp,
        updatedAt: timestamp,
      },
    });

  return db.query.people.findFirst({ where: eq(people.identityKey, identityKey) });
}

export async function createOrUpdateSoldProperty(input: SoldPropertyInput) {
  ensureDatabase();
  const db = getDb();

  const timestamp = nowIso();
  const coordinates = await resolveCoordinates(input);
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
    db.query.people.findMany({ orderBy: desc(people.updatedAt) }),
    db.query.councilAreaBoundaries.findMany(),
    db.query.syncMetadata.findFirst({
      where: eq(syncMetadata.sourceName, GEOMAPS_BOUNDARY_SOURCE_NAME),
    }),
  ]);

  return {
    soldProperties: propertyRows.filter((item) => item.latitude !== null && item.longitude !== null),
    people: peopleRows
      .filter((item) => item.latitude !== null && item.longitude !== null)
      .filter((item) =>
        purchasingPowerIncludesPrice(item.purchasingPowerMin, item.purchasingPowerMax, filters.price),
      ),
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

  const like = `%${query.trim()}%`;
  const [personResults, propertyResults] = await Promise.all([
    db.query.people.findMany({
      where: or(
        sql`${people.name} LIKE ${like}`,
        sql`${people.streetAddress} LIKE ${like}`,
        sql`${people.suburb} LIKE ${like}`,
        sql`${people.email} LIKE ${like}`,
      ),
      limit: 8,
    }),
    db.query.soldProperties.findMany({
      where: or(
        sql`${soldProperties.streetAddress} LIKE ${like}`,
        sql`${soldProperties.suburb} LIKE ${like}`,
      ),
      limit: 8,
    }),
  ]);

  return [
    ...personResults.map((item) => ({
      type: "person" as const,
      id: item.id,
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

  const allPeople = await db.query.people.findMany();
  const nearby = allPeople
    .filter((person) => person.latitude !== null && person.longitude !== null)
    .map((person) => ({
      ...person,
      distanceKm: distanceKm(
        { latitude: property.latitude ?? 0, longitude: property.longitude ?? 0 },
        { latitude: person.latitude ?? 0, longitude: person.longitude ?? 0 },
      ),
    }))
    .filter(
      (person) =>
        person.distanceKm <= input.distanceKm ||
        (input.sameSuburb && person.suburb.toLowerCase() === property.suburb.toLowerCase()),
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { property, people: nearby };
}

export function getRawPeopleByIdentity(identityKey: string) {
  ensureDatabase();
  return getRawDb().prepare("SELECT * FROM people WHERE identity_key = ?").get(identityKey);
}
