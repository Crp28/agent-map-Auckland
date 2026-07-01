import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  createInteraction: vi.fn(),
  listPersonInteractions: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

import { GET, POST } from "./route";

describe("/api/interactions", () => {
  beforeEach(() => {
    repositoryMocks.createInteraction.mockReset();
    repositoryMocks.listPersonInteractions.mockReset();
  });

  it("filters interactions by person and date range", async () => {
    repositoryMocks.listPersonInteractions.mockResolvedValue([{ id: 1 }]);

    const response = await GET(
      new Request("http://localhost/api/interactions?personId=3&from=2026-01-01&to=2026-06-30"),
    );

    expect(await response.json()).toEqual({ interactions: [{ id: 1 }] });
    expect(repositoryMocks.listPersonInteractions).toHaveBeenCalledWith(3, {
      from: "2026-01-01",
      to: "2026-06-30",
    });
  });

  it("creates an interaction with an optional property", async () => {
    repositoryMocks.createInteraction.mockResolvedValue({ id: 9 });
    const request = new Request("http://localhost/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId: 3,
        propertyId: 4,
        interactionType: "inspection",
        interactionDate: "2026-06-20",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(repositoryMocks.createInteraction).toHaveBeenCalledWith({
      personId: 3,
      propertyId: 4,
      interactionType: "inspection",
      interactionDate: "2026-06-20",
    });
  });
});
