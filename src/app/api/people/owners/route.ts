import { deletePersonAddressRows } from "@/lib/repository";
import {
  auditPersonAddressOwners,
  closePropertySmartsOwnerAuditSession,
} from "@/lib/propertysmarts-owner-audit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const addressIdsSchema = z.array(z.coerce.number().int().positive()).min(1).max(8);
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("audit"),
    addressIds: addressIdsSchema,
  }),
  z.object({
    action: z.literal("delete"),
    addressIds: z.array(z.coerce.number().int().positive()).min(1),
  }),
  z.object({
    action: z.literal("finish"),
  }),
]);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.action === "audit") {
      const results = await auditPersonAddressOwners(parsed.data.addressIds);
      return NextResponse.json({ results });
    }

    if (parsed.data.action === "delete") {
      const deleted = await deletePersonAddressRows(parsed.data.addressIds);
      return NextResponse.json(deleted);
    }

    await closePropertySmartsOwnerAuditSession();
    return NextResponse.json({ closed: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "People owner audit action failed.",
      },
      { status: 500 },
    );
  }
}
