type GoogleGeocodeResult = {
  latitude: number;
  longitude: number;
  matchedAddress: string | null;
};

type GoogleGeocodeResponse = {
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
  status?: string;
  error_message?: string;
};

function buildGoogleAddressQuery(streetAddress: string, suburb: string) {
  return [streetAddress.trim(), suburb.trim(), "Auckland", "New Zealand"]
    .filter(Boolean)
    .join(", ");
}

export function isGoogleMapsFallbackConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

export async function googleGeocodeAddress(
  streetAddress: string,
  suburb: string,
  options: { signal?: AbortSignal } = {},
): Promise<GoogleGeocodeResult | null> {
  if (!isGoogleMapsFallbackConfigured()) {
    throw new Error("Google Maps fallback is not configured.");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", buildGoogleAddressQuery(streetAddress, suburb));
  url.searchParams.set("components", "country:NZ");
  url.searchParams.set("region", "nz");
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY!.trim());

  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error("Google Maps fallback could not be reached.");
  }

  const payload = (await response.json()) as GoogleGeocodeResponse;
  if (payload.status === "ZERO_RESULTS") {
    return null;
  }

  if (payload.status !== "OK") {
    throw new Error(payload.error_message || "Google Maps fallback could not geocode this address.");
  }

  const topResult = payload.results?.[0];
  const latitude = topResult?.geometry?.location?.lat;
  const longitude = topResult?.geometry?.location?.lng;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    latitude,
    longitude,
    matchedAddress: topResult?.formatted_address ?? null,
  };
}
