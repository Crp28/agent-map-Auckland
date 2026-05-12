import Database from "better-sqlite3";
import path from "node:path";

export type DbOwnerMatch = {
  personId: number;
  addressId: number;
  name: string;
  preferredName: string | null;
  streetAddress: string;
  suburb: string;
  phone: string;
  email: string;
};

function databasePath() {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "locationfinder.db");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findOwnersByAddress(streetAddress: string, suburb?: string) {
  const db = new Database(databasePath(), { readonly: true });
  try {
    const normalizedStreetAddress = normalizeText(streetAddress);
    const normalizedSuburb = suburb ? normalizeText(suburb) : undefined;

    const rows = normalizedSuburb
      ? db
          .prepare(
            `SELECT
               p.id AS person_id,
               a.id AS address_id,
               p.name,
               p.preferred_name,
               a.street_address,
               a.suburb,
               p.phone,
               p.email
             FROM people_addresses a
             JOIN people p ON p.id = a.person_id
             WHERE lower(trim(a.street_address)) = ?
               AND lower(trim(a.suburb)) = ?
             ORDER BY p.name ASC`,
          )
          .all(normalizedStreetAddress, normalizedSuburb)
      : db
          .prepare(
            `SELECT
               p.id AS person_id,
               a.id AS address_id,
               p.name,
               p.preferred_name,
               a.street_address,
               a.suburb,
               p.phone,
               p.email
             FROM people_addresses a
             JOIN people p ON p.id = a.person_id
             WHERE lower(trim(a.street_address)) = ?
             ORDER BY p.name ASC`,
          )
          .all(normalizedStreetAddress);

    return rows.map((row) => ({
      personId: Number((row as Record<string, unknown>).person_id),
      addressId: Number((row as Record<string, unknown>).address_id),
      name: String((row as Record<string, unknown>).name ?? ""),
      preferredName:
        (row as Record<string, unknown>).preferred_name === null ||
        (row as Record<string, unknown>).preferred_name === undefined
          ? null
          : String((row as Record<string, unknown>).preferred_name),
      streetAddress: String((row as Record<string, unknown>).street_address ?? ""),
      suburb: String((row as Record<string, unknown>).suburb ?? ""),
      phone: String((row as Record<string, unknown>).phone ?? ""),
      email: String((row as Record<string, unknown>).email ?? ""),
    })) satisfies DbOwnerMatch[];
  } finally {
    db.close();
  }
}
