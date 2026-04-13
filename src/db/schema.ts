import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identityKey: text("identity_key").notNull(),
    name: text("name").notNull(),
    streetAddress: text("street_address").notNull(),
    suburb: text("suburb").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    purchasingPowerMin: integer("purchasing_power_min"),
    purchasingPowerMax: integer("purchasing_power_max"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    lastUpdatedAt: text("last_updated_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("people_identity_key_unique").on(table.identityKey),
    index("people_suburb_idx").on(table.suburb),
  ],
);

export const soldProperties = sqliteTable(
  "sold_properties",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identityKey: text("identity_key").notNull(),
    streetAddress: text("street_address").notNull(),
    suburb: text("suburb").notNull(),
    lastSoldDate: text("last_sold_date").notNull(),
    soldPrice: integer("sold_price").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("sold_properties_identity_key_unique").on(table.identityKey),
    index("sold_properties_last_sold_date_idx").on(table.lastSoldDate),
    index("sold_properties_suburb_idx").on(table.suburb),
  ],
);

export const councilAreaBoundaries = sqliteTable(
  "council_area_boundaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceObjectId: integer("source_object_id").notNull(),
    ward: text("ward"),
    board: text("board"),
    subdivision: text("subdivision").notNull(),
    geojson: text("geojson").notNull(),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => [uniqueIndex("council_area_boundaries_source_object_id_unique").on(table.sourceObjectId)],
);

export const syncMetadata = sqliteTable("sync_metadata", {
  sourceName: text("source_name").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  lastSuccessfulSyncAt: text("last_successful_sync_at"),
  lastAttemptedSyncAt: text("last_attempted_sync_at"),
  status: text("status").notNull(),
  error: text("error"),
});

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type SoldProperty = typeof soldProperties.$inferSelect;
export type NewSoldProperty = typeof soldProperties.$inferInsert;
export type CouncilAreaBoundary = typeof councilAreaBoundaries.$inferSelect;
export type SyncMetadata = typeof syncMetadata.$inferSelect;
