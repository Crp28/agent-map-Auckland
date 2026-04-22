# Location Finder Progress

## 2026-04-13
- Initialized Git repository.
- Created planning files and started implementation tracking.
- Added the Next.js, TailwindCSS, TypeScript, ESLint, Vitest, Drizzle, and initial app shell scaffold.
- Installed dependencies with `cmd /c npm install`.
- Fixed the scaffold build boundary by moving the `next/dynamic({ ssr: false })` call into a Client Component wrapper.
- Verified the scaffold with `npm run lint` and `npm run build`.
- Added SQLite schema/init, validation, GeoMaps geocoding and boundary sync services, repositories, CSV import logic, API routes, and the `sync:geomaps` script.
- Refactored database access to lazy initialization after `next build` exposed parallel SQLite locking during API route collection.
- Verified the backend slice with `npm run lint`, `npm run build`, and `npm run sync:geomaps`; the sync script fetched 18 GeoMaps boundary records into the ignored local SQLite database.
- Added the full-screen map workspace, filters, search, dialogs, CSV import entry point, nearby-people panel, and GeoMaps sync action.
- Verified the UI slice with `npm run lint` and `npm run build`.
- Added focused validation, distance/filter, and API validation tests.
- Added `README.md` with setup, commands, SQLite, GeoMaps, CSV import format, and v1 assumptions.
- Fixed the CSV import route test setup by isolating the route contract with a minimal `formData()` request object.
- Verified tests, lint, and production build: 5 test files and 11 tests passed, `npm run lint` passed, and `npm run build` passed.
- Started the dev server on `http://127.0.0.1:3000` and confirmed the app endpoint returned HTTP 200.
- Updated the map overview center/zoom and lowered the minimum zoom to support an all-Auckland view.
- Verified the TODO.md map zoom-out change with `npm run lint`, `npm run build`, and `npm run test`.
- Added a retractable Auckland suburb/region side list that moves the map to the selected GeoMaps boundary region.
- Extended People CSV import to normalize the supplied contact-export CSV format and added `npm run import:people -- <csv>`.
- Investigated the contact CSV import timeout; 61 people imported before timeout, and the CLI path now skips bulk geocoding to complete the remaining valid rows quickly.
- Imported `695023-69d71c7b67df2.csv` into SQLite: 401 imported, 6 updated, 55 duplicates, 1711 invalid/skipped. The People table now contains 462 rows; 6 currently have coordinates.
- Verified the TODO suburb-list/contact-import changes with `npm run test`, `npm run lint`, and `npm run build`.
- Started the new TODO.md request to move the suburb list under the right-side search/buttons stack, hide it by default behind a small handle, and use maximum zoom-out after side-list map navigation.
- Moved the suburb navigation into the top-right control stack, defaulted it closed, and render the list rows only while expanded so the closed state exposes only the `<` handle.
- Changed side-list map navigation to target the boundary center and use ArcGIS zoom level 0, the farthest available zoom-out level in this app.
- Browser-checked the drawer with `agent-browser`: closed state exposes only the handle, opening shows the suburb rows, selecting a region closes the drawer, and the zoom-out control is disabled afterward because the map is at its minimum zoom.
- Verified the new TODO change with `npm run test`, `npm run lint`, and `npm run build`.
- Started the next TODO.md request: shorten the suburb drawer, add a suburb search with broader Auckland suburb coverage, support inline editing/deletion in details modals, and replace direct add buttons with record manager lists.
- Added an Auckland suburb catalog covering central, northern, and eastern suburbs, plus a mini suburb filter in the right-side drawer.
- Shortened the expanded suburb drawer to avoid overlap with the nearby people panel at the tested viewport.
- Added `GET`, `PATCH`, and `DELETE` behavior to People and Sold Property API routes, with repository helpers for all-record lists, updates, and deletes.
- Changed the Person and Sold Property top buttons to open manager dialogs listing existing records with details, delete, and add actions.
- Added double-click editable detail rows and red delete controls with confirmation for People and Sold Property details.
- Fixed the manager record-loading effect after ESLint flagged synchronous effect-triggered state updates.
- Verified the new TODO slice with `npm run test`, `npm run lint`, `npm run build`, `agent-browser` drawer/manager smoke checks, and non-mutating API probes for list/update/delete behavior.

