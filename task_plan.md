# Location Finder Task Plan

## Goal
Build the planned Location Finder web app with Next.js, React, TailwindCSS, SQLite, ArcGIS GeoMaps integration, CSV import, documentation, tests, and feature-slice Git commits.

## Phases
1. Complete: Initialize Git.
2. Complete: Create documentation trackers and project scaffold.
3. In progress: Implement database, validation, GeoMaps/geocoding, sync services, and API routes.
4. Pending: Implement map UI, filters, search, forms, modals, CSV import, and status display.
5. Pending: Add tests, README, final documentation updates, verification, and final commit.

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
