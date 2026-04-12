# Location Finder Documentation

## Implementation Log
- 2026-04-13: Started implementation from the accepted plan.
- 2026-04-13: Initialized Git because the project folder was not yet a repository.
- 2026-04-13: Created `task_plan.md`, `findings.md`, and `progress.md` for execution tracking.
- 2026-04-13: Added the project scaffold, including Next.js App Router, TailwindCSS, TypeScript, ESLint, Vitest, Drizzle config, and the initial client app shell.
- 2026-04-13: Installed dependencies. `npm install` reported four moderate audit findings in transitive packages; no force fix was applied because it may introduce breaking changes.
- 2026-04-13: Fixed the Next 16 build boundary by keeping `src/app/page.tsx` as a Server Component and moving `next/dynamic({ ssr: false })` into `src/components/location-finder-loader.tsx`.
- 2026-04-13: Verified the scaffold with `npm run lint` and `npm run build`.

## Decisions
- Auckland Council GeoMaps subdivision/local-board polygons will serve as the v1 suburb outline layer.
- Address geocoding uses Auckland Council Address MapServer, with optional manual latitude/longitude fallback.
- Purchasing power is represented as optional numeric minimum and maximum values.

## Notes
- Use `cmd /c npm ...`, `npm.cmd`, or `npx.cmd` in PowerShell because this machine blocks `npm.ps1`.
