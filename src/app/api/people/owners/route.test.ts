import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  deletePersonAddressRows: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  auditPersonAddressOwners: vi.fn(),
  closePropertySmartsOwnerAuditSession: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);
vi.mock("@/lib/propertysmarts-owner-audit", () => auditMocks);

import { POST } from "./route";

describe("POST /api/people/owners", () => {
  beforeEach(() => {
    repositoryMocks.deletePersonAddressRows.mockReset();
    auditMocks.auditPersonAddressOwners.mockReset();
    auditMocks.closePropertySmartsOwnerAuditSession.mockReset();
  });

  it("returns field errors for invalid audit input", async () => {
    const response = await POST(
      new Request("http://localhost/api/people/owners", {
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
    auditMocks.auditPersonAddressOwners.mockRejectedValueOnce(new Error("PropertySmarts offline"));

    const response = await POST(
      new Request("http://localhost/api/people/owners", {
        method: "POST",
        body: JSON.stringify({
          action: "audit",
          addressIds: [1],
        }),
      }),
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe("PropertySmarts offline");
  });

  it("routes delete requests to address deletion", async () => {
    repositoryMocks.deletePersonAddressRows.mockResolvedValueOnce({
      deletedAddressIds: [4, 5],
      deletedPersonIds: [2],
    });

    const response = await POST(
      new Request("http://localhost/api/people/owners", {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          addressIds: [4, 5],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.deletedAddressIds).toEqual([4, 5]);
    expect(repositoryMocks.deletePersonAddressRows).toHaveBeenCalledWith([4, 5]);
  });
});
