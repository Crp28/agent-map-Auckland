import { createOrUpdatePerson } from "@/lib/repository";
import { personInputSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = personInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const person = await createOrUpdatePerson(parsed.data);
  return NextResponse.json({ person }, { status: 201 });
}
