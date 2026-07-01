import { createInteraction, listPersonInteractions } from "@/lib/repository";
import { interactionFilterSchema, interactionInputSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = interactionFilterSchema.safeParse({
    personId: url.searchParams.get("personId"),
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "A valid person id is required." }, { status: 400 });
  }

  const interactions = await listPersonInteractions(parsed.data.personId, {
    from: parsed.data.from,
    to: parsed.data.to,
  });
  return NextResponse.json({ interactions });
}

export async function POST(request: Request) {
  const parsed = interactionInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const interaction = await createInteraction(parsed.data);
    return NextResponse.json({ interaction }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Interaction could not be saved." }, { status: 409 });
  }
}
