import { normalizeSuburbKey, normalizeText } from "@/lib/normalize";
import type { PersonInput, SoldPropertyInput } from "@/lib/validation";
import type { PersonAddressRecord, PersonRecord, SoldPropertyRecord } from "@/types/location";

export type GeocodeFailureAddress = {
  addressId: number | null;
  streetAddress: string;
  suburb: string;
};

function addressKey(streetAddress: string, suburb: string) {
  return `${normalizeText(streetAddress).toLowerCase()}|${normalizeSuburbKey(suburb)}`;
}

function findSavedAddress(
  savedAddresses: PersonAddressRecord[],
  inputAddress: PersonInput["addresses"][number],
) {
  if (typeof inputAddress.id === "number") {
    const byId = savedAddresses.find((address) => address.id === inputAddress.id);
    if (byId) {
      return byId;
    }
  }

  const key = addressKey(inputAddress.streetAddress, inputAddress.suburb);
  return savedAddresses.find((address) => addressKey(address.streetAddress, address.suburb) === key) ?? null;
}

function isUnresolvedSavedAddress(address: PersonAddressRecord | null): address is PersonAddressRecord {
  return address !== null && address.latitude === null && address.longitude === null;
}

export function identifyPersonGeocodeFailures(
  input: PersonInput,
  savedPerson: PersonRecord | null,
): GeocodeFailureAddress[] {
  if (!savedPerson) {
    return [];
  }

  return input.addresses
    .filter((address) => address.latitude === null && address.longitude === null)
    .map((address) => findSavedAddress(savedPerson.addresses, address))
    .filter(isUnresolvedSavedAddress)
    .map((address) => ({
      addressId: address.id,
      streetAddress: address.streetAddress,
      suburb: address.suburb,
    }));
}

export function identifySoldPropertyGeocodeFailure(
  input: SoldPropertyInput,
  savedProperty: SoldPropertyRecord | null,
): GeocodeFailureAddress | null {
  if (!savedProperty || input.latitude !== null || input.longitude !== null) {
    return null;
  }

  if (savedProperty.latitude !== null || savedProperty.longitude !== null) {
    return null;
  }

  return {
    addressId: savedProperty.id,
    streetAddress: savedProperty.streetAddress,
    suburb: savedProperty.suburb,
  };
}
