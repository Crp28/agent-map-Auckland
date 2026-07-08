export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeKey(...parts: string[]) {
  return parts.map((part) => normalizeText(part).toLowerCase()).join("|");
}

const SUBURB_ABBREVIATIONS: Record<string, string> = {
  bch: "beach",
  hbr: "harbour",
  hts: "heights",
  mt: "mount",
  nth: "north",
  pt: "point",
  sth: "south",
  st: "saint",
  vly: "valley",
};

export function normalizeSuburbKey(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replaceAll(".", "")
    .split(" ")
    .map((part) => SUBURB_ABBREVIATIONS[part] ?? part)
    .join(" ");
}

export function suburbsEqual(left: string, right: string) {
  return normalizeSuburbKey(left) === normalizeSuburbKey(right);
}

export function emptyToNull(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function toOptionalInteger(value: unknown) {
  const normalized = emptyToNull(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function toOptionalNumber(value: unknown) {
  const normalized = emptyToNull(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
