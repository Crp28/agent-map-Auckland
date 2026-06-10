import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  auditPersonAddressCoordinates: vi.fn(),
  googleGeocodeMissingPersonAddresses: vi.fn(),
  refreshPersonAddressCoordinates: vi.fn(),
  retryPersonAddressGeocode: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

const googleMapsMocks = vi.hoisted(() => ({
  isGoogleMapsFallbackConfigured: vi.fn(),
}));

vi.mock("@/lib/google-maps", () => googleMapsMocks);

import { POST } from "./route";

describe("POST /api/people/coordinates", () => {
  beforeEach(() => {
    repositoryMocks.auditPersonAddressCoordinates.mockReset();
    repositoryMocks.googleGeocodeMissingPersonAddresses.mockReset();
    repositoryMocks.refreshPersonAddressCoordinates.mockReset();
    repositoryMocks.retryPersonAddressGeocode.mockReset();
    googleMapsMocks.isGoogleMapsFallbackConfigured.mockReset();
  });

  it("returns field errors for invalid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/people/coordinates", {
        method: "POST",
        body: JSON.stringify({
          action: "audit",
          addressIds: [],
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.fieldErrors.addressIds).toBeDefined();
  });

  it("returns a JSON 500 response when the audit action throws", async () => {
    repositoryMocks.auditPersonAddressCoordinates.mockRejectedValueOnce(new Error("This operation was aborted"));

    const response = await POST(
      new Request("http://localhost/api/people/coordinates", {
        method: "POST",
        body: JSON.stringify({
          action: "audit",
          addressIds: [1],
        }),
      }),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe("This operation was aborted");
  });

  it("rejects Google backfill when the fallback is not configured", async () => {
    googleMapsMocks.isGoogleMapsFallbackConfigured.mockReturnValueOnce(false);

    const response = await POST(
      new Request("http://localhost/api/people/coordinates", {
        method: "POST",
        body: JSON.stringify({
          action: "google-missing",
          addressIds: [1],
        }),
      }),
    );

    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload.error).toBe("Google Maps fallback is not configured.");
    expect(repositoryMocks.googleGeocodeMissingPersonAddresses).not.toHaveBeenCalled();
  });

  it("returns per-address Google backfill results", async () => {
    googleMapsMocks.isGoogleMapsFallbackConfigured.mockReturnValueOnce(true);
    repositoryMocks.googleGeocodeMissingPersonAddresses.mockResolvedValueOnce([
      {
        personId: 2,
        addressId: 1,
        streetAddress: "2/5 Keys Street",
        suburb: "Belmont",
        status: "mapped",
        matchedAddress: "2/5 Keys Street, Belmont, Auckland, New Zealand",
        error: null,
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/people/coordinates", {
        method: "POST",
        body: JSON.stringify({
          action: "google-missing",
          addressIds: [1],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results[0].status).toBe("mapped");
  });
});
