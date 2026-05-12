import type { PersonOwnerAuditResult } from "@/types/location";

export const PERSON_OWNER_AUDIT_SESSION_KEY = "people-owner-audit-session-v1";

type OwnerAuditSession = {
  allAddressIds: number[];
  nextIndex: number;
  results: PersonOwnerAuditResult[];
  startedAt: string;
};

function isResult(value: unknown): value is PersonOwnerAuditResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.addressId === "number" &&
    typeof candidate.personId === "number" &&
    typeof candidate.streetAddress === "string" &&
    typeof candidate.suburb === "string" &&
    Array.isArray(candidate.propertySmartsOwners) &&
    candidate.propertySmartsOwners.every((item) => typeof item === "string") &&
    (candidate.matchedOwner === null || typeof candidate.matchedOwner === "string") &&
    (candidate.status === "match" ||
      candidate.status === "mismatch" ||
      candidate.status === "not_found" ||
      candidate.status === "unverified" ||
      candidate.status === "auth_expired")
  );
}

export function parseOwnerAuditSession(raw: string | null, allAddressIds: number[]) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OwnerAuditSession>;
    if (
      !Array.isArray(parsed.allAddressIds) ||
      !Array.isArray(parsed.results) ||
      typeof parsed.nextIndex !== "number" ||
      parsed.allAddressIds.length !== allAddressIds.length ||
      parsed.allAddressIds.some((addressId, index) => addressId !== allAddressIds[index]) ||
      parsed.nextIndex < 0 ||
      parsed.nextIndex > parsed.allAddressIds.length ||
      parsed.results.some((result) => !isResult(result))
    ) {
      return null;
    }

    return {
      allAddressIds: parsed.allAddressIds,
      nextIndex: parsed.nextIndex,
      results: parsed.results as PersonOwnerAuditResult[],
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
    } satisfies OwnerAuditSession;
  } catch {
    return null;
  }
}

export function serializeOwnerAuditSession(session: OwnerAuditSession) {
  return JSON.stringify(session);
}
