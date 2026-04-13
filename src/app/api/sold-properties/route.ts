import {
  createOrUpdateSoldProperty,
  deleteSoldPropertyById,
  listSoldPropertyRecords,
  updateSoldPropertyById,
} from "@/lib/repository";
import { soldPropertyInputSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const idSchema = z.coerce.number().int().positive();

export async function GET() {
  const soldProperties = await listSoldPropertyRecords();
  return NextResponse.json({ soldProperties });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = soldPropertyInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const soldProperty = await createOrUpdateSoldProperty(parsed.data);
  return NextResponse.json({ soldProperty }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = soldPropertyInputSchema.and(z.object({ id: idSchema })).safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const soldProperty = await updateSoldPropertyById(parsed.data.id, parsed.data);
    if (!soldProperty) {
      return NextResponse.json({ error: "Sold property not found." }, { status: 404 });
    }

    return NextResponse.json({ soldProperty });
  } catch {
    return NextResponse.json({ error: "Sold property could not be updated." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsed = idSchema.safeParse(url.searchParams.get("id"));

  if (!parsed.success) {
    return NextResponse.json({ error: "A valid sold property id is required." }, { status: 400 });
  }

  const deleted = await deleteSoldPropertyById(parsed.data);
  if (!deleted) {
    return NextResponse.json({ error: "Sold property not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
