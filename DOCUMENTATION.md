# Location Finder Documentation

## Implementation Log
- 2026-04-13: Started implementation from the accepted plan.
- 2026-04-13: Initialized Git because the project folder was not yet a repository.
- 2026-04-13: Created `task_plan.md`, `findings.md`, and `progress.md` for execution tracking.
- 2026-04-13: Added the project scaffold, including Next.js App Router, TailwindCSS, TypeScript, ESLint, Vitest, Drizzle config, and the initial client app shell.
- 2026-04-13: Installed dependencies. `npm install` reported four moderate audit findings in transitive packages; no force fix was applied because it may introduce breaking changes.
- 2026-04-13: Fixed the Next 16 build boundary by keeping `src/app/page.tsx` as a Server Component and moving `next/dynamic({ ssr: false })` into `src/components/location-finder-loader.tsx`.
- 2026-04-13: Verified the scaffold with `npm run lint` and `npm run build`.
- 2026-04-13: Added backend foundations: SQLite schema/init, validation schemas, Auckland Council GeoMaps address lookup and boundary sync, map/search/nearby repositories, People CSV import, API routes, and `npm run sync:geomaps`.
- 2026-04-13: Refactored SQLite and Drizzle access to lazy initialization so Next's parallel build workers do not open the database at module import time.
- 2026-04-13: Verified the backend slice with `npm run lint`, `npm run build`, and `npm run sync:geomaps`. The sync script fetched 18 subdivision outline records into `data/locationfinder.db`, which is intentionally ignored by Git.
- 2026-04-13: Added the main map workspace with ArcGIS rendering, sold-property pins, people dots, boundary outlines, top-right search, date/price filters, add dialogs, CSV import dialog, nearby-people panel, and manual GeoMaps sync action.
- 2026-04-13: Verified the UI slice with `npm run lint` and `npm run build`. ArcGIS did not accept a literal `"pin"` simple marker style, so sold properties use a path-based pin marker.
- 2026-04-13: Added focused tests for validation, nearby boolean parsing, distance and purchasing-power filtering, and API validation behavior.
- 2026-04-13: Added `README.md` with setup, commands, SQLite path behavior, GeoMaps endpoints and refresh policy, CSV format, and v1 assumptions.
- 2026-04-13: Fixed the CSV import route test setup by isolating the route contract with a minimal `formData()` request object after jsdom rejected direct multipart setup.
- 2026-04-13: Verified tests, lint, and production build. The test suite has 5 files and 11 passing tests.
- 2026-04-13: Started the dev server on `http://127.0.0.1:3000` and confirmed the app endpoint returned HTTP 200.
- 2026-04-13: Updated the map overview to start wider and allow zooming out to level 6 so all of Auckland can fit on screen.
- 2026-04-13: Verified the map zoom-out change with `npm run lint`, `npm run build`, and `npm run test`.
- 2026-04-13: Added a retractable Auckland suburb/region side list that moves the map to the selected GeoMaps boundary region.
- 2026-04-13: Extended People CSV import to normalize contact-export CSV files, including `Contact Type`, `First Name`, `Last Name`, `Preferred Name`, `Email`, phone, address, and suburb columns.
- 2026-04-13: Investigated a contact CSV CLI import timeout. The root cause was serial geocoding for hundreds of valid contacts; the CLI import now skips geocoding for bulk speed and preserves existing coordinates on updates.
- 2026-04-13: Imported `695023-69d71c7b67df2.csv` into SQLite. Result: 401 imported, 6 updated, 55 duplicates, 1711 invalid/skipped. The People table now contains 462 rows, with 6 currently geocoded.
- 2026-04-13: Verified the suburb-list/contact-import changes with `npm run test`, `npm run lint`, and `npm run build`.

## Decisions
- Auckland Council GeoMaps subdivision/local-board polygons will serve as the v1 suburb outline layer.
- Address geocoding uses Auckland Council Address MapServer, with optional manual latitude/longitude fallback.
- Purchasing power is represented as optional numeric minimum and maximum values.

## Notes
- Use `cmd /c npm ...`, `npm.cmd`, or `npx.cmd` in PowerShell because this machine blocks `npm.ps1`.
