import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const defaultDatabasePath = path.join(process.cwd(), "data", "locationfinder.db");
const databasePath = process.env.DATABASE_PATH ?? defaultDatabasePath;
const databaseDirectory = path.dirname(databasePath);

mkdirSync(databaseDirectory, { recursive: true });

declare global {
  var locationFinderSqlite: Database.Database | undefined;
  var locationFinderDrizzle: BetterSQLite3Database<typeof schema> | undefined;
}

export function getRawDb() {
  if (globalThis.locationFinderSqlite) {
    return globalThis.locationFinderSqlite;
  }

  const sqlite = new Database(databasePath, {
    fileMustExist: false,
    timeout: 5000,
  });

  globalThis.locationFinderSqlite = sqlite;
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return sqlite;
}

export function getDb() {
  if (globalThis.locationFinderDrizzle) {
    return globalThis.locationFinderDrizzle;
  }

  const drizzleDb = drizzle(getRawDb(), { schema });
  globalThis.locationFinderDrizzle = drizzleDb;
  return drizzleDb;
}
