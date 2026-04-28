import type { PersonCoordinateAuditResult } from "@/types/location";

export const PERSON_COORDINATE_AUDIT_SESSION_KEY = "people-coordinate-audit-session-v1";

type CoordinateAuditSession = {
  allAddressIds: number[];
  nextIndex: number;
  results: PersonCoordinateAuditResult[];
  startedAt: string;
};

function isResult(value: unknown): value is PersonCoordinateAuditResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.addressId === "number" &&
    typeof candidate.personId === "number" &&
    typeof candidate.streetAddress === "string" &&
    typeof candidate.suburb === "string" &&
    (candidate.status === "ok" || candidate.status === "mismatch" || candidate.status === "unverified")
  );
}

export function parseCoordinateAuditSession(
  raw: string | null,
  allAddressIds: number[],
) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CoordinateAuditSession>;
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
      results: parsed.results as PersonCoordinateAuditResult[],
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
    } satisfies CoordinateAuditSession;
  } catch {
    return null;
  }
}

export function serializeCoordinateAuditSession(session: CoordinateAuditSession) {
  return JSON.stringify(session);
}
