import type { PersonRecord } from "@/types/location";

export function resolveSelectedPerson(
  people: PersonRecord[],
  personId: number,
  addressId?: number,
) {
  if (typeof addressId === "number") {
    const exactAddressMatch = people.find((item) => item.addressId === addressId);
    if (exactAddressMatch) {
      return exactAddressMatch;
    }
  }

  return people.find((item) => item.id === personId);
}
