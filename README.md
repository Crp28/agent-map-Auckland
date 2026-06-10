# Location Finder

Location Finder is a Next.js 16 app for viewing Auckland sold properties and people records on an Auckland Council GeoMaps-backed map. It uses React 19, TailwindCSS 4, SQLite, and ArcGIS JS.

## Current App State

- Full-screen Auckland map workspace, defaulted to Highland Park.
- Sold Properties render as blue pins and People with coordinates render as yellow dots.
- ALL data is manually entered.
- Search matches both Sold Properties and People, opens detail modals from results, and moves Sold Property results to zoom level 6.
- Sold Property date filters are blank by default, so all coordinate-bearing Sold Properties are shown until a date range is entered.
- People can be filtered by purchasing power and by nearby distance from a selected Sold Property.
- The nearby filter affects only People dots. Sold Property pins continue to follow only the date filters.
- The nearby panel supports `Apply nearby filter`, `Cancel`, and `Export CSV`.
- Nearby export downloads `First Name,Mobile Phone,Address`, where `Address` is formatted as `street address, suburb`.
- The suburb drawer lives in the same bottom-right stack as the nearby controls, opens from a fixed right-edge handle, and moves directly to hard-coded suburb centers at zoom level 8.
- One Person can store multiple addresses. Each coordinate-bearing address renders its own map dot.
- One Person can store a legal name plus an optional preferred first name. The UI shows that preferred first name combined with the legal surname/rest-of-name when present.
- One Person can also store multiple person-level notes. Each note has a type and plain-text content, and notes render in a compact dark-grey section at the bottom of the Person modal.
- People without coordinates remain stored and editable, but do not render on the map until latitude and longitude are added or geocoded.
- The main page can audit stored People coordinates in batches, color suspected mismatches red on the map, and bulk refresh those mismatches.
- The main page can map all People addresses that still lack coordinates through Google Maps in small batches. The action asks for confirmation because Google Maps usage may be billable, saves successful batches immediately, and safely skips addresses that gained coordinates before processing.
- The main page can also audit stored People owners through a local PropertySmarts Playwright session, resume from the last completed batch, mark owner mismatches red, and mark strict first+last-only stored names in orange when PropertySmarts shows matching middle names that the system does not currently store.

## Setup

```powershell
cmd /c npm install
Copy-Item .env.example .env
cmd /c npm run sync:geomaps
cmd /c npm run dev
```

Optional data-loading steps:

```powershell
cmd /c npm run import:people -- path\to\people.csv
cmd /c npm run geocode:people
```

Use `cmd /c npm ...` in PowerShell on this machine because `npm.ps1` is blocked.

## Commands

```powershell
cmd /c npm run dev
cmd /c npm run build
cmd /c npm run start
cmd /c npm run lint
cmd /c npm run test
cmd /c npm run test:watch
cmd /c npm run db:push
cmd /c npm run sync:geomaps
cmd /c npm run import:people -- path\to\people.csv
cmd /c npm run geocode:people
cmd /c npm run propertysmarts:install-browser
cmd /c npm run propertysmarts:login-capture -- --address "192 Remuera Road"
cmd /c npm run propertysmarts:check-owner -- --address "192 Remuera Road" --suburb "Remuera"
```

## Data Model

- SQLite defaults to `./data/locationfinder.db`.
- Override the database path with `DATABASE_PATH` in `.env`.
- Database files are ignored by Git.
- Tables are created automatically the first time server-side code touches the database.
- Older single-address People rows are migrated in place to the current logical-person plus `people_addresses` model.
- Sold Properties are entered manually in v1.

## GeoMaps Integration

The app uses these Auckland Council GeoMaps endpoints:

