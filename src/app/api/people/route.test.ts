import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/people", () => {
  it("returns field errors for invalid input", async () => {
    const response = await POST(
      new Request("http://localhost/api/people", {
        method: "POST",
        body: JSON.stringify({
          name: "Ana Buyer",
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          phone: "021 000 000",
          email: "invalid",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.fieldErrors.email).toBeDefined();
  });
});