## 2026-04-14
- Started the next TODO.md request: double the suburb sidebar height, adjust suburb-click zoom to match `image.png`, show all sold property pins by default, explain why 6 of 462 People render on the map, and reflect the behavior in `FEATURE_STATEMENT.md`.
- Doubled the expanded suburb drawer from `h-56` to `h-[28rem]` and increased its scrollable list height.
- Changed suburb selection from the prior maximum zoom-out behavior to a local suburb-level zoom that matches the `image.png` reference more closely.
- Changed default Sold Property map loading to omit date query parameters and let the API return all geocoded Sold Properties when the date fields are blank.
- Checked the local SQLite counts: 462 People rows exist, 6 have coordinates, and 456 are stored without coordinates, so only the 6 coordinate-bearing People rows can appear as map dots.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, and `findings.md` for the latest TODO behavior.
- Verified the latest TODO slice with `npm run test`, `npm run lint`, `npm run build`, a default `/api/map-data` probe, and an `agent-browser` check of the taller suburb drawer and Highland Park selection.
- Started a People coordinate backfill request for the imported valid rows. Existing workspace dirt before this work: `COMPONENTS.md`, `TODO.md`, and `image.png`, which remain user-owned and untouched.
- Added a resumable `geocode:people` script and request timeout support for Auckland Council GeoMaps address lookup.
- The first geocoding run timed out after 15 minutes while still running in the background and only moved People coordinates from 6 to 15. Stopped the lingering process and added bounded concurrency plus per-request timeout before resuming.
- The next pass increased geocoded People to 40, then the normalized-address pass increased the count to 411, and the final conservative normalization pass increased it to 419.
- Cleared one false-positive coordinate on the `_`/`_` Person row after finding that SQL `LIKE` treated `_` as a wildcard.
- Read the new TODO.md request without interrupting the geocoding work; it asks for suburb click centering at zoom 8, removal of multi-suburb highlighting, sidebar autoscroll to the currently centered suburb, and `FEATURE_STATEMENT.md` updates.
- Verified the geocoding slice with `npm run test`, `npm run lint`, `npm run build`, and a SQLite count check showing 419 geocoded People and 43 still missing coordinates.
- Started the queued TODO.md suburb drawer update after committing the geocoding slice.
- Added a suburb-center API backed by Auckland Council Address MapServer, passed suburb-specific targets to the map, removed subdivision-based drawer row highlighting, and added auto-scroll to the active clicked suburb row.
- Verified the suburb drawer update with `npm run test`, `npm run lint`, `npm run build`, a `/api/suburb-center?name=Highland%20Park` probe, and an `agent-browser` click-through showing Highland Park centered at zoom 8 without multi-row highlight styling.
- Started the new TODO.md request: default the app to Highland Park, keep date-filtered Sold Property pins visible while a nearby People filter is active, add nearby-filter cancellation, prevent nearby filter actions from recentering the map, and move the suburb drawer into the same bottom-right stack as the nearby controls.
- Changed the map overview center to Highland Park, made nearby filtering feed only the People marker layer, added the active-filter Cancel button, and kept Sold Property pins driven by date-filtered map data.
- Moved the suburb drawer into the bottom-right nearby-control stack and gave that stack a fixed top/bottom span so the open drawer uses remaining height instead of overlapping the nearby People panel.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, `README.md`, and `findings.md` for the new nearby-filter and shared-stack behavior.
- Verified the latest TODO slice with `npm run test`, `npm run lint`, `npm run build`, and an `agent-browser` smoke check covering Highland Park default view, nearby filter apply/cancel behavior, and the non-overlapping shared bottom-right stack.
- Started the next TODO.md request: fully stabilize Sold Property pin visibility, center property search hits at zoom 6, fix suburb centering, stop nearby-controller changes from resetting the map, and allow one Person to hold multiple addresses.
- Reworked People storage to keep one logical person row plus a `people_addresses` table, migrated legacy single-address People into that shape during database init, and flattened address-specific person records back out for map/search/nearby flows.
- Stabilized the ArcGIS view by removing nearby-controller state from the map-construction effect, added property search-result focus targets, and changed suburb navigation to wait for the resolved suburb center before moving the map.
- Updated the Add Person dialog and Person detail modal for multi-address editing, while map-driven Person selections keep the clicked address as the only visible address in that modal.
- Verified the new schema and UI slice with `npm run test`, `npm run lint`, and `npm run build`.
- Resumed against the live app after the multi-address commit and found older local databases could crash at startup with `SqliteError: no such column: person_key`; fixed `ensureDatabase()` so the `person_key` column migration runs before the unique index is created.
- Hardened suburb/property map jumps by using explicit WGS84 ArcGIS `Point` geometries for `view.goTo()` targets, which keeps map focusing correct even though the live ArcGIS view runs in NZTM (`wkid 2193`).
- Re-verified the remaining TODO behaviors in the live browser: Sold Property search results center the map at zoom 6, nearby-controller edits keep the current map position, nearby filtering changes only People dots while Sold Property pins stay visible, and suburb navigation returns from Glenfield to a centered Highland Park view at zoom 8.
- Started the next TODO.md slice: fix the `Same suburb` checkbox semantics and harden suburb-row click navigation after the live app still felt unresponsive on suburb selection.
- Changed nearby filtering so `Same suburb` now requires both the distance limit and a suburb match instead of treating suburb as an alternate inclusion path.
- Changed suburb selection to close the drawer, move immediately using the available default/boundary center, cache resolved suburb centers, and then refine to the exact suburb center when GeoMaps returns.
- Verified the new TODO slice with `npm run test`, `npm run lint`, `npm run build`, direct `/api/nearby` probes for checked vs unchecked suburb behavior, and an `agent-browser` click-through showing a suburb-row click collapsing the drawer and moving the map immediately.
- Started the next TODO.md request: replace runtime GeoMaps suburb-center lookups for sidebar navigation with hard-coded catalog coordinates and reflect the behavior in `FEATURE_STATEMENT.md`.
- Added hard-coded center coordinates to every v1 Auckland suburb catalog entry, switched sidebar suburb selection to use those centers directly, and kept the existing GeoMaps boundary id as outline context only.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, `README.md`, and `findings.md` for hard-coded sidebar suburb center behavior.
- Verified the latest TODO slice with `npm run test`, `npm run lint`, `npm run build`, and an `agent-browser` filtered suburb click/HAR check showing the drawer collapses and no `/api/suburb-center` request is made for the click.

