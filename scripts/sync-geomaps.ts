import { syncCouncilAreaBoundaries } from "../src/lib/geomaps";

async function main() {
  const result = await syncCouncilAreaBoundaries();
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log(`Synced ${result.count} GeoMaps boundary records at ${result.syncedAt}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
