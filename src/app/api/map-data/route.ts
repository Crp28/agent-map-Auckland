import { getMapData } from "@/lib/repository";
import { ensureRecentCouncilAreaBoundaries } from "@/lib/geomaps";
import { mapFilterSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = mapFilterSchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    price: url.searchParams.get("price") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await ensureRecentCouncilAreaBoundaries();

  const data = await getMapData({
    from: parsed.data.from ?? "0000-01-01",
    to: parsed.data.to ?? "9999-12-31",
    price: parsed.data.price,
  });

  return NextResponse.json(data);
}
