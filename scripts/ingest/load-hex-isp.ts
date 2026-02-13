/**
 * load-hex-isp.ts
 *
 * Reads hex-level ISP coverage CSV files from data/Map_Data_CSV/ and
 * batch-inserts into the hex_isp_coverage table.
 *
 * Usage: npx tsx scripts/ingest/load-hex-isp.ts
 */

import postgres from "postgres";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { resolve } from "path";
import { readdirSync } from "fs";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ispbyaddress";

const BATCH_SIZE = 5_000;
const LOG_INTERVAL = 50_000;

const DATA_DIR = resolve(__dirname, "../../data/Map_Data_CSV");

interface HexISPRow {
  HEXUID_4: string;
  ISP_Name: string;
  Tech_EN: string;
  Tech_FR: string;
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[load-hex-isp] Starting hex ISP coverage ingestion...");
  console.log(`[load-hex-isp] Data directory: ${DATA_DIR}`);

  let totalInserted = 0;
  let batch: HexISPRow[] = [];

  const csvFiles = readdirSync(DATA_DIR).filter(
    (f) => f.toLowerCase().endsWith(".csv")
  );

  if (csvFiles.length === 0) {
    console.error(`[load-hex-isp] No CSV files found in ${DATA_DIR}`);
    await sql.end();
    process.exit(1);
  }

  console.log(
    `[load-hex-isp] Found ${csvFiles.length} CSV file(s): ${csvFiles.join(", ")}`
  );

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;

    const rows = batch.map((r) => ({
      hexuid: r.HEXUID_4,
      provider_name: r.ISP_Name,
      technology_en: r.Tech_EN,
      technology_fr: r.Tech_FR,
    }));

    await sql`
      INSERT INTO hex_isp_coverage (
        hexuid, provider_name, technology_en, technology_fr
      )
      SELECT
        v.hexuid,
        v.provider_name,
        v.technology_en,
        v.technology_fr
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(
        hexuid TEXT,
        provider_name TEXT,
        technology_en TEXT,
        technology_fr TEXT
      )
    `;

    totalInserted += batch.length;
    batch = [];

    if (totalInserted % LOG_INTERVAL < BATCH_SIZE) {
      console.log(
        `[load-hex-isp] Progress: ${totalInserted.toLocaleString()} rows inserted`
      );
    }
  }

  try {
    for (const csvFile of csvFiles) {
      const filePath = resolve(DATA_DIR, csvFile);
      console.log(`[load-hex-isp] Processing: ${csvFile}`);

      await new Promise<void>((resolvePromise, reject) => {
        const stream = createReadStream(filePath)
          .pipe(
            parse({
              columns: true,
              skip_empty_lines: true,
              trim: true,
              bom: true,
            })
          )
          .on("data", (row: HexISPRow) => {
            batch.push(row);
            if (batch.length >= BATCH_SIZE) {
              stream.pause();
              flushBatch()
                .then(() => stream.resume())
                .catch(reject);
            }
          })
          .on("end", () => {
            flushBatch().then(resolvePromise).catch(reject);
          })
          .on("error", reject);
      });

      console.log(`[load-hex-isp] Finished file: ${csvFile}`);
    }

    console.log(
      `[load-hex-isp] Done. Total rows inserted: ${totalInserted.toLocaleString()}`
    );
  } catch (error) {
    console.error("[load-hex-isp] Error during ingestion:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
