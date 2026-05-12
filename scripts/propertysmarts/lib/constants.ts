import path from "node:path";

export const PROPERTYSMARTS_URL = "https://www.propertysmarts.co.nz/property#";
export const PROPERTYSMARTS_STATE_PATH = path.join(
  process.cwd(),
  "scripts",
  "propertysmarts",
  "state",
  "propertysmarts-auth.json",
);
export const PROPERTYSMARTS_OUTPUT_DIR = path.join(
  process.cwd(),
  "scripts",
  "propertysmarts",
  "output",
);
export const PROPERTYSMARTS_CAPTURE_BODY_LIMIT = 20_000;
export const PROPERTYSMARTS_SEARCH_INPUT_SELECTORS = [
  'input[placeholder*="address"]',
  'input[placeholder*="search"]',
  'input[aria-label*="address"]',
  'input[aria-label*="search"]',
  'input[name*="address"]',
  'input[name*="search"]',
  'input[type="search"]',
];
export const PROPERTYSMARTS_SEARCH_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'button[aria-label*="search"]',
  'button:has-text("Search")',
  'button:has-text("Find")',
];
export const PROPERTYSMARTS_RESULT_SELECTORS = [
  '[data-testid*="result"] a',
  '[data-testid*="property"] a',
  'a[href*="property"]',
  'a:has-text("View property")',
];
export const PROPERTYSMARTS_OWNER_SELECTORS = [
  '[data-testid*="owner"]',
  '[class*="owner"]',
  '[id*="owner"]',
];
export const PROPERTYSMARTS_OWNER_LABEL_PATTERNS = [
  /registered owners?/i,
  /owners?/i,
];
