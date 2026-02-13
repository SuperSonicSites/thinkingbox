/**
 * Pre-compute geohash cell files from CSV PHH data (no PostGIS required).
 *
 * Reads PHH coordinates and speed thresholds directly from the ISED CSV files,
 * groups by geohash_6, and writes cells/{hash}.json files.
 *
 * Run with:
 *   node --max-old-space-size=8192 -r tsx/cjs scripts/precompute/generate-cells.ts
 *
 * Or:
 *   npx tsx scripts/precompute/generate-cells.ts
 *   (set NODE_OPTIONS=--max-old-space-size=8192 if needed)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
type ProvinceAbbr = (typeof PROVINCES)[number];

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");

const PHH_COORDS_DIR = path.join(PROJECT_ROOT, "PHH_ID_2021", "PHH_2021_CSV");
const PHH_SPEEDS_DIR = path.join(PROJECT_ROOT, "NBD_PHH_Speeds");

const PRUID_TO_ABBR: Record<string, string> = {
  "10": "nl",
  "11": "pe",
  "12": "ns",
  "13": "nb",
  "24": "qc",
  "35": "on",
  "46": "mb",
  "47": "sk",
  "48": "ab",
  "59": "bc",
  "60": "yt",
  "61": "nt",
  "62": "nu",
};

// Current timestamp for the coverage snapshot
const COVERAGE_TIMESTAMP = new Date().toISOString();

// ---------------------------------------------------------------------------
// Inline geohash encoder (same base32 algorithm, no external deps)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpeedEntry {
  c: string;   // Combined_Max_Threshold
  w: string;   // Wired_Max_Threshold
  x: string;   // Wireless_Max_Threshold
  s: string;   // Satellite_Max_Threshold
  lte: boolean; // Avail_LTE_Mobile_Dispo
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

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/**
 * Strip BOM character from the start of a string if present.
 */
function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

/**
 * Parse a CSV line that may contain quoted fields.
 * Handles: bare fields, double-quoted fields, empty quoted fields ("").
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const len = line.length;

  while (i <= len) {
    if (i === len) {
      // trailing comma produced an empty field
      fields.push("");
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let value = "";
      while (i < len) {
        if (line[i] === '"') {
          if (i + 1 < len && line[i + 1] === '"') {
            // Escaped double-quote
            value += '"';
            i += 2;
          } else {
            // End of quoted field
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma after quoted field
      if (i < len && line[i] === ',') {
        i++;
      }
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, commaIdx));
        i = commaIdx + 1;
      }
    }
  }

  return fields;
}

/**
 * Create a readline interface for streaming a file line-by-line.
 */
function createLineReader(filePath: string): readline.Interface {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  return readline.createInterface({ input: stream, crlfDelay: Infinity });
}

// ---------------------------------------------------------------------------
// Speed CSV loading
// ---------------------------------------------------------------------------

/**
 * Load the speeds CSV for a province into a Map<PHH_ID, SpeedEntry>.
 *
 * Speeds CSV columns (indices after parsing):
 *   0: PHH_ID
 *   1-15: boolean speed flags (not needed)
 *   16: Avail_LTE_Mobile_Dispo
 *   17: Combined_Max_Threshold
 *   18: Wired_Max_Threshold
 *   19: Wireless_Max_Threshold
 *   20: Satellite_Max_Threshold
 */
