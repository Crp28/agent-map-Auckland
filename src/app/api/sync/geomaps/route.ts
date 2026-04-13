import { syncCouncilAreaBoundaries } from "@/lib/geomaps";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const result = await syncCouncilAreaBoundaries();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
