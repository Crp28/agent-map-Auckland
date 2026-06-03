import { beforeEach, describe, expect, it, vi } from "vitest";

const googleMapsMocks = vi.hoisted(() => ({
  googleGeocodeAddress: vi.fn(),
}));

vi.mock("@/lib/google-maps", () => googleMapsMocks);

import { POST } from "./route";

describe("POST /api/geocode/google-fallback", () => {
  beforeEach(() => {
    googleMapsMocks.googleGeocodeAddress.mockReset();
  });

  it("returns field errors for invalid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/geocode/google-fallback", {
        method: "POST",
        body: JSON.stringify({ streetAddress: "", suburb: "" }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.fieldErrors.streetAddress).toBeDefined();
  });

  it("returns a 404 when google maps finds no coordinates", async () => {
    googleMapsMocks.googleGeocodeAddress.mockResolvedValueOnce(null);

    const response = await POST(
      new Request("http://localhost/api/geocode/google-fallback", {
        method: "POST",
        body: JSON.stringify({ streetAddress: "40 Ridge Road", suburb: "Howick" }),
      }),
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("Google Maps could not find coordinates for this address.");
  });

  it("returns coordinates when google maps succeeds", async () => {
    googleMapsMocks.googleGeocodeAddress.mockResolvedValueOnce({
      latitude: -36.9,
      longitude: 174.9,
      matchedAddress: "40 Ridge Road, Howick, Auckland 2014, New Zealand",
    });

    const response = await POST(
      new Request("http://localhost/api/geocode/google-fallback", {
        method: "POST",
        body: JSON.stringify({ streetAddress: "40 Ridge Road", suburb: "Howick" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.result.latitude).toBe(-36.9);
    expect(payload.result.longitude).toBe(174.9);
  });
});
