# Location Finder Task Plan

## Goal
Build the planned Location Finder web app with Next.js, React, TailwindCSS, SQLite, ArcGIS GeoMaps integration, CSV import, documentation, tests, and feature-slice Git commits.

## Phases
1. Complete: Initialize Git.
2. Complete: Create documentation trackers and project scaffold.
3. Complete: Implement database, validation, GeoMaps/geocoding, sync services, and API routes.
4. Complete: Implement map UI, filters, search, forms, modals, CSV import, and status display.
5. Complete: Add tests, README, final documentation updates, verification, and final commit.
6. Complete: Apply TODO.md map zoom-out change.
7. Complete: Apply TODO.md suburb side-list and contact CSV import changes.

## Decisions
- Use Auckland Council GeoMaps subdivision/local-board polygons as v1 suburb outlines.
- Use Auckland Council Address MapServer for address lookup and allow manual latitude/longitude fallback.
- Store purchasing power as optional numeric min/max fields.
- Use `npm.cmd`/`npx.cmd` on this PowerShell machine because `npm.ps1` is blocked.

## Errors Encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| `npm install` reported 4 moderate audit findings | Dependency install | Logged for follow-up; not auto-fixed because `npm audit fix --force` may introduce breaking changes. |
| Next build rejected `next/dynamic` with `ssr:false` in a Server Component | Scaffold build | Root cause was the dynamic import living in `src/app/page.tsx`; moved it into a client wrapper component. |
| Next build hit `SQLITE_BUSY` while collecting API route page data | Backend build | Root cause was SQLite opening at module import time across parallel workers; changed DB/Drizzle access to lazy `getDb()`/`getRawDb()` functions. |
| `npm test` found no test files | Backend verification | Tests have not been added yet; will add focused tests in the test phase. |
| ArcGIS marker style rejected `"pin"` | UI build | Replaced with a path-based simple marker pin symbol accepted by ArcGIS typings. |
| Import route test failed constructing a `File` for `FormData.set` | Test verification | Root cause was jsdom/FormData object compatibility in the test; switched to a `Blob` plus filename. |
| Import route test still failed through jsdom `FormData.set` | Test verification | Isolated route behavior with a minimal request object returning a `File` from `formData()`. |
| Contact CSV CLI import timed out after 5 minutes | Bulk import | Root cause was serial geocoding for hundreds of valid contacts; changed CLI bulk import to skip geocoding and preserve existing coordinates. |