- Basemap: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Basemap/GreyCanvasBasemap/MapServer`
- Address lookup: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Address/MapServer/0`
- Boundary outlines: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/LiveMaps/AucklandCouncilBoundaries/MapServer/1`

The subdivision/local-board outline cache is refreshed by `cmd /c npm run sync:geomaps` and also refreshed automatically by `/api/map-data` when the cache is missing or older than 30 days.

## Record Management

- `Sold property` opens the Sold Property manager for viewing, adding, editing, and deleting records.
- `Person` opens the People manager for viewing, adding, editing, and deleting records.
- People validation requires at least one of phone or email, validates non-empty email format, checks optional purchasing power min/max ordering, and validates optional coordinate pairs per address.
- People records also support an optional preferred first name. Legal name remains the canonical stored name for owner-checking and imports, while the UI derives the displayed full name by replacing only the legal first name.
- People records also support multiple person-level notes with the current types `General Note`, `Inspection`, and `Living`.
- A Person modal opened from the map includes a small GeoMaps retry button for the selected address.
- Sold Property validation includes required address, suburb, sold date, sold price, and optional coordinates.
- When GeoMaps cannot find coordinates for a save, the UI offers a one-time in-app Google Maps fallback prompt only if `GOOGLE_MAPS_API_KEY` is configured. Without that key, no Google prompt appears and manual coordinate entry remains available.

## CSV Import

People import accepts `.csv` files only.

Required columns:

```csv
name,streetAddress,suburb,phone,email
Ana Buyer,1 Queen Street,Auckland Central,021 000 000,ana@example.com
```

Optional columns:

```csv
purchasingPowerMin,purchasingPowerMax,latitude,longitude
```

Import behavior:

- Fully duplicate rows are skipped.
- Rows with the same normalized `name + streetAddress + suburb` identity update the existing address record.
- Rows with the same address and contact details also update the existing Person when the legal name has been corrected.
- Rows for an existing person with a new address append that address to the person.
- Invalid rows are counted in the import summary.

The importer also accepts the contact-export format used by the provided contact CSV sample. Only rows with `Contact Type = Person` and valid name, address, suburb, phone, and email values are imported. When the contact export includes both `Legal Name` and `Preferred Name`, the app stores both.

For bulk speed, the CLI import skips geocoding during import and preserves existing coordinates on updates. Run `cmd /c npm run geocode:people` afterward to backfill missing coordinates through Auckland Council Address MapServer.

`geocode:people` is resumable:

- Default: only People still missing coordinates
- `-- --all`: recheck every Person
- `-- --dry-run`: test without writing
- `-- --concurrency=4 --timeout-ms=20000`: tune request batching and timeout

## Map Behavior

- Mouse drag and wheel zoom are supported.
- Keyboard arrow keys and `W`, `A`, `S`, `D` pan the map.
- `+` zooms in and `-` zooms out.
- Selecting a Sold Property pin or search result opens its modal and can drive the nearby People workflow.
- `Audit People coords` checks coordinate-bearing People addresses in batches so the browser does not send one timeout-prone geocode request for every stored marker at once.
- `Map missing coords` uses Google Maps only for People address rows whose coordinate pair is still blank. Successful rows are saved after each small batch, so restarting the action naturally continues with the remaining missing rows.
- `Audit ownership` checks all stored People addresses against PropertySmarts in resumable batches. It is local-only admin tooling, depends on a saved Playwright auth state, and leaves mismatch flags in session state only. Exact mismatches render red; strict first+last-only stored names that otherwise match PropertySmarts render orange.
- Person notes are stored on the Person, not on individual addresses, so every address view of that Person shows the same note set.
- Checking `Same suburb` makes nearby People satisfy both the distance limit and the selected Sold Property suburb.
- Canceling the nearby filter clears the nearby People list and does not reset the map position.
- Changing nearby-controller inputs also keeps the current map position.

## PropertySmarts Helper Scripts

- `scripts/propertysmarts/` contains standalone Playwright helpers for capturing the authenticated PropertySmarts search flow and comparing extracted owner names against the local SQLite People/address records.
- `cmd /c npm run propertysmarts:login-capture -- --address "192 Remuera Road"` opens a headed browser, lets you log in manually, saves a reusable Playwright Chromium profile under `scripts/propertysmarts/state/profile/`, exports a storage-state snapshot, and writes captured XHR/fetch traffic to `scripts/propertysmarts/output/`.
- `cmd /c npm run propertysmarts:check-owner -- --address "192 Remuera Road" --suburb "Remuera"` reuses the saved Playwright profile, searches the property, extracts candidate owner names from the DOM and captured JSON responses, and compares them to the DB row matched by street address and suburb.
- Owner matching checks both the Person legal full name and the preferred-first-name display variant when a preferred first name is present.
- The saved Playwright profile and storage-state export both live under `scripts/propertysmarts/state/` and are ignored by Git.
- The in-app owner audit uses the same saved auth state, but runs through `/api/people/owners` in small batches so the browser can resume from the last completed batch instead of restarting from the beginning after interruptions.
