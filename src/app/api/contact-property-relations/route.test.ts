import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  deleteContactPropertyRelationById: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

import { DELETE } from "./route";

describe("DELETE /api/contact-property-relations", () => {
  beforeEach(() => {
    repositoryMocks.deleteContactPropertyRelationById.mockReset();
  });

  it("deletes a relation by id", async () => {
    repositoryMocks.deleteContactPropertyRelationById.mockResolvedValue(true);

    const response = await DELETE(new Request("http://localhost/api/contact-property-relations?id=12"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ deleted: true });
    expect(repositoryMocks.deleteContactPropertyRelationById).toHaveBeenCalledWith(12);
  });

  it("rejects invalid ids", async () => {
    const response = await DELETE(new Request("http://localhost/api/contact-property-relations?id=bad"));

    expect(response.status).toBe(400);
    expect(repositoryMocks.deleteContactPropertyRelationById).not.toHaveBeenCalled();
  });
});
