/**
 * load-phh-points.ts
 *
 * Reads PHH coordinate CSV files from data/PHH_ID_2021/ and batch-inserts
 * into the phh_points table with PostGIS geometry.
 *
 * Usage: npx tsx scripts/ingest/load-phh-points.ts
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

const DATA_DIR = resolve(__dirname, "../../data/PHH_ID_2021");

interface PHHRow {
  PHH_ID: string;
  Type: string;
  Pop_2021: string;
  Total_Dwellings_2021: string;
  Usual_Res_Dwellings_2021: string;
  DBUID: string;
  HEXUID_4: string;
  Prov: string;
  Latitude: string;
  Longitude: string;
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[load-phh-points] Starting PHH points ingestion...");
  console.log(`[load-phh-points] Data directory: ${DATA_DIR}`);

  let totalInserted = 0;
  let batch: PHHRow[] = [];

  const csvFiles = readdirSync(DATA_DIR).filter(
    (f) => f.toLowerCase().endsWith(".csv")
  );

  if (csvFiles.length === 0) {
    console.error(`[load-phh-points] No CSV files found in ${DATA_DIR}`);
    await sql.end();
    process.exit(1);
  }

  console.log(
    `[load-phh-points] Found ${csvFiles.length} CSV file(s): ${csvFiles.join(", ")}`
  );

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;

    const rows = batch.map((r) => ({
      phh_id: parseInt(r.PHH_ID, 10),
      type: r.Type ? parseInt(r.Type, 10) : null,
      pop_2021: r.Pop_2021 || null,
      total_dwellings_2021: r.Total_Dwellings_2021 || null,
      usual_res_dwellings_2021: r.Usual_Res_Dwellings_2021 || null,
      dbuid: r.DBUID || null,
      hexuid: r.HEXUID_4,
      province_code: r.Prov,
      latitude: parseFloat(r.Latitude),
      longitude: parseFloat(r.Longitude),
    }));

    await sql`
      INSERT INTO phh_points (
        phh_id, type, pop_2021, total_dwellings_2021, usual_res_dwellings_2021,
        dbuid, hexuid, province_code, latitude, longitude, geometry
      )
      SELECT
        v.phh_id,
        v.type,
        v.pop_2021,
        v.total_dwellings_2021,
        v.usual_res_dwellings_2021,
        v.dbuid,
        v.hexuid,
        v.province_code,
        v.latitude,
        v.longitude,
        ST_SetSRID(ST_MakePoint(v.longitude, v.latitude), 4326)::geography
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(
        phh_id BIGINT,
        type SMALLINT,
        pop_2021 NUMERIC(12,4),
        total_dwellings_2021 NUMERIC(12,4),
        usual_res_dwellings_2021 NUMERIC(12,4),
        dbuid TEXT,
        hexuid TEXT,
        province_code TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION
      )
      ON CONFLICT (phh_id) DO NOTHING
    `;

    totalInserted += batch.length;
    batch = [];

    if (totalInserted % LOG_INTERVAL < BATCH_SIZE) {
      console.log(
        `[load-phh-points] Progress: ${totalInserted.toLocaleString()} rows inserted`
      );
    }
  }

  try {
    for (const csvFile of csvFiles) {
      const filePath = resolve(DATA_DIR, csvFile);
      console.log(`[load-phh-points] Processing: ${csvFile}`);

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
          .on("data", (row: PHHRow) => {
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

      console.log(`[load-phh-points] Finished file: ${csvFile}`);
    }

    console.log(
      `[load-phh-points] Done. Total rows inserted: ${totalInserted.toLocaleString()}`
    );
  } catch (error) {
    console.error("[load-phh-points] Error during ingestion:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
