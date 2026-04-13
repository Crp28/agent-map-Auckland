import { ensureDatabase } from "../src/db/init";
import { getRawDb } from "../src/db/client";
import { geocodeAddress } from "../src/lib/geomaps";

type PersonRow = {
  id: number;
  name: string;
  street_address: string;
  suburb: string;
};

type FailedRow = {
  id: number;
  name: string;
  streetAddress: string;
  suburb: string;
  reason: string;
};

function parseArgs(argv: string[]) {
  const concurrencyArg = argv.find((arg) => arg.startsWith("--concurrency="));
  const timeoutArg = argv.find((arg) => arg.startsWith("--timeout-ms="));
  const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 8;
  const timeoutMs = timeoutArg ? Number(timeoutArg.split("=")[1]) : 8000;

  return {
    all: argv.includes("--all"),
    dryRun: argv.includes("--dry-run"),
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 8,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
  };
}

async function geocodeWithTimeout(streetAddress: string, suburb: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await geocodeAddress(streetAddress, suburb, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDatabase();
  const db = getRawDb();

  const totalPeople = db.prepare("SELECT COUNT(*) AS count FROM people").get() as { count: number };
  const alreadyGeocoded = db
    .prepare("SELECT COUNT(*) AS count FROM people WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
    .get() as { count: number };

  const where = options.all ? "" : "WHERE latitude IS NULL OR longitude IS NULL";
  const rows = db
    .prepare(`SELECT id, name, street_address, suburb FROM people ${where} ORDER BY id`)
    .all() as PersonRow[];

  const update = db.prepare(`
    UPDATE people
    SET latitude = @latitude,
        longitude = @longitude,
        last_updated_at = @timestamp,
        updated_at = @timestamp
    WHERE id = @id
  `);

  const failed: FailedRow[] = [];
  let updated = 0;
  let attempted = 0;

  console.log(
    `People rows: ${totalPeople.count}. Already geocoded: ${alreadyGeocoded.count}. ` +
      `Attempting ${rows.length}${options.all ? " total" : " missing-coordinate"} rows with ` +
      `concurrency ${options.concurrency} and ${options.timeoutMs}ms request timeout.`,
  );

  let nextIndex = 0;

  async function worker() {
    while (nextIndex < rows.length) {
      const row = rows[nextIndex];
      nextIndex += 1;

      try {
        const result = await geocodeWithTimeout(row.street_address, row.suburb, options.timeoutMs);
        if (!result) {
          failed.push({
            id: row.id,
            name: row.name,
            streetAddress: row.street_address,
            suburb: row.suburb,
            reason: "No GeoMaps address match",
          });
        } else {
          if (!options.dryRun) {
            update.run({
              id: row.id,
              latitude: result.latitude,
              longitude: result.longitude,
              timestamp: new Date().toISOString(),
            });
          }
          updated += 1;
        }
      } catch (error) {
        failed.push({
          id: row.id,
          name: row.name,
          streetAddress: row.street_address,
          suburb: row.suburb,
          reason: error instanceof Error ? error.message : "Unknown geocoding error",
        });
      }

      attempted += 1;
      if (attempted % 25 === 0 || attempted === rows.length) {
        console.log(`Processed ${attempted}/${rows.length}; updated ${updated}; failed ${failed.length}.`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, rows.length) }, () => worker()),
  );

  const finalGeocoded = db
    .prepare("SELECT COUNT(*) AS count FROM people WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
    .get() as { count: number };

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        totalPeople: totalPeople.count,
        alreadyGeocoded: alreadyGeocoded.count,
        attempted,
        updated,
        failed: failed.length,
        finalGeocoded: finalGeocoded.count,
        failures: failed.slice(0, 25),
        failureOutputTruncated: failed.length > 25,
      },
      null,
      2,
    ),
  );

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
