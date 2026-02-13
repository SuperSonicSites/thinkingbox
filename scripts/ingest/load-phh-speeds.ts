/**
 * load-phh-speeds.ts
 *
 * Reads NBD PHH speed CSV files from data/NBD_PHH_Speeds/ and batch-inserts
 * into the phh_coverage_snapshots table.
 *
 * Boolean columns in the CSV are "1" or "0" strings that map to true/false.
 *
 * Usage: npx tsx scripts/ingest/load-phh-speeds.ts
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

const DATA_DIR = resolve(__dirname, "../../data/NBD_PHH_Speeds");

// Boolean columns in the CSV that use "1"/"0" encoding
const BOOLEAN_COLUMNS = [
  "combined_lt5_1",
  "wired_lt5_1",
  "wireless_lt5_1",
  "combined_5_1",
  "wired_5_1",
  "wireless_5_1",
  "combined_10_2",
  "wired_10_2",
  "wireless_10_2",
  "combined_25_5",
  "wired_25_5",
  "wireless_25_5",
  "combined_50_10",
  "wired_50_10",
  "wireless_50_10",
  "avail_lte_mobile",
] as const;

interface SpeedRow {
  PHH_ID: string;
  dataset_variant?: string;
  combined_lt5_1: string;
  wired_lt5_1: string;
  wireless_lt5_1: string;
  combined_5_1: string;
  wired_5_1: string;
  wireless_5_1: string;
  combined_10_2: string;
  wired_10_2: string;
  wireless_10_2: string;
  combined_25_5: string;
  wired_25_5: string;
  wireless_25_5: string;
  combined_50_10: string;
  wired_50_10: string;
  wireless_50_10: string;
  avail_lte_mobile: string;
  combined_max_threshold: string;
  wired_max_threshold: string;
  wireless_max_threshold: string;
  satellite_max_threshold: string;
}

function toBool(val: string): boolean {
  return val === "1" || val?.toLowerCase() === "true";
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[load-phh-speeds] Starting PHH speed data ingestion...");
  console.log(`[load-phh-speeds] Data directory: ${DATA_DIR}`);

  let totalInserted = 0;
  let batch: SpeedRow[] = [];

  const csvFiles = readdirSync(DATA_DIR).filter(
    (f) => f.toLowerCase().endsWith(".csv")
  );

  if (csvFiles.length === 0) {
    console.error(`[load-phh-speeds] No CSV files found in ${DATA_DIR}`);
    await sql.end();
    process.exit(1);
  }

  console.log(
    `[load-phh-speeds] Found ${csvFiles.length} CSV file(s): ${csvFiles.join(", ")}`
  );

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;

    const rows = batch.map((r) => ({
      phh_id: parseInt(r.PHH_ID, 10),
      dataset_variant: r.dataset_variant || "current",
      combined_lt5_1: toBool(r.combined_lt5_1),
      wired_lt5_1: toBool(r.wired_lt5_1),
      wireless_lt5_1: toBool(r.wireless_lt5_1),
      combined_5_1: toBool(r.combined_5_1),
      wired_5_1: toBool(r.wired_5_1),
      wireless_5_1: toBool(r.wireless_5_1),
      combined_10_2: toBool(r.combined_10_2),
      wired_10_2: toBool(r.wired_10_2),
      wireless_10_2: toBool(r.wireless_10_2),
      combined_25_5: toBool(r.combined_25_5),
      wired_25_5: toBool(r.wired_25_5),
      wireless_25_5: toBool(r.wireless_25_5),
      combined_50_10: toBool(r.combined_50_10),
      wired_50_10: toBool(r.wired_50_10),
      wireless_50_10: toBool(r.wireless_50_10),
      avail_lte_mobile: toBool(r.avail_lte_mobile),
      combined_max_threshold: r.combined_max_threshold || "",
      wired_max_threshold: r.wired_max_threshold || "",
      wireless_max_threshold: r.wireless_max_threshold || "",
      satellite_max_threshold: r.satellite_max_threshold || "",
    }));

    await sql`
      INSERT INTO phh_coverage_snapshots (
        phh_id, dataset_variant,
        combined_lt5_1, wired_lt5_1, wireless_lt5_1,
        combined_5_1, wired_5_1, wireless_5_1,
        combined_10_2, wired_10_2, wireless_10_2,
        combined_25_5, wired_25_5, wireless_25_5,
        combined_50_10, wired_50_10, wireless_50_10,
        avail_lte_mobile,
        combined_max_threshold, wired_max_threshold,
        wireless_max_threshold, satellite_max_threshold
      )
      SELECT
        v.phh_id,
        v.dataset_variant,
        v.combined_lt5_1,
        v.wired_lt5_1,
        v.wireless_lt5_1,
        v.combined_5_1,
        v.wired_5_1,
        v.wireless_5_1,
        v.combined_10_2,
        v.wired_10_2,
        v.wireless_10_2,
        v.combined_25_5,
        v.wired_25_5,
        v.wireless_25_5,
        v.combined_50_10,
        v.wired_50_10,
        v.wireless_50_10,
        v.avail_lte_mobile,
        v.combined_max_threshold,
        v.wired_max_threshold,
        v.wireless_max_threshold,
        v.satellite_max_threshold
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(
        phh_id BIGINT,
        dataset_variant TEXT,
        combined_lt5_1 BOOLEAN,
        wired_lt5_1 BOOLEAN,
        wireless_lt5_1 BOOLEAN,
        combined_5_1 BOOLEAN,
        wired_5_1 BOOLEAN,
        wireless_5_1 BOOLEAN,
        combined_10_2 BOOLEAN,
        wired_10_2 BOOLEAN,
        wireless_10_2 BOOLEAN,
        combined_25_5 BOOLEAN,
        wired_25_5 BOOLEAN,
        wireless_25_5 BOOLEAN,
        combined_50_10 BOOLEAN,
        wired_50_10 BOOLEAN,
        wireless_50_10 BOOLEAN,
        avail_lte_mobile BOOLEAN,
        combined_max_threshold TEXT,
        wired_max_threshold TEXT,
        wireless_max_threshold TEXT,
        satellite_max_threshold TEXT
      )
    `;

    totalInserted += batch.length;
    batch = [];

    if (totalInserted % LOG_INTERVAL < BATCH_SIZE) {
      console.log(
        `[load-phh-speeds] Progress: ${totalInserted.toLocaleString()} rows inserted`
      );
    }
  }

  try {
    for (const csvFile of csvFiles) {
      const filePath = resolve(DATA_DIR, csvFile);
      console.log(`[load-phh-speeds] Processing: ${csvFile}`);

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
          .on("data", (row: SpeedRow) => {
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

      console.log(`[load-phh-speeds] Finished file: ${csvFile}`);
    }

    console.log(
      `[load-phh-speeds] Done. Total rows inserted: ${totalInserted.toLocaleString()}`
    );
  } catch (error) {
    console.error("[load-phh-speeds] Error during ingestion:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
