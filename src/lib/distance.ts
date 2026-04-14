const earthRadiusKm = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function purchasingPowerIncludesPrice(
  min: number | null,
  max: number | null,
  price: number | null | undefined,
) {
  if (price === null || price === undefined) {
    return true;
  }

  if (min === null && max === null) {
    return true;
  }

  if (min !== null && price < min) {
    return false;
  }

  if (max !== null && price > max) {
    return false;
  }

  return true;
}

export function matchesNearbyFilter(input: {
  distanceKm: number;
  maxDistanceKm: number;
  sameSuburb: boolean;
  personSuburb: string;
  propertySuburb: string;
}) {
  if (input.distanceKm > input.maxDistanceKm) {
    return false;
  }

  if (!input.sameSuburb) {
    return true;
  }

  return input.personSuburb.trim().toLowerCase() === input.propertySuburb.trim().toLowerCase();
}
