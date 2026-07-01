import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getPropertyDetailById: vi.fn(),
  listPropertyRecords: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

import { GET } from "./route";

describe("GET /api/properties", () => {
  beforeEach(() => {
    repositoryMocks.getPropertyDetailById.mockReset();
    repositoryMocks.listPropertyRecords.mockReset();
  });

  it("lists properties when no id is supplied", async () => {
    repositoryMocks.listPropertyRecords.mockResolvedValue([{ id: 1 }]);

    const response = await GET(new Request("http://localhost/api/properties"));
    expect(await response.json()).toEqual({ properties: [{ id: 1 }] });
  });

  it("returns one property detail by id", async () => {
    repositoryMocks.getPropertyDetailById.mockResolvedValue({ id: 7, timeline: [] });

    const response = await GET(new Request("http://localhost/api/properties?id=7"));
    expect(await response.json()).toEqual({ property: { id: 7, timeline: [] } });
    expect(repositoryMocks.getPropertyDetailById).toHaveBeenCalledWith(7);
  });
});
