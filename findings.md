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
- GeoMaps address lookup needs normalized query variants for common contact-export forms: street suffix abbreviations, `Mt`/`Pt` suburb abbreviations, comma-separated full addresses, `Lot n /` prefixes, and `_x000D_` line-break artifacts.
- Raw SQL `LIKE` treats `_` as a wildcard; contact rows with `_` as address/suburb must not be sent to GeoMaps because they can falsely match arbitrary addresses.

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
- Suburb row highlighting by GeoMaps subdivision is misleading because several catalog suburbs can share one subdivision boundary id. The drawer now avoids subdivision-based selected-row styling and uses scroll position instead.
- Address MapServer can provide a workable suburb-specific center by averaging sampled address points for a suburb name. Some suburbs require the query without an `AUCKLAND` suffix, for example Mairangi Bay.
- The nearby filter should narrow the People marker layer only; Sold Property pins that satisfy the date filters need to stay visible so the selected property context is not lost.
- The suburb drawer and nearby People controller need a shared bottom-right flex stack. Letting the drawer consume only the remaining vertical space keeps it from overlapping the nearby controls when the drawer expands.
- The app defaults to the Highland Park map center; applying or canceling nearby People filters does not update the selected suburb target or call map recentering.
- The remaining map-reset bug came from the ArcGIS view setup effect depending on selection callbacks that changed whenever nearby-controller inputs changed. Keeping the callback identities stable prevents the map from being destroyed and recreated on nearby-controller edits.
- Search-result navigation for Sold Properties is a separate map-focus action from pin selection. Centering the map on a property search hit should not be tied to general property selection, otherwise normal pin clicks would also reframe the map unexpectedly.
- The suburb-centering bug was partly caused by moving to the boundary fallback immediately and only correcting later when the suburb-center lookup returned. Waiting for the suburb-center lookup before setting the map target avoids the initial jump to the wrong location.
- This ArcGIS view runs in NZTM (`wkid 2193`) even though suburb/property centers originate from WGS84 longitude/latitude values. Passing explicit `Point` geometries with `wkid 4326` to `view.goTo()` makes suburb navigation and property search-result focusing deterministic.
- The nearby `Same suburb` checkbox needs conjunction semantics, not union semantics. When checked, nearby results should satisfy the distance limit and match the Sold Property suburb; otherwise close-by records from other suburbs still appear and the checkbox looks broken.
- Suburb-center lookups are consistently slow, around 5 seconds even when reducing `resultRecordCount`, so suburb clicks need immediate visual movement or feedback before the exact center response arrives.

## Record Management
- The manager dialogs need all stored records, not the map-filtered records, because map data excludes ungeocoded People and date-filtered Sold Properties.
- React hooks lint treats state-setting loaders called directly from effects as synchronous effect state updates; using a fetch helper and setting state from the promise continuation satisfies the rule.
- Sold Property map data now defaults to an all-date range when no date filters are supplied, so every geocoded Sold Property pin is included on first load.
- People map data still requires coordinates. In the current local database, 6 of 462 People rows have both latitude and longitude; the other 456 rows were preserved by the CSV import but cannot be plotted until coordinates are added or geocoded.
- The new People model needs a logical person identity separate from each address identity. A `people_addresses` table fits the map requirement cleanly because one person can render multiple dots while still sharing one name, phone, email, and purchasing-power range.
- For map, search, and nearby flows, address-specific flattened person records work better than raw logical-person rows. They keep the clicked address on the top-level fields while still carrying the full address list for manager editing.
- Older local databases may already have the `people` table but not the new `person_key` column. Migration order matters: add the column before creating the unique index, or SQLite will throw `no such column: person_key` on app startup.

## CSV Import
- `695023-69d71c7b67df2.csv` is a contact export with 2173 rows: 2127 `Person` contacts and 46 `Business` contacts.
- Under current People validation, 462 rows are valid People imports. The successful import summary was 401 imported, 6 updated, 55 duplicates, and 1711 invalid/skipped.
- CLI bulk import skips geocoding for speed and preserves existing coordinates on updates.
- After running the resumable People geocoding backfill, 419 of 462 People rows have coordinates. The remaining 43 include PO boxes, missing house numbers, outside-Auckland addresses, typos, or addresses GeoMaps did not match from the stored text.
