import { getDb, getRawDb } from "@/db/client";
import { ensureDatabase } from "@/db/init";
import { councilAreaBoundaries, syncMetadata } from "@/db/schema";
import { GEOMAPS, GEOMAPS_BOUNDARY_SOURCE_NAME, GEOMAPS_REFRESH_DAYS } from "@/lib/constants";
import { eq } from "drizzle-orm";

type ArcGisPointFeature = {
  attributes: {
    OBJECTID: number;
    FullNumber?: string;
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

type AddressPointCandidate = {
  fullNumber?: string;
  fullAddress?: string;
  latitude: number;
  longitude: number;
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

function normalizeAddressQuery(value: string) {
  return value
    .toUpperCase()
    .replace(/_X000D_/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/^LOT\s+\d+\s*\/\s*/g, "")
    .replace(/\bRD\d+\b/g, "")
    .replace(/\bMT\b/g, "MOUNT")
    .replace(/\bPT\b/g, "POINT")
    .replace(/\bSAINT LUKES\b/g, "ST LUKES")
    .replace(/\bCRESENT\b/g, "CRESCENT")
    .replace(/\bRD\b/g, "ROAD")
    .replace(/\bPL\b/g, "PLACE")
    .replace(/\bDR\b/g, "DRIVE")
    .replace(/\bAVE\b/g, "AVENUE")
    .replace(/\bCRES\b/g, "CRESCENT")
    .replace(/\bCT\b/g, "COURT")
    .replace(/\bTCE\b/g, "TERRACE")
    .replace(/\bCL\b/g, "CLOSE")
    .replace(/\bLN\b/g, "LANE")
    .replace(/\bPDE\b/g, "PARADE")
    .replace(/\bHWY\b/g, "HIGHWAY")
    .replace(/\bST\b\s*$/g, "STREET")
    .replace(/\s+/g, " ")
    .trim();
}

function canGeocodeStreetAddress(streetAddress: string) {
  const normalized = normalizeAddressQuery(streetAddress);
  return (
    /\d/.test(normalized) &&
    !/\bPO BOX\b/.test(normalized) &&
    normalized !== "_" &&
    normalized !== "-" &&
    normalized !== "AUCKLAND"
  );
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function addressNumberTokens(value: string) {
  const normalized = normalizeAddressQuery(value);
  const firstToken = normalized.split(" ")[0] ?? "";
  if (!/\d/.test(firstToken)) {
    return [];
  }

  const parts = firstToken.split("/").filter(Boolean);
  return unique([firstToken, parts.at(-1) ?? ""]);
}

function addressPrefixMatches(fullAddress: string, prefix: string) {
  return (
    fullAddress === prefix ||
    fullAddress.startsWith(`${prefix} `) ||
    fullAddress.includes(`/${prefix} `)
  );
}

function addressPrefixCandidates(streetAddress: string, suburb: string) {
  const normalizedStreet = normalizeAddressQuery(streetAddress);
  const normalizedSuburb = normalizeAddressQuery(suburb);
  const firstAddressPart = normalizeAddressQuery(streetAddress.split(",")[0] ?? "");

  return unique([
    normalizedSuburb ? `${normalizedStreet} ${normalizedSuburb}` : "",
    normalizedStreet,
    normalizedSuburb && firstAddressPart !== normalizedStreet ? `${firstAddressPart} ${normalizedSuburb}` : "",
    firstAddressPart !== normalizedStreet ? firstAddressPart : "",
  ]);
}

export function pickBestGeocodeCandidate(
  candidates: AddressPointCandidate[],
  streetAddress: string,
  suburb: string,
) {
  const inputNumberTokens = addressNumberTokens(streetAddress);
  const normalizedSuburb = normalizeAddressQuery(suburb);
  const genericSuburb = normalizedSuburb === "" || normalizedSuburb === "AUCKLAND";
  const prefixes = addressPrefixCandidates(streetAddress, suburb);
  let bestMatch: (AddressPointCandidate & { matchedAddress: string; score: number }) | null = null;

  for (const candidate of candidates) {
    const matchedAddress = candidate.fullAddress ?? "";
    const normalizedMatchedAddress = normalizeAddressQuery(matchedAddress);
    if (!normalizedMatchedAddress) {
      continue;
    }

    if (!genericSuburb && !addressIncludesSuburb(candidate.fullAddress, suburb)) {
      continue;
    }

    const candidateNumberTokens = unique([
      ...addressNumberTokens(candidate.fullNumber ?? ""),
      ...addressNumberTokens(matchedAddress),
    ]);
    if (
      inputNumberTokens.length > 0 &&
      !candidateNumberTokens.some((token) => inputNumberTokens.includes(token))
    ) {
      continue;
    }

    let prefixScore = -1;
    for (const prefix of prefixes) {
      if (!prefix) {
        continue;
      }
      if (normalizedMatchedAddress === prefix) {
        prefixScore = Math.max(prefixScore, 6);
        continue;
      }
      if (addressPrefixMatches(normalizedMatchedAddress, prefix)) {
        prefixScore = Math.max(prefixScore, 5);
      }
    }

    if (prefixScore < 0) {
      continue;
    }

    const score =
      prefixScore +
      (genericSuburb ? 0 : 3) +
      (candidate.fullNumber && inputNumberTokens.includes(normalizeAddressQuery(candidate.fullNumber)) ? 2 : 0);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        ...candidate,
        matchedAddress,
        score,
      };
    }
  }

  return bestMatch
    ? {
        latitude: bestMatch.latitude,
        longitude: bestMatch.longitude,
        matchedAddress: bestMatch.matchedAddress,
      }
    : null;
}

function geocodeSearchCandidates(streetAddress: string, suburb: string) {
  if (!canGeocodeStreetAddress(streetAddress)) {
    return [];
  }

  const normalizedStreet = normalizeAddressQuery(streetAddress);
  const normalizedSuburb = normalizeAddressQuery(suburb);
  const firstAddressPart = normalizeAddressQuery(streetAddress.split(",")[0] ?? "");
  const suburbIsGeneric = normalizedSuburb === "" || normalizedSuburb === "AUCKLAND";

  return unique(
    [
      suburbIsGeneric ? normalizedStreet : `${normalizedStreet} ${normalizedSuburb}`,
      suburbIsGeneric || firstAddressPart === normalizedStreet
        ? ""
        : `${firstAddressPart} ${normalizedSuburb}`,
      normalizedStreet,
      firstAddressPart === normalizedStreet ? "" : firstAddressPart,
    ].map((candidate) => candidate.replace(/[%_]/g, "").trim()),
  );
}

function addressIncludesSuburb(fullAddress: string | undefined, suburb: string) {
  const normalizedSuburb = normalizeAddressQuery(suburb);
  if (!fullAddress || normalizedSuburb === "" || normalizedSuburb === "AUCKLAND") {
    return true;
  }

  return normalizeAddressQuery(fullAddress).includes(normalizedSuburb);
}

export async function geocodeAddress(
  streetAddress: string,
  suburb: string,
  options: { signal?: AbortSignal } = {},
) {
  const searchCandidates = geocodeSearchCandidates(streetAddress, suburb);

  for (const searchText of searchCandidates) {
    for (const where of [
      [
        `UPPER(FullAddress) = '${escapeArcgisLike(searchText)}'`,
        `UPPER(FullAddress) LIKE '${escapeArcgisLike(searchText)} %'`,
        `UPPER(FullAddress) LIKE '%/${escapeArcgisLike(searchText)} %'`,
      ].join(" OR "),
      `UPPER(FullAddress) LIKE '%${escapeArcgisLike(searchText)}%'`,
    ]) {
      const url = arcgisQueryUrl(GEOMAPS.addressLookup, {
        where,
        outFields: "OBJECTID,FullNumber,FullAddress",
        returnGeometry: "true",
        f: "json",
        resultRecordCount: "10",
        outSR: "4326",
      });

      const response = await fetch(url, { cache: "no-store", signal: options.signal });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as ArcGisQueryResponse<ArcGisPointFeature>;
      const match = pickBestGeocodeCandidate(
        (data.features ?? [])
          .filter((item) => item.geometry)
          .map((item) => ({
            fullNumber: item.attributes.FullNumber,
            fullAddress: item.attributes.FullAddress,
            latitude: item.geometry?.y ?? 0,
            longitude: item.geometry?.x ?? 0,
          })),
        streetAddress,
        suburb,
      );
      if (match) {
        return {
          latitude: match.latitude,
          longitude: match.longitude,
          matchedAddress: match.matchedAddress ?? null,
        };
      }
    }
  }

  return null;
}

function suburbSearchCandidates(suburb: string) {
  const normalized = normalizeAddressQuery(suburb);
  return unique([
    normalized,
    normalized.replace(/^SAINT\s+/, "ST "),
    normalized.replace(/^ST\s+/, "SAINT "),
  ]);
}

export async function findSuburbCenter(suburb: string) {
  for (const searchText of suburbSearchCandidates(suburb)) {
    for (const suffix of [" AUCKLAND", ""]) {
      const url = arcgisQueryUrl(GEOMAPS.addressLookup, {
        where: `UPPER(FullAddress) LIKE '%${escapeArcgisLike(`${searchText}${suffix}`)}%'`,
        outFields: "OBJECTID,FullAddress",
        returnGeometry: "true",
        f: "json",
        resultRecordCount: "500",
        outSR: "4326",
      });

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as ArcGisQueryResponse<ArcGisPointFeature>;
      const points = (data.features ?? [])
        .map((feature) => feature.geometry)
        .filter((geometry): geometry is { x: number; y: number } => Boolean(geometry));

      if (points.length > 0) {
        const total = points.reduce(
          (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
          { x: 0, y: 0 },
        );

        return {
          longitude: total.x / points.length,
          latitude: total.y / points.length,
          sampleSize: points.length,
        };
      }
    }
  }

  return null;
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
