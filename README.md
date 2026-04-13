# Location Finder

A Next.js, React, TailwindCSS, and SQLite web app for viewing Auckland sold properties and people on an Auckland Council GeoMaps-powered map.

## Setup

```powershell
cmd /c npm install
Copy-Item .env.example .env
cmd /c npm run sync:geomaps
cmd /c npm run import:people -- 695023-69d71c7b67df2.csv
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
```

## Database

- SQLite path defaults to `./data/locationfinder.db`.
- Override it with `DATABASE_PATH` in `.env`.
- Database files are ignored by Git.
- Tables are created automatically when server-side code first needs the database.

## GeoMaps

The app uses Auckland Council GeoMaps endpoints:

- Basemap: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Basemap/GreyCanvasBasemap/MapServer`
- Address lookup: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Address/MapServer/0`
- V1 outlines: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/LiveMaps/AucklandCouncilBoundaries/MapServer/1`

The outline layer is refreshed by `npm run sync:geomaps` and automatically refreshed by `/api/map-data` when the cache is missing or older than 30 days.

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

The importer also accepts the contact-export format used by `695023-69d71c7b67df2.csv`. Only rows with `Contact Type` set to `Person` and valid name, address, suburb, phone, and email values are imported into People. The CLI import skips geocoding for bulk speed and preserves existing coordinates on updates. Imported People without coordinates remain stored and editable, but do not render as map dots until latitude and longitude are added or geocoded.

## V1 Assumptions

- No authentication.
- Sold property data is manually entered.
- Auckland Council subdivision/local-board polygons serve as the v1 suburb outline layer.
- Coordinates come from Auckland Council address lookup or manual latitude/longitude fallback.
