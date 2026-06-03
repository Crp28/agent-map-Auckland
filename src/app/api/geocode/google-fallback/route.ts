import { googleGeocodeAddress } from "@/lib/google-maps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const fallbackSchema = z.object({
  streetAddress: z.string().trim().min(1, "Street address is required."),
  suburb: z.string().trim().min(1, "Suburb is required."),
});

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = fallbackSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await googleGeocodeAddress(parsed.data.streetAddress, parsed.data.suburb);
    if (!result) {
      return NextResponse.json({ error: "Google Maps could not find coordinates for this address." }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Maps fallback could not be used.";
    const status = message === "Google Maps fallback is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
