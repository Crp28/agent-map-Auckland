import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/search", () => {
  it("returns an empty result set for blank search", async () => {
    const response = await GET(new Request("http://localhost/api/search?q="));
    const payload = await response.json();

    expect(payload).toEqual({ results: [] });
  });
});
