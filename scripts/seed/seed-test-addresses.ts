/**
 * seed-test-addresses.ts
 *
 * Reads mock/test_addresses.json and inserts each address into the addresses
 * table with geocode_provider='mock' and PostGIS geography from lat/lng.
 *
 * Usage: npx tsx scripts/seed/seed-test-addresses.ts
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ispbyaddress";

const ADDRESSES_FILE = resolve(__dirname, "../../mock/test_addresses.json");

interface TestAddress {
  input: string;
  lat: number;
  lng: number;
  province: string;
  context: string;
}

interface AddressesFile {
  _comment?: string;
  addresses: TestAddress[];
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[seed-test-addresses] Starting test address seeding...");
  console.log(`[seed-test-addresses] Addresses file: ${ADDRESSES_FILE}`);

  try {
    const raw = readFileSync(ADDRESSES_FILE, "utf-8");
    const data: AddressesFile = JSON.parse(raw);
    const addresses = data.addresses;

    console.log(
      `[seed-test-addresses] Found ${addresses.length} test addresses in file`
    );

    let inserted = 0;
    for (const addr of addresses) {
      const result = await sql`
        INSERT INTO addresses (
          raw_input,
          normalized_address,
          latitude,
          longitude,
          province,
          geometry,
          geocode_provider
        )
        VALUES (
          ${addr.input},
          ${addr.input},
          ${addr.lat},
          ${addr.lng},
          ${addr.province},
          ST_SetSRID(ST_MakePoint(${addr.lng}, ${addr.lat}), 4326)::geography,
          ${"mock"}
        )
        RETURNING id
      `;
      if (result.length > 0) {
        inserted++;
      }
    }

    console.log(
      `[seed-test-addresses] Addresses inserted: ${inserted} of ${addresses.length}`
    );
    console.log("[seed-test-addresses] Done.");
  } catch (error) {
    console.error("[seed-test-addresses] Error during seeding:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
