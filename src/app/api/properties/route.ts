import { getPropertyDetailById, listPropertyRecords } from "@/lib/repository";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const idSchema = z.coerce.number().int().positive();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id === null) {
    return NextResponse.json({ properties: await listPropertyRecords() });
  }

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid property id is required." }, { status: 400 });
  }

  const property = await getPropertyDetailById(parsed.data);
  if (!property) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  return NextResponse.json({ property });
}
