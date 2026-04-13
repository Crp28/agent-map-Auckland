import { searchRecords } from "@/lib/repository";
import { searchSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({ q: url.searchParams.get("q") ?? "" });

  if (!parsed.success) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchRecords(parsed.data.q);
  return NextResponse.json({ results });
}
