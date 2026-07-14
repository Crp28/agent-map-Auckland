import { findNearbyPeople } from "@/lib/repository";
import { nearbySchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = nearbySchema.safeParse({
    propertyId: url.searchParams.get("propertyId"),
    distanceKm: url.searchParams.get("distanceKm") ?? undefined,
    suburbs: url.searchParams.getAll("suburbs"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = await findNearbyPeople(parsed.data);
  return NextResponse.json(data);
}
