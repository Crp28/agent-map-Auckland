# Location Finder Web App Plan

## Summary
- Build a greenfield Next.js App Router + React + TypeScript app with TailwindCSS, SQLite, and an ArcGIS-based Auckland map UI.
- Use Auckland Council GeoMaps services for the basemap, address lookup, and subdivision outlines:
  - Basemap: `Basemap/GreyCanvasBasemap/MapServer`
  - Address lookup: `Address/MapServer/0`
  - Area outlines: `LiveMaps/AucklandCouncilBoundaries/MapServer/1`
- Use Council subdivision/local-board polygons as the v1 “suburb outline” layer.
- Initialize Git first, then commit after each completed feature slice.

## Documentation
- Create and maintain `task_plan.md`, `findings.md`, and `progress.md` while building, per the planning skill and your “document as you go” request.
- Add `README.md` with setup, dev commands, database setup, GeoMaps sync behavior, CSV format, and known v1 assumptions.
- Keep implementation notes close to the relevant code only when they clarify non-obvious behavior, especially GeoMaps endpoints, monthly sync, geocoding fallback, and CSV merge rules.

## Key Changes
- Scaffold with current packages: Next `16.2.3`, React `19.2.5`, `@arcgis/core` `5.0.16`, TailwindCSS, `better-sqlite3`, Drizzle ORM, Zod, React Hook Form, Radix Dialog, Lucide icons, and `csv-parse`.
- Use `npm.cmd`/`npx.cmd` on this PowerShell machine because `npm.ps1` is blocked.
- Database schema:
  - `people`: name, street address, suburb, phone, email, optional purchasing power min/max, optional coordinates, last update time.
  - `sold_properties`: street address, suburb, last sold date, sold price, optional coordinates.
  - `council_area_boundaries`: cached GeoMaps subdivision polygons and sync timestamp.
  - `sync_metadata`: source URL, last successful sync, status/error.
- Geocoding:
  - Query Auckland Council Address MapServer when saving/importing records.
  - Allow manual latitude/longitude fallback fields if Council lookup fails.
  - Records without coordinates are saved but do not render as map markers until coordinates are present.
- CSV import:
  - Accept `.csv` only.
  - Required People columns: `name`, `streetAddress`, `suburb`, `phone`, `email`.
  - Optional columns: `purchasingPowerMin`, `purchasingPowerMax`, `latitude`, `longitude`.
  - Fully duplicate rows are discarded; same identity with changed fields updates the existing record; invalid rows appear in the import summary.

## Implementation
- Main screen is the usable map app, not a landing page.
- Layout:
  - Full-viewport map, top-right debounced search, compact filters, add buttons, detail modal, and nearby people list.
  - Blue sold-property pins `#0056A7`; yellow people dots `#F8C00B`.
- Map:
  - Dynamically import the ArcGIS map client-side with `next/dynamic({ ssr: false })`.
  - Add GeoMaps grey canvas basemap and cached subdivision outlines.
  - Render sold properties and people as clickable graphics.
  - Support mouse drag/scroll zoom plus keyboard arrow/WASD pan and `+`/`-` zoom.
- Filters/search:
  - Default sold-property date range is one year before today through today.
  - People price filter includes blank ranges and min/max ranges containing the entered integer.
  - Search queries both People and Sold Properties and opens detail modals from result clicks.
  - Selecting a sold property highlights nearby people by distance and/or matching suburb.
- Forms:
  - Sold Property fields: street address, suburb, last sold date, sold price, optional coordinates.
  - People fields: name, street address, suburb, phone, email, optional purchasing power min/max, optional coordinates.
  - Zod validates required fields, email, dates, numbers, coordinate ranges, and min/max ordering.
- Monthly GeoMaps update:
  - Add `npm run sync:geomaps`.
  - Refresh cached boundaries when older than 30 days.
  - Show last successful sync time in the app.

## Test Plan
- Unit/integration tests for validation, purchasing-power filtering, CSV dedupe/update behavior, geocode fallback, search result shape, and nearby-people filtering.
- API tests for create People, create Sold Property, CSV import, search, and GeoMaps sync.
- UI/manual checks for map load, visible/clickable pins and dots, search suggestions, detail modals, date filter, price filter, keyboard map controls, CSV import summary, and responsive layout.
- Run lint/build/test before final delivery and commit passing feature slices separately.

## Assumptions
- No authentication in v1.
- Sold property data is entered manually in v1.
- GeoMaps subdivision/local-board outlines satisfy the v1 “suburb outline” need.
- No third-party geocoder is used by default; Auckland Council lookup plus manual coordinate fallback is the source of coordinates.
