import { getMapData } from "@/lib/repository";
import { ensureRecentCouncilAreaBoundaries } from "@/lib/geomaps";
import { mapFilterSchema } from "@/lib/validation";
import { subYears } from "date-fns";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

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

  const today = new Date();
  const data = await getMapData({
    from: parsed.data.from ?? dateOnly(subYears(today, 1)),
    to: parsed.data.to ?? dateOnly(today),
    price: parsed.data.price,
  });

  return NextResponse.json(data);
}
