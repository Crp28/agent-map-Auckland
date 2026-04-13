import { createOrUpdateSoldProperty } from "@/lib/repository";
import { soldPropertyInputSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = soldPropertyInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const soldProperty = await createOrUpdateSoldProperty(parsed.data);
  return NextResponse.json({ soldProperty }, { status: 201 });
}
