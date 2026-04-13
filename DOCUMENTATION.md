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

## Decisions
- Auckland Council GeoMaps subdivision/local-board polygons will serve as the v1 suburb outline layer.
- Address geocoding uses Auckland Council Address MapServer, with optional manual latitude/longitude fallback.
- Purchasing power is represented as optional numeric minimum and maximum values.

## Notes
- Use `cmd /c npm ...`, `npm.cmd`, or `npx.cmd` in PowerShell because this machine blocks `npm.ps1`.
