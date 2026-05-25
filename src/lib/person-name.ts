import { normalizeText } from "@/lib/normalize";

export function normalizePreferredFirstName(value: string | null | undefined) {
  const normalized = value ? normalizeText(value) : "";
  if (!normalized) {
    return null;
  }

  return normalized.split(/\s+/)[0] ?? null;
}

export function preferredDisplayName(legalName: string, preferredName: string | null | undefined) {
  const preferredFirstName = normalizePreferredFirstName(preferredName);
  const normalizedLegalName = normalizeText(legalName);
  if (!preferredFirstName || !normalizedLegalName) {
    return normalizedLegalName;
  }

  const legalParts = normalizedLegalName.split(/\s+/).filter(Boolean);
  if (legalParts.length <= 1) {
    return preferredFirstName;
  }

  return [preferredFirstName, ...legalParts.slice(1)].join(" ");
}

export function personOwnerNames(person: { name: string; preferredName?: string | null }) {
  const names = [normalizeText(person.name)];
  const preferredFullName = preferredDisplayName(person.name, person.preferredName);
  if (preferredFullName && preferredFullName !== names[0]) {
    names.push(preferredFullName);
  }

  return names.filter(Boolean);
}
