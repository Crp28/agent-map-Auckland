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
8. Complete: Apply TODO.md right-side hidden suburb list and maximum zoom-out navigation changes.
9. Complete: Apply TODO.md suburb search/list, editable details, delete actions, and record-manager modal changes.
10. Complete: Apply TODO.md sidebar height, suburb zoom, default sold-property visibility, People marker explanation, and feature statement updates.
11. Complete: Add and run a People geocoding backfill for the imported valid rows missing coordinates.
12. Complete: Apply TODO.md suburb navigation centering, remove suburb highlight behavior, add sidebar autoscroll, and update `FEATURE_STATEMENT.md`.
13. Complete: Apply TODO.md Highland Park default, persistent Sold Property pins during nearby People filtering, nearby filter cancellation, shared bottom-right drawer layout, and `FEATURE_STATEMENT.md` updates.
14. Complete: Apply TODO.md stable property-pin visibility, property-search map centering, suburb-centering fix, nearby-controller map stability, multi-address People schema, and `FEATURE_STATEMENT.md` updates.
15. Complete: Finish the remaining live TODO verification/fixes by repairing old-database multi-address migration order, hardening ArcGIS suburb/property focusing with explicit map points, and re-running browser verification.
16. Complete: Fix the `Same suburb` nearby-filter semantics, harden suburb-row click navigation so selection moves immediately and then resolves to the exact suburb center, and update docs/verification.
17. Complete: Replace runtime GeoMaps suburb-center lookups for sidebar navigation with hard-coded suburb center coordinates and update verification/docs.
18. Complete: Fix the suburb drawer handle animation so opening the sidebar does not make the main content appear to shift left, then update feature/docs and verify.
19. Complete: Clear nearby People on cancel, add nearby People CSV export, update feature/docs, and verify.
20. Complete: Add the Address column to nearby People CSV export, update feature/docs, and verify.
21. Complete: Format the nearby People export Address column as street address plus suburb, update feature/docs, and verify.
22. Complete: Refresh `README.md` so it matches the current application behavior, commands, and data model.
23. Complete: Make manual People email validation optional while preserving invalid non-empty email errors, then update docs and tests.
24. Complete: Require at least one People contact method, allowing either phone or email, then update docs and tests.
25. Complete: Tighten Person geocode matching, add single-person geocode retry from the map details modal, add chunked bulk coordinate audit/refresh with red mismatch markers, and update docs/tests.
26. Complete: Fix multi-address Person marker selection so clicking a secondary address opens the correct address details, then verify with tests.

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
| `agent-browser batch` failed without useful output on Windows quoting | Browser smoke check | Switched to individual `agent-browser` commands and verified the UI behavior step by step. |
| Selected-boundary map navigation still fit the region extent while setting `zoom` | Browser smoke check | Changed the `goTo` target from polygon extent to boundary center and lowered the configured minimum zoom to the farthest ArcGIS level. |
| React hooks lint rejected manager record loading from an effect | Lint verification | Root cause was state-setting work hidden behind a loader called directly from the effect; split fetch and state update so the effect updates state from promise continuations. |
| PowerShell treated expected API 404 responses as command failures | API smoke check | Re-ran the probes with `try/catch` and inspected response status/body directly. |
| People geocoding backfill timed out after 15 minutes | Bulk geocoding | Root cause was serial GeoMaps requests without per-request timeout; stopped the lingering process and added bounded concurrency plus fetch abort timeouts. |
| `_`/`_` Person row received an arbitrary coordinate | Bulk geocoding | Root cause was SQL `LIKE` wildcard handling; added address specificity checks and cleared the false-positive coordinate. |
| Existing local database crashed on `no such column: person_key` after the multi-address schema change | Live app verification | Root cause was `ensureDatabase()` creating the `people_person_key_unique` index before older databases had added the new `person_key` column; moved index creation after the conditional column migration. |
| `agent-browser batch` parsed `wait 700` as command `700` | Nearby export browser verification | Switched to individual `agent-browser` commands with quoted refs on PowerShell and completed the CSV interception check. |
