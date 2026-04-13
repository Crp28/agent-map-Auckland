import { readFileSync } from "node:fs";
import { importPeopleCsv } from "../src/lib/csv-import";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run import:people -- <path-to-csv>");
    process.exitCode = 1;
    return;
  }

  const summary = await importPeopleCsv(readFileSync(filePath, "utf8"), { geocode: false });
  console.log(JSON.stringify(summary, null, 2));

  if (summary.imported === 0 && summary.updated === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
