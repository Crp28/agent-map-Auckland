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

export type ImportPeopleCsvOptions = {
  geocode?: boolean;
};

const appRequiredColumns = ["name", "streetAddress", "suburb", "phone", "email"];
const contactExportColumns = ["Contact Type", "First Name", "Last Name", "Preferred Name", "Email"];

function hasColumns(row: CsvRow | undefined, columns: string[]) {
  return Boolean(row && columns.every((column) => column in row));
}

function fullName(row: CsvRow) {
  const preferredName = row["Preferred Name"]?.trim();
  const legalName = row["Legal Name"]?.trim();
  const firstName = row["First Name"]?.trim();
  const lastName = row["Last Name"]?.trim();
  return preferredName || [firstName, lastName].filter(Boolean).join(" ") || legalName || "";
}

function normalizeCsvRow(row: CsvRow) {
  if ("Contact Type" in row) {
    if (row["Contact Type"]?.trim() !== "Person") {
      return {
        normalized: null,
        skipReason: "Only Contact Type = Person rows are imported as People.",
      };
    }

    return {
      normalized: {
        name: fullName(row),
        streetAddress: row.Address?.trim() || row["Postal Address"]?.trim() || "",
        suburb: row.Suburb?.trim() || row["Postal Suburb"]?.trim() || "",
        phone: row.Mobile?.trim() || row.Phone?.trim() || row["Work Phone"]?.trim() || "",
        email: row.Email?.trim() || "",
        purchasingPowerMin: row.purchasingPowerMin?.trim() || "",
        purchasingPowerMax: row.purchasingPowerMax?.trim() || "",
        latitude: row.latitude?.trim() || "",
        longitude: row.longitude?.trim() || "",
      },
      skipReason: null,
    };
  }

  return {
    normalized: row,
    skipReason: null,
  };
}

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

export async function importPeopleCsv(
  csvContent: string,
  options: ImportPeopleCsvOptions = {},
): Promise<ImportSummary> {
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

  const firstRow = rows[0];
  const isAppFormat = hasColumns(firstRow, appRequiredColumns);
  const isContactExportFormat = hasColumns(firstRow, contactExportColumns);

  if (!isAppFormat && !isContactExportFormat) {
    summary.failed = rows.length;
    summary.errors.push({
      row: 1,
      message:
        "Missing required People import columns. Expected app columns or the contact-export format.",
    });
    return summary;
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const { normalized, skipReason } = normalizeCsvRow(row);
    if (!normalized) {
      summary.failed += 1;
      summary.errors.push({ row: rowNumber, message: skipReason ?? "Row could not be imported." });
      continue;
    }

    const parsed = personInputSchema.safeParse(normalized);
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
    const comparable = JSON.stringify(comparableInput(normalized));

    if (before === comparable) {
      summary.duplicates += 1;
      continue;
    }

    await createOrUpdatePerson(parsed.data, { geocode: options.geocode });
    if (existing) {
      summary.updated += 1;
    } else {
      summary.imported += 1;
    }
  }

  return summary;
}
