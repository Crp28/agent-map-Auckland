import { describe, expect, it } from "vitest";

import {
  parseOwnerAuditSession,
  serializeOwnerAuditSession,
} from "./owner-audit-session";

describe("owner audit session helpers", () => {
  it("round-trips a valid owner audit session", () => {
    const raw = serializeOwnerAuditSession({
      allAddressIds: [4, 9],
      nextIndex: 1,
      results: [
        {
          personId: 2,
          addressId: 4,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          status: "mismatch",
          propertySmartsOwners: ["John Smith"],
          matchedOwner: null,
        },
      ],
      startedAt: "2026-05-12T00:00:00.000Z",
    });

    expect(parseOwnerAuditSession(raw, [4, 9])).toEqual({
      allAddressIds: [4, 9],
      nextIndex: 1,
      results: [
        {
          personId: 2,
          addressId: 4,
          streetAddress: "1 Queen Street",
          suburb: "Auckland Central",
          status: "mismatch",
          propertySmartsOwners: ["John Smith"],
          matchedOwner: null,
        },
      ],
      startedAt: "2026-05-12T00:00:00.000Z",
    });
  });

  it("rejects sessions that no longer match the address list", () => {
    const raw = serializeOwnerAuditSession({
      allAddressIds: [4, 9],
      nextIndex: 1,
      results: [],
      startedAt: "2026-05-12T00:00:00.000Z",
    });

    expect(parseOwnerAuditSession(raw, [4, 8])).toBeNull();
  });
});
