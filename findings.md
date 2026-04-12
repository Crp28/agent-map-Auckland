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
