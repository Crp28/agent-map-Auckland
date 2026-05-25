import { preferredDisplayName } from "@/lib/person-name";

export function displayPersonName(person: { name: string; preferredName?: string | null }) {
  return preferredDisplayName(person.name, person.preferredName) || person.name;
}
