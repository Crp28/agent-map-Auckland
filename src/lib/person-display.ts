export function displayPersonName(person: { name: string; preferredName?: string | null }) {
  return person.preferredName?.trim() || person.name;
}