## 2026-04-16
- Started the next TODO.md request: fix the suburb drawer handle opening animation that made the main content appear to shift left, and reflect the change in `FEATURE_STATEMENT.md`.
- Reworked the suburb drawer so its bottom-right stack slot is stable, the handle remains fixed on the right edge, and the drawer content reveals leftward by width clipping instead of translating the whole panel.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, and `findings.md` for the fixed handle/reveal behavior.
- Verified the drawer fix with `npm run lint`, `npm run test`, `npm run build`, and an `agent-browser` rectangle check confirming the map, top controls, and nearby panel keep identical bounds before and after opening the drawer.
- Started the next TODO.md request: clear the nearby People list when Cancel is clicked and add a nearby People CSV export button.
- Added a tested nearby export helper for `First Name,Mobile Phone` CSV content and selected-address-based filenames.
- Updated the nearby People panel so Cancel clears the list and Export CSV appears whenever the nearby list has rows.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, `README.md`, and `findings.md` for the nearby export and clear-on-cancel behavior.
- Verified the latest TODO slice with `npm run lint`, `npm run test`, `npm run build`, a browser check showing Cancel clears nearby rows, and a browser interception of the export click confirming the CSV filename/content.
- Started the next TODO.md request: add an `Address` column to the nearby People CSV export.
- Updated the nearby CSV helper and tests so exports now emit `First Name`, `Mobile Phone`, and `Address` from the flattened nearby Person records.
- Updated `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, `README.md`, and `findings.md` for the three-column nearby People export.
- Verified the change with the focused nearby export test, full `npm run test`, `npm run lint`, `npm run build`, and a browser interception showing `First Name,Mobile Phone,Address` in the exported CSV content.
- Started the next TODO.md request: format the nearby People export `Address` column as `street address, suburb`.
- Added a nearby export address helper, updated the CSV unit expectations, and reflected the behavior in `FEATURE_STATEMENT.md`, `DOCUMENTATION.md`, `README.md`, and `findings.md`.
- Verified the change with the focused nearby export test, full `npm run test`, `npm run lint`, `npm run build`, and a browser interception confirming exported rows such as `"39 Argo Dr, Half Moon Bay"`.

## 2026-04-17
- Started a documentation refresh for `README.md` so it reflects the current app behavior instead of the earlier scaffold-era summary.
- Rewrote `README.md` around the current product state: Highland Park default view, nearby export behavior, multi-address People storage, suburb drawer behavior, current setup flow, and full command list from `package.json`.
- Logged the README refresh in `DOCUMENTATION.md` and tracked it as phase 22 in `task_plan.md`.
- Verified the README refresh by checking the rewritten content against `package.json`, `FEATURE_STATEMENT.md`, and the current documentation trail. No code tests were needed because this was a docs-only change.

## 2026-04-22
- Started the People validation change so manual creation no longer requires email.
- Changed the shared People validation schema to normalize missing email to an empty string, allow blank email, and keep rejecting malformed non-empty email values.
- Updated the Add Person label to show email is optional, and reflected the validation behavior in `FEATURE_STATEMENT.md`, `README.md`, and `DOCUMENTATION.md`.
- Verified the change with `npm run test -- src/lib/validation.test.ts`, `npm run lint`, `npm run test`, and `npm run build`.
