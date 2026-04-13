import { findSuburbCenter } from "@/lib/geomaps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.trim();

  if (!name) {
    return NextResponse.json({ error: "Suburb name is required." }, { status: 400 });
  }

  const center = await findSuburbCenter(name);
  if (!center) {
    return NextResponse.json({ center: null });
  }

  return NextResponse.json({
    center: [center.longitude, center.latitude],
    sampleSize: center.sampleSize,
  });
}
