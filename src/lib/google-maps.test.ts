import { afterEach, describe, expect, it } from "vitest";

import { isGoogleMapsFallbackConfigured } from "./google-maps";

describe("isGoogleMapsFallbackConfigured", () => {
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
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
});
