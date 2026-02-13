/**
 * Pre-compute ISP lookup files from PostGIS hex_isp_coverage data.
 *
 * Groups ISP entries by hexuid and writes isps/{hexuid}.json files.
 *
 * Run locally with PostGIS available:
 *   npx tsx scripts/precompute/generate-isps.ts
 */

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";

interface ISPEntry {
  name: string;
  tech_en: string;
  tech_fr: string;
}

const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/ispbyaddress";

  const sql = postgres(connectionString, { max: 5, idle_timeout: 30 });

  console.log("Starting ISP file generation...");

  // Ensure output dir exists
  fs.mkdirSync(path.join(OUTPUT_DIR, "isps"), { recursive: true });

  const rows = await sql`
    SELECT hexuid, provider_name, technology_en, technology_fr
    FROM hex_isp_coverage
    ORDER BY hexuid, provider_name
  `;

  console.log(`Total hex_isp_coverage rows: ${rows.length}`);

  // Group by hexuid
  const hexMap = new Map<string, ISPEntry[]>();
  for (const row of rows) {
    const hexuid = String(row.hexuid);
    const entry: ISPEntry = {
      name: String(row.provider_name),
      tech_en: String(row.technology_en),
      tech_fr: String(row.technology_fr),
    };

    const existing = hexMap.get(hexuid);
    if (existing) {
      existing.push(entry);
    } else {
      hexMap.set(hexuid, [entry]);
    }
  }

  // Write files
  console.log(`Writing ${hexMap.size} ISP files...`);
  let written = 0;
  for (const [hexuid, entries] of hexMap) {
    const filePath = path.join(OUTPUT_DIR, "isps", `${hexuid}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entries));
    written++;
    if (written % 10000 === 0) {
      console.log(`Written ${written}/${hexMap.size} ISP files`);
    }
  }

  console.log(`Done. Generated ${hexMap.size} ISP files.`);
  await sql.end();
}

main().catch((err) => {
  console.error("ISP generation failed:", err);
  process.exit(1);
});
