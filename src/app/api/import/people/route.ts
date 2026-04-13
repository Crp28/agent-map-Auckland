import { importPeopleCsv } from "@/lib/csv-import";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Only .csv files are accepted." }, { status: 400 });
  }

  const summary = await importPeopleCsv(await file.text());
  return NextResponse.json({ summary });
}
