import { describe, expect, it } from "vitest";

import {
  parseCoordinateAuditSession,
  serializeCoordinateAuditSession,
} from "./coordinate-audit-session";

describe("coordinate audit session", () => {
  it("restores a saved session when the address list matches", () => {
    const raw = serializeCoordinateAuditSession({
      allAddressIds: [1, 2, 3],
      nextIndex: 2,
      startedAt: "2026-04-28T00:00:00.000Z",
      results: [
        {
          personId: 10,
          addressId: 1,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          status: "ok",
          matchedAddress: "1 Queen Street Auckland Central",
          distanceKm: 0,
        },
      ],
    });

    const restored = parseCoordinateAuditSession(raw, [1, 2, 3]);

    expect(restored?.nextIndex).toBe(2);
    expect(restored?.results).toHaveLength(1);
  });

  it("rejects a session when the address list has changed", () => {
    const raw = serializeCoordinateAuditSession({
      allAddressIds: [1, 2, 3],
      nextIndex: 2,
      startedAt: "2026-04-28T00:00:00.000Z",
      results: [],
    });

    expect(parseCoordinateAuditSession(raw, [1, 2, 4])).toBeNull();
  });
});
