/**
 * load-boundaries.ts
 *
 * Reads census subdivision boundary GeoJSON files from data/boundaries/
 * and inserts into the census_subdivisions table using ST_GeomFromGeoJSON.
 *
 * Expects GeoJSON FeatureCollection files (converted from shapefiles) where
 * each Feature has properties: CSDUID, CSDNAME, PRUID, PRNAME and a
 * MultiPolygon geometry.
 *
 * Usage: npx tsx scripts/ingest/load-boundaries.ts
 */

import postgres from "postgres";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ispbyaddress";

const DATA_DIR = resolve(__dirname, "../../data/boundaries");

interface GeoJSONFeature {
  type: "Feature";
  properties: {
    CSDUID: string;
    CSDNAME: string;
    CSDNAME_FR?: string;
    PRUID: string;
    PRNAME: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[load-boundaries] Starting census subdivision boundary ingestion...");
  console.log(`[load-boundaries] Data directory: ${DATA_DIR}`);

  let totalInserted = 0;

  const geojsonFiles = readdirSync(DATA_DIR).filter(
    (f) => f.toLowerCase().endsWith(".geojson") || f.toLowerCase().endsWith(".json")
  );

  if (geojsonFiles.length === 0) {
    console.error(`[load-boundaries] No GeoJSON files found in ${DATA_DIR}`);
    await sql.end();
    process.exit(1);
  }

  console.log(
    `[load-boundaries] Found ${geojsonFiles.length} GeoJSON file(s): ${geojsonFiles.join(", ")}`
  );

  try {
    for (const geojsonFile of geojsonFiles) {
      const filePath = resolve(DATA_DIR, geojsonFile);
      console.log(`[load-boundaries] Processing: ${geojsonFile}`);

      const raw = readFileSync(filePath, "utf-8");
      const collection: GeoJSONCollection = JSON.parse(raw);

      if (!collection.features || !Array.isArray(collection.features)) {
        console.error(
          `[load-boundaries] Invalid GeoJSON (no features array) in ${geojsonFile}`
        );
        continue;
      }

      console.log(
        `[load-boundaries] Features in file: ${collection.features.length}`
      );

      // Process in batches of 100 (boundaries are geometrically large)
      const BATCH_SIZE = 100;
      for (let i = 0; i < collection.features.length; i += BATCH_SIZE) {
        const featureBatch = collection.features.slice(i, i + BATCH_SIZE);

        const rows = featureBatch.map((feature) => ({
          csd_uid: feature.properties.CSDUID,
          name_en: feature.properties.CSDNAME,
          name_fr: feature.properties.CSDNAME_FR || feature.properties.CSDNAME,
          province: feature.properties.PRNAME,
          geometry_json: JSON.stringify(feature.geometry),
        }));

        await sql`
          INSERT INTO census_subdivisions (csd_uid, name_en, name_fr, province, geometry)
          SELECT
            v.csd_uid,
            v.name_en,
            v.name_fr,
            v.province,
            ST_SetSRID(ST_GeomFromGeoJSON(v.geometry_json), 4326)
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(
            csd_uid TEXT,
            name_en TEXT,
            name_fr TEXT,
            province TEXT,
            geometry_json TEXT
          )
          ON CONFLICT (csd_uid) DO NOTHING
        `;

        totalInserted += featureBatch.length;

        if (totalInserted % 500 < BATCH_SIZE) {
          console.log(
            `[load-boundaries] Progress: ${totalInserted.toLocaleString()} subdivisions inserted`
          );
        }
      }

      console.log(`[load-boundaries] Finished file: ${geojsonFile}`);
    }

    console.log(
      `[load-boundaries] Done. Total subdivisions inserted: ${totalInserted.toLocaleString()}`
    );
  } catch (error) {
    console.error("[load-boundaries] Error during ingestion:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
