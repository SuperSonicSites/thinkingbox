/**
 * Pre-compute geohash cell files from PostGIS PHH data.
 *
 * Reads all PHH points + coverage snapshots + CSD containment from PostGIS,
 * groups by geohash_6, and writes cells/{hash}.json files.
 *
 * Run locally with PostGIS available (one-time per quarterly data refresh):
 *   npx tsx scripts/precompute/generate-cells.ts
 */

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";

// Inline geohash encoder to avoid Astro path aliases in scripts
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = "", bit = 0, ch = 0, isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch |= 1 << (4 - bit); lngMin = mid; } else { lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch |= 1 << (4 - bit); latMin = mid; } else { latMax = mid; }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

interface CellPoint {
  id: string;
  lat: number;
  lng: number;
  hex: string;
  prov: string;
  cov: {
    c: string;
    w: string;
    x: string;
    s: string;
    lte: boolean;
    at: string;
  };
}

interface CellData {
  csd: { uid: string; en: string; fr: string };
  points: CellPoint[];
}

const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");
const BATCH_SIZE = 100_000;

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/ispbyaddress";

  const sql = postgres(connectionString, { max: 5, idle_timeout: 30 });

  console.log("Starting cell generation...");
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Ensure output dir exists
  fs.mkdirSync(path.join(OUTPUT_DIR, "cells"), { recursive: true });

  // Get total count
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM phh_points`;
  console.log(`Total PHH points: ${count}`);

  const cellMap = new Map<string, CellData>();
  let processed = 0;

  // Stream in batches using cursor-based pagination on phh_id
  let lastId = 0;

  while (true) {
    const rows = await sql`
      SELECT
        p.phh_id,
        p.latitude,
        p.longitude,
        p.hexuid,
        p.province_code,
        COALESCE(cs.combined_max_threshold, '') AS c_max,
        COALESCE(cs.wired_max_threshold, '') AS w_max,
        COALESCE(cs.wireless_max_threshold, '') AS x_max,
        COALESCE(cs.satellite_max_threshold, '') AS s_max,
        COALESCE(cs.avail_lte_mobile, false) AS lte,
        COALESCE(cs.ingested_at, NOW()) AS ingested_at,
        csd.csd_uid,
        csd.name_en AS csd_en,
        csd.name_fr AS csd_fr
      FROM phh_points p
      LEFT JOIN phh_coverage_snapshots cs
        ON cs.phh_id = p.phh_id AND cs.dataset_variant = 'current'
      LEFT JOIN census_subdivisions csd
        ON ST_Contains(csd.geometry, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
      WHERE p.phh_id > ${lastId}
      ORDER BY p.phh_id ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (rows.length === 0) break;

    for (const row of rows) {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const geohash = encodeGeohash(lat, lng, 6);

      const point: CellPoint = {
        id: `PHH_${row.phh_id}`,
        lat,
        lng,
        hex: String(row.hexuid),
        prov: String(row.province_code).toLowerCase(),
        cov: {
          c: String(row.c_max),
          w: String(row.w_max),
          x: String(row.x_max),
          s: String(row.s_max),
          lte: Boolean(row.lte),
          at: new Date(row.ingested_at as string).toISOString(),
        },
      };

      let cell = cellMap.get(geohash);
      if (!cell) {
        cell = {
          csd: {
            uid: row.csd_uid ? String(row.csd_uid) : "",
            en: row.csd_en ? String(row.csd_en) : "",
            fr: row.csd_fr ? String(row.csd_fr) : "",
          },
          points: [],
        };
        cellMap.set(geohash, cell);
      }

      cell.points.push(point);
      lastId = Number(row.phh_id);
    }

    processed += rows.length;
    console.log(`Processed ${processed}/${count} points (${cellMap.size} cells)`);
  }

  // Write cell files
  console.log(`Writing ${cellMap.size} cell files...`);
  let written = 0;
  for (const [geohash, cell] of cellMap) {
    const filePath = path.join(OUTPUT_DIR, "cells", `${geohash}.json`);
    fs.writeFileSync(filePath, JSON.stringify(cell));
    written++;
    if (written % 10000 === 0) {
      console.log(`Written ${written}/${cellMap.size} cells`);
    }
  }

  console.log(`Done. Generated ${cellMap.size} cell files with ${processed} total points.`);
  await sql.end();
}

main().catch((err) => {
  console.error("Cell generation failed:", err);
  process.exit(1);
});
