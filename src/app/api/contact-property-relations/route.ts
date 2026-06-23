import { deleteContactPropertyRelationById } from "@/lib/repository";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const idSchema = z.coerce.number().int().positive();

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsed = idSchema.safeParse(url.searchParams.get("id"));

  if (!parsed.success) {
    return NextResponse.json({ error: "A valid relation id is required." }, { status: 400 });
  }

  const deleted = await deleteContactPropertyRelationById(parsed.data);
  if (!deleted) {
    return NextResponse.json({ error: "Relation not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
