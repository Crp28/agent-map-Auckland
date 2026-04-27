import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/people/coordinates", () => {
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
});
