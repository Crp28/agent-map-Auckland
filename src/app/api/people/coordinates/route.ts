import {
  auditPersonAddressCoordinates,
  googleGeocodeMissingPersonAddresses,
  refreshPersonAddressCoordinates,
  retryPersonAddressGeocode,
} from "@/lib/repository";
import { isGoogleMapsFallbackConfigured } from "@/lib/google-maps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const addressIdsSchema = z.array(z.coerce.number().int().positive()).min(1).max(20);
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("audit"),
    addressIds: addressIdsSchema,
  }),
  z.object({
    action: z.literal("refresh"),
    addressIds: addressIdsSchema,
  }),
  z.object({
    action: z.literal("retry"),
    addressId: z.coerce.number().int().positive(),
  }),
  z.object({
    action: z.literal("google-missing"),
    addressIds: addressIdsSchema,
  }),
]);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.action === "audit") {
      const results = await auditPersonAddressCoordinates(parsed.data.addressIds);
      return NextResponse.json({ results });
    }

    if (parsed.data.action === "refresh") {
      const refreshedAddressIds = await refreshPersonAddressCoordinates(parsed.data.addressIds);
      return NextResponse.json({ refreshedAddressIds });
    }

    if (parsed.data.action === "google-missing") {
      if (!isGoogleMapsFallbackConfigured()) {
        return NextResponse.json({ error: "Google Maps fallback is not configured." }, { status: 503 });
      }

      const results = await googleGeocodeMissingPersonAddresses(parsed.data.addressIds);
      return NextResponse.json({ results });
    }

    const result = await retryPersonAddressGeocode(parsed.data.addressId);
    if (!result) {
      return NextResponse.json({ error: "Person address not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "People coordinate action failed.",
      },
      { status: 500 },
    );
  }
}
