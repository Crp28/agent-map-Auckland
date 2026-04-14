# Location Finder

A Next.js, React, TailwindCSS, and SQLite web app for viewing Auckland sold properties and people on an Auckland Council GeoMaps-powered map.

## Setup

```powershell
cmd /c npm install
Copy-Item .env.example .env
cmd /c npm run sync:geomaps
cmd /c npm run import:people -- 695023-69d71c7b67df2.csv
cmd /c npm run geocode:people
cmd /c npm run dev
```

Use `cmd /c npm ...` in PowerShell because this machine blocks `npm.ps1`.

## Commands

```powershell
cmd /c npm run dev
cmd /c npm run build
cmd /c npm run lint
cmd /c npm run test
cmd /c npm run sync:geomaps
cmd /c npm run import:people -- path\to\people.csv
cmd /c npm run geocode:people
```

## Database

- SQLite path defaults to `./data/locationfinder.db`.
- Override it with `DATABASE_PATH` in `.env`.
- Database files are ignored by Git.
- Tables are created automatically when server-side code first needs the database.
- Legacy single-address People rows are migrated in place to a logical-person-plus-addresses model the next time the app touches the database.

## GeoMaps

The app uses Auckland Council GeoMaps endpoints:

- Basemap: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Basemap/GreyCanvasBasemap/MapServer`
- Address lookup: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Address/MapServer/0`
- V1 outlines: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/LiveMaps/AucklandCouncilBoundaries/MapServer/1`

The outline layer is refreshed by `npm run sync:geomaps` and automatically refreshed by `/api/map-data` when the cache is missing or older than 30 days.

## Map Behavior

- The map opens centered on Highland Park.
- Sold Property pins follow only the date filters and stay visible when a nearby People filter is applied.
- Applying or canceling a nearby People filter does not recenter the map.
- Changing nearby-controller inputs also keeps the current map position.
- Checking `Same suburb` makes the nearby People filter require both the distance limit and a suburb match.
- Clicking a Sold Property search result centers the map on that property at zoom level 6.
- The suburb drawer shares the bottom-right control stack with the nearby People controls so expanded suburb navigation stays within the available height, and clicking a suburb row immediately moves toward that suburb before refining to the resolved suburb center.
- One Person can hold multiple addresses, and each coordinate-bearing address renders its own map dot.

## CSV Format

People import accepts `.csv` files with these required columns:

```csv
name,streetAddress,suburb,phone,email
Ana Buyer,1 Queen Street,Auckland Central,021 000 000,ana@example.com
```

Optional columns:

```csv
purchasingPowerMin,purchasingPowerMax,latitude,longitude
```

Fully duplicate rows are skipped. Rows with the same normalized `name + streetAddress + suburb` identity update the existing record. Invalid rows are counted in the import summary.

With the multi-address People model, CSV imports still submit one address per row. Rows for the same normalized person identity with a new address append that address to the existing person, while rows for the same person and same address update that address.

The importer also accepts the contact-export format used by `695023-69d71c7b67df2.csv`. Only rows with `Contact Type` set to `Person` and valid name, address, suburb, phone, and email values are imported into People. The CLI import skips geocoding for bulk speed and preserves existing coordinates on updates. Imported People without coordinates remain stored and editable, but do not render as map dots until latitude and longitude are added or geocoded.

Run `cmd /c npm run geocode:people` after a bulk contact import to backfill missing People coordinates through Auckland Council Address MapServer. The command is resumable: by default it only retries People rows that still lack coordinates. Use `-- --all` to recheck every Person, `-- --dry-run` to test without writing, and `-- --concurrency=4 --timeout-ms=20000` to tune slower GeoMaps batches.

## V1 Assumptions

- No authentication.
- Sold property data is manually entered.
- Auckland Council subdivision/local-board polygons serve as the v1 suburb outline layer.
- Coordinates come from Auckland Council address lookup or manual latitude/longitude fallback.
