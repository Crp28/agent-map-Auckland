# Location Finder Findings

## Repo
- Starting state contained only `INSTRUCTIONS.md`, `COMPONENTS.md`, and `FEATURE_STATEMENT.md`.
- The workspace was not initially a Git repository; `git init` has now been run.
- `INSTRUCTIONS.md` requires TailwindCSS, SQLite, Next.js, fitting skills, feature-slice commits, and `DOCUMENTATION.md`.

## GeoMaps
- Basemap endpoint: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Basemap/GreyCanvasBasemap/MapServer`.
- Address lookup endpoint: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/Address/MapServer/0`.
- V1 outline endpoint: `https://mapspublic.aklc.govt.nz/arcgis/rest/services/LiveMaps/AucklandCouncilBoundaries/MapServer/1`.
- Council subdivision/local-board polygons are used as suburb outlines for v1 by decision.

## Tooling
- PowerShell blocks `npm.ps1`; use `cmd /c npm ...`, `npm.cmd`, or `npx.cmd`.
- `agent-browser` is available as `agent-browser 0.25.4`. On this Windows shell, individual commands were more reliable than the first attempted quoted `batch` invocation.

## Map UI
- Closed right-side suburb navigation should render only the handle, not offscreen row buttons, so hidden rows are not keyboard or screen-reader reachable.
- ArcGIS `goTo` with a polygon extent target can fit that extent even when a `zoom` value is supplied; using the boundary center as the target allows the requested maximum zoom-out level to apply.
- The right-side suburb drawer overlaps the nearby people panel at a 720px-tall viewport when expanded to `h-72`; `h-56` leaves visible separation while keeping the suburb rows scrollable.
- The v1 suburb catalog now maps central, northern, and eastern suburb names onto the available cached GeoMaps subdivision boundary groups; individual suburb polygons are still not available from the current v1 boundary cache.
- The current `image.png` reference shows a local suburb-level view, so selected suburb navigation now uses a fixed ArcGIS zoom level of 12 instead of the farthest zoom-out level.
- After the latest request, the expanded suburb drawer is `h-[28rem]`, which is double the prior `h-56` height.

## Record Management
- The manager dialogs need all stored records, not the map-filtered records, because map data excludes ungeocoded People and date-filtered Sold Properties.
- React hooks lint treats state-setting loaders called directly from effects as synchronous effect state updates; using a fetch helper and setting state from the promise continuation satisfies the rule.
- Sold Property map data now defaults to an all-date range when no date filters are supplied, so every geocoded Sold Property pin is included on first load.
- People map data still requires coordinates. In the current local database, 6 of 462 People rows have both latitude and longitude; the other 456 rows were preserved by the CSV import but cannot be plotted until coordinates are added or geocoded.

## CSV Import
- `695023-69d71c7b67df2.csv` is a contact export with 2173 rows: 2127 `Person` contacts and 46 `Business` contacts.
- Under current People validation, 462 rows are valid People imports. The successful import summary was 401 imported, 6 updated, 55 duplicates, and 1711 invalid/skipped.
- CLI bulk import skips geocoding for speed and preserves existing coordinates on updates.
