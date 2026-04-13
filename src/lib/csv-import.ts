import { parse } from "csv-parse/sync";
import { createOrUpdatePerson, getRawPeopleByIdentity } from "@/lib/repository";
import { normalizeKey } from "@/lib/normalize";
import { personInputSchema } from "@/lib/validation";

type CsvRow = Record<string, string | undefined>;

export type ImportSummary = {
  imported: number;
  updated: number;
  duplicates: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

const requiredColumns = ["name", "streetAddress", "suburb", "phone", "email"];

function comparableInput(row: CsvRow) {
  return {
    name: row.name?.trim() ?? "",
    streetAddress: row.streetAddress?.trim() ?? "",
    suburb: row.suburb?.trim() ?? "",
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim().toLowerCase() ?? "",
    purchasingPowerMin: row.purchasingPowerMin?.trim() || null,
    purchasingPowerMax: row.purchasingPowerMax?.trim() || null,
    latitude: row.latitude?.trim() || null,
    longitude: row.longitude?.trim() || null,
  };
}

function comparableExisting(row: Record<string, unknown>) {
  return {
    name: String(row.name ?? ""),
    streetAddress: String(row.street_address ?? ""),
    suburb: String(row.suburb ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    purchasingPowerMin:
      row.purchasing_power_min === null || row.purchasing_power_min === undefined
        ? null
        : String(row.purchasing_power_min),
    purchasingPowerMax:
      row.purchasing_power_max === null || row.purchasing_power_max === undefined
        ? null
        : String(row.purchasing_power_max),
    latitude: row.latitude === null || row.latitude === undefined ? null : String(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : String(row.longitude),
  };
}

export async function importPeopleCsv(csvContent: string): Promise<ImportSummary> {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  const summary: ImportSummary = {
    imported: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
  };

  for (const column of requiredColumns) {
    if (!rows[0] || !(column in rows[0])) {
      summary.failed = rows.length;
      summary.errors.push({ row: 1, message: `Missing required column: ${column}` });
      return summary;
    }
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const parsed = personInputSchema.safeParse(row);
    if (!parsed.success) {
      summary.failed += 1;
      summary.errors.push({
        row: rowNumber,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    const identityKey = normalizeKey(parsed.data.name, parsed.data.streetAddress, parsed.data.suburb);
    const existing = getRawPeopleByIdentity(identityKey) as Record<string, unknown> | undefined;
    const before = existing ? JSON.stringify(comparableExisting(existing)) : null;
    const comparable = JSON.stringify(comparableInput(row));

    if (before === comparable) {
      summary.duplicates += 1;
      continue;
    }

    await createOrUpdatePerson(parsed.data);
    if (existing) {
      summary.updated += 1;
    } else {
      summary.imported += 1;
    }
  }

  return summary;
}
