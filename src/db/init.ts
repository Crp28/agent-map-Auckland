import { getRawDb } from "./client";

let initialized = false;

export function ensureDatabase() {
  if (initialized) {
    return;
  }

  const rawDb = getRawDb();

  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identity_key TEXT NOT NULL UNIQUE,
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

  initialized = true;
}