async function loadSpeedsForProvince(prov: ProvinceAbbr): Promise<Map<string, SpeedEntry>> {
  const fileName = `PHH_Speeds_Current-PHH_Vitesses_Actuelles_${prov}.csv`;
  const filePath = path.join(PHH_SPEEDS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: Speeds file not found: ${filePath}`);
    return new Map();
  }

  const speedMap = new Map<string, SpeedEntry>();
  const rl = createLineReader(filePath);
  let isHeader = true;

  for await (const rawLine of rl) {
    const line = isHeader ? stripBOM(rawLine) : rawLine;

    if (isHeader) {
      isHeader = false;
      continue; // skip header row
    }

    if (line.trim() === "") continue;

    const fields = parseCSVLine(line);
    if (fields.length < 21) continue;

    const phhId = fields[0];
    const lteRaw = fields[16];
    const combined = fields[17];
    const wired = fields[18];
    const wireless = fields[19];
    const satellite = fields[20];

    speedMap.set(phhId, {
      c: combined,
      w: wired,
      x: wireless,
      s: satellite,
      lte: lteRaw === "1",
    });
  }

  return speedMap;
}

// ---------------------------------------------------------------------------
// Coordinates CSV streaming + cell building
// ---------------------------------------------------------------------------

/**
 * Stream the coordinates CSV for a province and populate the cell map.
 *
 * Coordinates CSV columns:
 *   0: PHH_ID
 *   1: Type
 *   2: Pop2021
 *   3: TDwell2021_TLog2021
 *   4: URDwell2021_RH2021
 *   5: DBUID_Ididu
 *   6: HEXUID_IdUHEX
 *   7: Pruid_Pridu
 *   8: Latitude
 *   9: Longitude
 */
async function processCoordinatesForProvince(
  prov: ProvinceAbbr,
  speedMap: Map<string, SpeedEntry>,
  cellMap: Map<string, CellData>,
): Promise<number> {
  const fileName = `PHH-${prov}.csv`;
  const filePath = path.join(PHH_COORDS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: Coordinates file not found: ${filePath}`);
    return 0;
  }

  const provLower = prov.toLowerCase();
  const rl = createLineReader(filePath);
  let isHeader = true;
  let count = 0;

  for await (const rawLine of rl) {
    const line = isHeader ? stripBOM(rawLine) : rawLine;

    if (isHeader) {
      isHeader = false;
      continue; // skip header row
    }

    if (line.trim() === "") continue;

    const fields = parseCSVLine(line);
    if (fields.length < 10) continue;

    const phhId = fields[0];
    const hexuid = fields[6];
    const lat = parseFloat(fields[8]);
    const lng = parseFloat(fields[9]);

    if (isNaN(lat) || isNaN(lng)) continue;

    // Look up speed data
    const speed = speedMap.get(phhId);

    const geohash = encodeGeohash(lat, lng, 6);

    const point: CellPoint = {
      id: `PHH_${phhId}`,
      lat,
      lng,
      hex: hexuid,
      prov: provLower,
      cov: {
        c: speed?.c ?? "",
        w: speed?.w ?? "",
        x: speed?.x ?? "",
        s: speed?.s ?? "",
        lte: speed?.lte ?? false,
        at: COVERAGE_TIMESTAMP,
      },
    };

    let cell = cellMap.get(geohash);
    if (!cell) {
      cell = {
        csd: { uid: "", en: "", fr: "" },
        points: [],
      };
      cellMap.set(geohash, cell);
    }

    cell.points.push(point);
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting cell generation from CSV files...");
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`PHH coordinates: ${PHH_COORDS_DIR}`);
  console.log(`PHH speeds:      ${PHH_SPEEDS_DIR}`);
  console.log(`Provinces:       ${PROVINCES.join(", ")}`);
  console.log();

  // Ensure output dir exists
  fs.mkdirSync(path.join(OUTPUT_DIR, "cells"), { recursive: true });

  const cellMap = new Map<string, CellData>();
  let totalPoints = 0;

  for (const prov of PROVINCES) {
    const provStart = Date.now();
    console.log(`[${prov}] Loading speeds...`);

    // Step 1: Load speeds into memory for this province
    const speedMap = await loadSpeedsForProvince(prov);
    console.log(`[${prov}] Loaded ${speedMap.size} speed entries`);

    // Step 2: Stream coordinates, join with speeds, populate cell map
    console.log(`[${prov}] Processing coordinates...`);
    const count = await processCoordinatesForProvince(prov, speedMap, cellMap);
    totalPoints += count;

    const elapsed = ((Date.now() - provStart) / 1000).toFixed(1);
    console.log(`[${prov}] Done: ${count} points processed in ${elapsed}s (${cellMap.size} cells total)`);

    // Step 3: Free province speed data
    speedMap.clear();
    console.log();
  }

  // Write cell files — use subdirectories by first 2 chars for NTFS performance
  console.log(`Writing ${cellMap.size} cell files (with subdirectory bucketing)...`);
  const createdDirs = new Set<string>();
  let written = 0;
  for (const [geohash, cell] of cellMap) {
    const prefix = geohash.slice(0, 2);
    const dirPath = path.join(OUTPUT_DIR, "cells", prefix);
    if (!createdDirs.has(prefix)) {
      fs.mkdirSync(dirPath, { recursive: true });
      createdDirs.add(prefix);
    }
    const filePath = path.join(dirPath, `${geohash}.json`);
    fs.writeFileSync(filePath, JSON.stringify(cell));
    written++;
    if (written % 10_000 === 0) {
      console.log(`  Written ${written}/${cellMap.size} cells`);
    }
  }

  console.log();
  console.log(`Done. Generated ${cellMap.size} cell files with ${totalPoints} total points.`);
}

main().catch((err) => {
  console.error("Cell generation failed:", err);
  process.exit(1);
});
