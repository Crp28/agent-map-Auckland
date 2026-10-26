import { afterEach, describe, expect, it, vi } from "vitest";

import { googleGeocodeAddress, isGoogleMapsFallbackConfigured } from "./google-maps";

describe("isGoogleMapsFallbackConfigured", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    }
  });

  it("returns false when the API key is missing or blank", () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    expect(isGoogleMapsFallbackConfigured()).toBe(false);

    process.env.GOOGLE_MAPS_API_KEY = " ";
    expect(isGoogleMapsFallbackConfigured()).toBe(false);
  });

  it("returns true when an API key is configured", () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    expect(isGoogleMapsFallbackConfigured()).toBe(true);
  });

  it("explains Google billing denial without returning coordinates", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "REQUEST_DENIED",
      error_message: "You must enable Billing on the Google Cloud Project at https://console.cloud.google.com/project/_/billing/enable",
    }))));
    await expect(googleGeocodeAddress("1 Queen Street", "Auckland Central")).rejects.toThrow(
      "Google Maps geocoding requires billing to be enabled for the configured Google Cloud project.",
    );
  });
});
