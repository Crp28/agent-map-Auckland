import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  auditPersonAddressCoordinates: vi.fn(),
  refreshPersonAddressCoordinates: vi.fn(),
  retryPersonAddressGeocode: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

import { POST } from "./route";

describe("POST /api/people/coordinates", () => {
  beforeEach(() => {
    repositoryMocks.auditPersonAddressCoordinates.mockReset();
    repositoryMocks.refreshPersonAddressCoordinates.mockReset();
    repositoryMocks.retryPersonAddressGeocode.mockReset();
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
});
