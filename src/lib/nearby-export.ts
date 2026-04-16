import type { PersonRecord, SoldPropertyRecord } from "@/types/location";

export function firstNameFromFullName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes(",")) {
    const [, givenNames] = trimmed.split(",", 2);
    const firstGivenName = givenNames?.trim().split(/\s+/)[0];
    if (firstGivenName) {
      return firstGivenName;
    }
  }

  return trimmed.split(/\s+/)[0] ?? "";
}

function csvCell(value: string) {
  const escaped = value.replaceAll('"', '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function nearbyPeopleCsv(people: PersonRecord[]) {
  const rows = [
    ["First Name", "Mobile Phone"],
    ...people.map((person) => [firstNameFromFullName(person.name), person.phone]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function filenamePart(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function nearbyPeopleExportFilename(
  property: SoldPropertyRecord | undefined,
  sameSuburb: boolean,
) {
  const address = property ? filenamePart(property.streetAddress) : "nearby_people";
  return `${address || "nearby_people"}_distance_${sameSuburb}.csv`;
}
