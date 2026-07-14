import type { PersonRecord, SoldPropertyRecord } from "@/types/location";
import { displayPersonName } from "@/lib/person-display";
import { normalizeSuburbKey } from "@/lib/normalize";

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

export function nearbyPersonAddress(person: PersonRecord) {
  return [person.streetAddress, person.suburb].filter(Boolean).join(", ");
}

export function nearbyPeopleForCsv(people: PersonRecord[]) {
  const seenPersonIds = new Set<number>();
  return people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => {
      if (seenPersonIds.has(person.id)) {
        return false;
      }
      seenPersonIds.add(person.id);
      return true;
    })
    .sort((left, right) => {
      const suburbCompare = normalizeSuburbKey(left.person.suburb).localeCompare(
        normalizeSuburbKey(right.person.suburb),
      );
      return suburbCompare || left.index - right.index;
    })
    .map(({ person }) => person);
}

export function nearbyPeopleCsv(people: PersonRecord[]) {
  const exportedPeople = nearbyPeopleForCsv(people);
  const rows = [
    ["First Name", "Mobile Phone", "Address"],
    ...exportedPeople.map((person) => [
      firstNameFromFullName(displayPersonName(person)),
      person.phone,
      nearbyPersonAddress(person),
    ]),
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
  selectedSuburbs: string[],
) {
  const address = property ? filenamePart(property.streetAddress) : "nearby_people";
  const suburbPart =
    selectedSuburbs.length === 0
      ? "all_suburbs"
      : selectedSuburbs.length === 1
        ? filenamePart(selectedSuburbs[0] ?? "selected_suburb") || "selected_suburb"
        : `${selectedSuburbs.length}_suburbs`;
  return `${address || "nearby_people"}_${suburbPart}.csv`;
}
