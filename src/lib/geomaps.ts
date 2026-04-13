import { getDb, getRawDb } from "@/db/client";
import { ensureDatabase } from "@/db/init";
import { councilAreaBoundaries, syncMetadata } from "@/db/schema";
import { GEOMAPS, GEOMAPS_BOUNDARY_SOURCE_NAME, GEOMAPS_REFRESH_DAYS } from "@/lib/constants";
import { eq } from "drizzle-orm";

type ArcGisPointFeature = {
  attributes: {
    OBJECTID: number;
    FullAddress?: string;
  };
  geometry?: {
    x: number;
    y: number;
  };
};

type ArcGisBoundaryFeature = {
  attributes: {
    OBJECTID: number;
    WARD?: string | null;
    BOARD?: string | null;
    SUBDIVISION?: string | null;
  };
  geometry?: unknown;
};

type ArcGisQueryResponse<T> = {
  features?: T[];
  error?: {
    message?: string;
    details?: string[];
  };
};

function arcgisQueryUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/query`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function escapeArcgisLike(value: string) {
  return value.trim().replaceAll("'", "''").toUpperCase();
}

export async function geocodeAddress(streetAddress: string, suburb: string) {
  const searchText = escapeArcgisLike(`${streetAddress} ${suburb}`);
  const url = arcgisQueryUrl(GEOMAPS.addressLookup, {
    where: `UPPER(FullAddress) LIKE '%${searchText}%'`,
    outFields: "OBJECTID,FullAddress",
    returnGeometry: "true",
    f: "json",
    resultRecordCount: "1",
    outSR: "4326",
  });

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ArcGisQueryResponse<ArcGisPointFeature>;
  const feature = data.features?.find((item) => item.geometry);
  if (!feature?.geometry) {
    return null;
  }

  return {
    latitude: feature.geometry.y,
    longitude: feature.geometry.x,
    matchedAddress: feature.attributes.FullAddress ?? null,
  };
}

export async function syncCouncilAreaBoundaries() {
  ensureDatabase();
  const db = getDb();

  const attemptedAt = new Date().toISOString();
  await db
    .insert(syncMetadata)
    .values({
      sourceName: GEOMAPS_BOUNDARY_SOURCE_NAME,
      sourceUrl: GEOMAPS.areaOutlines,
      lastAttemptedSyncAt: attemptedAt,
      status: "running",
      error: null,
    })
    .onConflictDoUpdate({
      target: syncMetadata.sourceName,
      set: {
        lastAttemptedSyncAt: attemptedAt,
        status: "running",
        error: null,
      },
    });

  try {
    const url = arcgisQueryUrl(GEOMAPS.areaOutlines, {
      where: "1=1",
      outFields: "OBJECTID,WARD,BOARD,SUBDIVISION",
      returnGeometry: "true",
      f: "json",
      outSR: "4326",
      resultRecordCount: "1000",
    });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`GeoMaps boundary sync failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as ArcGisQueryResponse<ArcGisBoundaryFeature>;
    if (data.error) {
      throw new Error(data.error.message ?? "GeoMaps returned an error");
    }

    const features = data.features ?? [];
    const syncedAt = new Date().toISOString();

    const rawDb = getRawDb();
    const transaction = rawDb.transaction(() => {
      rawDb.prepare("DELETE FROM council_area_boundaries").run();
      const insert = rawDb.prepare(`
        INSERT INTO council_area_boundaries (
          source_object_id, ward, board, subdivision, geojson, synced_at
        ) VALUES (
          @sourceObjectId, @ward, @board, @subdivision, @geojson, @syncedAt
        )
      `);

      for (const feature of features) {
        if (!feature.geometry || !feature.attributes.SUBDIVISION) {
          continue;
        }

        insert.run({
          sourceObjectId: feature.attributes.OBJECTID,
          ward: feature.attributes.WARD ?? null,
          board: feature.attributes.BOARD ?? null,
          subdivision: feature.attributes.SUBDIVISION,
          geojson: JSON.stringify(feature.geometry),
          syncedAt,
        });
      }

      rawDb
        .prepare(
          `UPDATE sync_metadata
           SET last_successful_sync_at = @syncedAt, status = 'ok', error = NULL
           WHERE source_name = @sourceName`,
        )
        .run({ syncedAt, sourceName: GEOMAPS_BOUNDARY_SOURCE_NAME });
    });

    transaction();

    return { ok: true, syncedAt, count: features.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GeoMaps sync error";
    await db
      .update(syncMetadata)
      .set({ status: "error", error: message })
      .where(eq(syncMetadata.sourceName, GEOMAPS_BOUNDARY_SOURCE_NAME));
    return { ok: false, error: message, count: 0 };
  }
}

export async function ensureRecentCouncilAreaBoundaries() {
  ensureDatabase();
  const db = getDb();

  const metadata = await db.query.syncMetadata.findFirst({
    where: eq(syncMetadata.sourceName, GEOMAPS_BOUNDARY_SOURCE_NAME),
  });
  const boundaryCount = await db.$count(councilAreaBoundaries);
  const lastSuccessfulSyncAt = metadata?.lastSuccessfulSyncAt;
  const isStale =
    !lastSuccessfulSyncAt ||
    Date.now() - Date.parse(lastSuccessfulSyncAt) > GEOMAPS_REFRESH_DAYS * 24 * 60 * 60 * 1000;

  if (boundaryCount === 0 || isStale) {
    return syncCouncilAreaBoundaries();
  }

  return { ok: true, syncedAt: lastSuccessfulSyncAt, count: boundaryCount };
}
