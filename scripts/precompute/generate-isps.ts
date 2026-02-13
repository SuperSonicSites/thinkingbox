/**
 * Pre-compute ISP lookup files from the ISED ISP_Hex_FSI.csv data.
 *
 * Streams the CSV line by line, groups ISP entries by hexuid,
 * and writes isps/{hexuid}.json files.
 *
 * CSV source: Map_Data_CSV/ISP_Hex_FSI.csv (~426K rows)
 * Header: "HEXuid_HEXidu","Name_Nom","Technology","Technologie"
 *
 * Run:
 *   npx tsx scripts/precompute/generate-isps.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

interface ISPEntry {
  name: string;
  tech_en: string;
  tech_fr: string;
}

const CSV_PATH = path.resolve(
  __dirname,
  "../../Map_Data_CSV/ISP_Hex_FSI.csv",
);
const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");

/**
 * Parse a single CSV line where every field is double-quoted.
 * Handles fields that may contain commas or escaped quotes ("") inside.
 */
function parseQuotedCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i < line.length) {
    // Skip whitespace between fields
    while (i < line.length && line[i] === " ") {
      i++;
    }

    if (i >= line.length) {
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let field = "";
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      // Skip comma after closing quote
      if (i < line.length && line[i] === ",") {
        i++;
      }
    } else {
      // Unquoted field (fallback — not expected for this CSV but safe)
      let field = "";
      while (i < line.length && line[i] !== ",") {
        field += line[i];
        i++;
      }
      fields.push(field);
      // Skip comma
      if (i < line.length && line[i] === ",") {
        i++;
      }
    }
  }

  return fields;
}

/**
 * Strip a UTF-8 BOM character from the beginning of a string if present.
 */
function stripBOM(value: string): string {
  if (value.charCodeAt(0) === 0xfeff) {
    return value.slice(1);
  }
  return value;
}

async function main(): Promise<void> {
  console.log("Starting ISP file generation from CSV...");
  console.log(`CSV source: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
  }

  // Ensure output directory exists
  const ispsDir = path.join(OUTPUT_DIR, "isps");
  fs.mkdirSync(ispsDir, { recursive: true });

  const hexMap = new Map<string, ISPEntry[]>();

  const fileStream = fs.createReadStream(CSV_PATH, { encoding: "utf-8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let dataRows = 0;
  let headerSkipped = false;

  for await (const rawLine of rl) {
    lineNumber++;

    // Strip BOM from the very first line
    const line = lineNumber === 1 ? stripBOM(rawLine) : rawLine;

    // Skip empty lines
    if (line.trim().length === 0) {
      continue;
    }

    // Skip header row
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const fields = parseQuotedCSVLine(line);

    if (fields.length < 4) {
      console.warn(
        `Line ${lineNumber}: expected 4 fields, got ${fields.length} — skipping`,
      );
      continue;
    }

    const hexuid = fields[0];
    const name = fields[1];
    const techEn = fields[2];
    const techFr = fields[3];

    if (!hexuid) {
      console.warn(`Line ${lineNumber}: empty hexuid — skipping`);
      continue;
    }

    const entry: ISPEntry = {
      name,
      tech_en: techEn,
      tech_fr: techFr,
    };

    const existing = hexMap.get(hexuid);
    if (existing) {
      existing.push(entry);
    } else {
      hexMap.set(hexuid, [entry]);
    }

    dataRows++;

    if (dataRows % 100_000 === 0) {
      console.log(`Read ${dataRows} data rows...`);
    }
  }

  console.log(`Total data rows read: ${dataRows}`);
  console.log(`Unique hex IDs: ${hexMap.size}`);

  // Write one JSON file per hexuid
  console.log(`Writing ${hexMap.size} ISP files to ${ispsDir}`);
  let written = 0;

  for (const [hexuid, entries] of hexMap) {
    const filePath = path.join(ispsDir, `${hexuid}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entries));
    written++;

    if (written % 10_000 === 0) {
      console.log(`Written ${written}/${hexMap.size} ISP files`);
    }
  }

  console.log(
    `Done. Read ${dataRows} CSV rows, generated ${hexMap.size} ISP files.`,
  );
}

main().catch((err: unknown) => {
  console.error("ISP generation failed:", err);
  process.exit(1);
});
