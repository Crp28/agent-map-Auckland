import { getRawDb } from "./client";
import { normalizeKey, normalizeText } from "@/lib/normalize";

let initialized = false;

type LegacyPersonRow = {
  id: number;
  name: string;
  street_address: string;
  suburb: string;
  phone: string;
  email: string;
  purchasing_power_min: number | null;
  purchasing_power_max: number | null;
  latitude: number | null;
  longitude: number | null;
  last_updated_at: string;
  created_at: string;
  updated_at: string;
};

function tableColumns(rawDb: ReturnType<typeof getRawDb>, tableName: string) {
  return rawDb.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
}

function hasColumn(rawDb: ReturnType<typeof getRawDb>, tableName: string, columnName: string) {
  return tableColumns(rawDb, tableName).some((column) => column.name === columnName);
}

function migratePeopleToMultiAddress(rawDb: ReturnType<typeof getRawDb>) {
  const rows = rawDb
    .prepare(
      `SELECT id, name, street_address, suburb, phone, email, purchasing_power_min, purchasing_power_max,
              latitude, longitude, last_updated_at, created_at, updated_at
       FROM people
       ORDER BY datetime(updated_at) DESC, id DESC`,
    )
    .all() as LegacyPersonRow[];

  if (rows.length === 0) {
    return;
  }

  const grouped = new Map<string, LegacyPersonRow[]>();
  for (const row of rows) {
    const personKey = normalizeKey(row.name, row.email, row.phone);
    const group = grouped.get(personKey);
    if (group) {
      group.push(row);
    } else {
      grouped.set(personKey, [row]);
    }
  }

  const upsertAddress = rawDb.prepare(`
    INSERT INTO people_addresses (
      person_id, identity_key, street_address, suburb, latitude, longitude, created_at, updated_at
    ) VALUES (
      @personId, @identityKey, @streetAddress, @suburb, @latitude, @longitude, @createdAt, @updatedAt
    )
    ON CONFLICT(identity_key) DO UPDATE SET
      person_id = excluded.person_id,
      street_address = excluded.street_address,
      suburb = excluded.suburb,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      updated_at = excluded.updated_at
  `);

  const updatePerson = rawDb.prepare(`
    UPDATE people
    SET identity_key = @identityKey,
        person_key = @personKey,
        name = @name,
        street_address = @streetAddress,
        suburb = @suburb,
        phone = @phone,
        email = @email,
        purchasing_power_min = @purchasingPowerMin,
        purchasing_power_max = @purchasingPowerMax,
        latitude = @latitude,
        longitude = @longitude,
        last_updated_at = @lastUpdatedAt,
        updated_at = @updatedAt
    WHERE id = @id
  `);

  const deletePerson = rawDb.prepare("DELETE FROM people WHERE id = ?");

  const transaction = rawDb.transaction(() => {
    for (const [personKey, group] of grouped) {
      const keeper = group[0];
      const primaryStreetAddress = normalizeText(keeper.street_address);
      const primarySuburb = normalizeText(keeper.suburb);

      updatePerson.run({
        id: keeper.id,
        identityKey: personKey,
        personKey,
        name: normalizeText(keeper.name),
        streetAddress: primaryStreetAddress,
        suburb: primarySuburb,
        phone: normalizeText(keeper.phone),
        email: keeper.email.trim().toLowerCase(),
        purchasingPowerMin: keeper.purchasing_power_min,
        purchasingPowerMax: keeper.purchasing_power_max,
        latitude: keeper.latitude,
        longitude: keeper.longitude,
        lastUpdatedAt: keeper.last_updated_at,
        updatedAt: keeper.updated_at,
      });

      for (const row of group) {
        const streetAddress = normalizeText(row.street_address);
        const suburb = normalizeText(row.suburb);
        upsertAddress.run({
          personId: keeper.id,
          identityKey: normalizeKey(personKey, streetAddress, suburb),
          streetAddress,
          suburb,
          latitude: row.latitude,
          longitude: row.longitude,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      for (const duplicate of group.slice(1)) {
        deletePerson.run(duplicate.id);
      }
    }
  });

  transaction();
}

export function ensureDatabase() {
  if (initialized) {
    return;
  }

  const rawDb = getRawDb();

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identity_key TEXT NOT NULL UNIQUE,
      person_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      street_address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      purchasing_power_min INTEGER,
      purchasing_power_max INTEGER,
      latitude REAL,
      longitude REAL,
      last_updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS people_suburb_idx ON people(suburb);
    CREATE UNIQUE INDEX IF NOT EXISTS people_person_key_unique ON people(person_key);

    CREATE TABLE IF NOT EXISTS people_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      identity_key TEXT NOT NULL UNIQUE,
      street_address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS people_addresses_person_id_idx ON people_addresses(person_id);
    CREATE INDEX IF NOT EXISTS people_addresses_suburb_idx ON people_addresses(suburb);

    CREATE TABLE IF NOT EXISTS sold_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identity_key TEXT NOT NULL UNIQUE,
      street_address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      last_sold_date TEXT NOT NULL,
      sold_price INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS sold_properties_last_sold_date_idx ON sold_properties(last_sold_date);
    CREATE INDEX IF NOT EXISTS sold_properties_suburb_idx ON sold_properties(suburb);

    CREATE TABLE IF NOT EXISTS council_area_boundaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_object_id INTEGER NOT NULL UNIQUE,
      ward TEXT,
      board TEXT,
      subdivision TEXT NOT NULL,
      geojson TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      source_name TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      last_successful_sync_at TEXT,
      last_attempted_sync_at TEXT,
      status TEXT NOT NULL,
      error TEXT
    );
  `);

  if (!hasColumn(rawDb, "people", "person_key")) {
    rawDb.exec("ALTER TABLE people ADD COLUMN person_key TEXT");
  }
  rawDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS people_person_key_unique ON people(person_key)");
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS people_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      identity_key TEXT NOT NULL UNIQUE,
      street_address TEXT NOT NULL,
      suburb TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  rawDb.exec("CREATE INDEX IF NOT EXISTS people_addresses_person_id_idx ON people_addresses(person_id)");
  rawDb.exec("CREATE INDEX IF NOT EXISTS people_addresses_suburb_idx ON people_addresses(suburb)");
  migratePeopleToMultiAddress(rawDb);

  initialized = true;
}
