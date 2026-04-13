import { createOrUpdatePerson, deletePersonById, listPeopleRecords, updatePersonById } from "@/lib/repository";
import { personInputSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const idSchema = z.coerce.number().int().positive();

export async function GET() {
  const people = await listPeopleRecords();
  return NextResponse.json({ people });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = personInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const person = await createOrUpdatePerson(parsed.data);
  return NextResponse.json({ person }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = personInputSchema.and(z.object({ id: idSchema })).safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const person = await updatePersonById(parsed.data.id, parsed.data);
    if (!person) {
      return NextResponse.json({ error: "Person not found." }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch {
    return NextResponse.json({ error: "Person could not be updated." }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsed = idSchema.safeParse(url.searchParams.get("id"));

  if (!parsed.success) {
    return NextResponse.json({ error: "A valid person id is required." }, { status: 400 });
  }

  const deleted = await deletePersonById(parsed.data);
  if (!deleted) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
