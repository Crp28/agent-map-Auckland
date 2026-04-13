import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/import/people", () => {
  it("rejects non-csv files", async () => {
    const response = await POST({
      formData: async () => ({
        get: () => new File(["name"], "people.txt", { type: "text/plain" }),
      }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Only .csv files are accepted." });
  });
});
