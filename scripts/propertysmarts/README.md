# PropertySmarts Playwright Helpers

This folder contains standalone Playwright scripts for discovering and automating owner checks against PropertySmarts while comparing the returned owner to the local SQLite People/address records.

## Install

```powershell
cmd /c npm run propertysmarts:install-browser
```

## Save a logged-in session and capture a property search

```powershell
cmd /c npm run propertysmarts:login-capture -- --address "192 Remuera Road"
```

What it does:
- opens PropertySmarts in a headed Playwright browser
- lets you log in manually once
- saves a reusable Chromium profile under `scripts/propertysmarts/state/profile/`
- also exports Playwright storage state to `scripts/propertysmarts/state/propertysmarts-auth.json` as a backup snapshot
- attempts the address search, or lets you do it manually if the search UI selectors do not match yet
- saves captured XHR/fetch traffic to `scripts/propertysmarts/output/*.json`
- prints candidate owner strings found in the DOM and captured JSON responses

## Compare PropertySmarts owner to the local DB

```powershell
cmd /c npm run propertysmarts:check-owner -- --address "192 Remuera Road" --suburb "Remuera"
```

Options:
- `--manual`: open the browser and let you drive the property search manually while still doing the DB comparison from the captured page/network state
- `--headless`: run headless instead of opening a browser window

## Current assumptions

- DB owner data is taken from `people_addresses` joined to `people`, matching `street_address` and optional `suburb`.
- Owner matching is deterministic normalized string comparison, not fuzzy matching. When a Person has both a legal name and a preferred first name, the checker compares PropertySmarts output against both the legal full name and the derived preferred-first-name display variant.
- When the stored legal name is strictly `FirstName LastName` and PropertySmarts returns the same first and last names with extra middle names, the checker reports `INCOMPLETE_NAME_MATCH` instead of `MISMATCH`.
- Search selector coverage is best-effort and may need refinement after the first live capture against the authenticated PropertySmarts app.
- PropertySmarts session reuse now depends on the persistent Playwright profile under `scripts/propertysmarts/state/profile/`. That is more reliable for this REINZ SSO flow than fresh contexts loaded only from `storageState`.
