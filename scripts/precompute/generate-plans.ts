/**
 * Pre-compute plans bundle from PostGIS provider data.
 *
 * Bundles all provider plans into a single plans.json file.
 *
 * Run locally with PostGIS available:
 *   npx tsx scripts/precompute/generate-plans.ts
 */

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";

interface BundledPlan {
  provider_name: string;
  region_code: string;
  technology: string;
  plan_name: string;
  speed_down: number;
  speed_up: number;
  monthly_price: number;
  promo_price: number | null;
  promo_months: number;
  contract_months: number;
  data_cap_gb: number | null;
  install_fee: number;
  source: string;
  source_url: string | null;
  last_verified_at: string;
  stale_flag: boolean;
}

const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/ispbyaddress";

  const sql = postgres(connectionString, { max: 5, idle_timeout: 30 });

  console.log("Starting plans bundle generation...");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rows = await sql`
    SELECT
      p.name AS provider_name,
      pp.region_code,
      pp.technology,
      pp.plan_name,
      pp.speed_down,
      pp.speed_up,
      pp.monthly_price,
      pp.promo_price,
      pp.promo_months,
      pp.contract_months,
      pp.data_cap_gb,
      pp.install_fee,
      pp.source,
      pp.source_url,
      pp.last_verified_at,
      pp.stale_flag
    FROM provider_plans pp
    JOIN providers p ON p.id = pp.provider_id
    ORDER BY p.name, pp.technology, pp.monthly_price
  `;

  const plans: BundledPlan[] = rows.map((row) => ({
    provider_name: String(row.provider_name),
    region_code: String(row.region_code),
    technology: String(row.technology),
    plan_name: String(row.plan_name),
    speed_down: Number(row.speed_down),
    speed_up: Number(row.speed_up),
    monthly_price: Number(row.monthly_price),
    promo_price: row.promo_price != null ? Number(row.promo_price) : null,
    promo_months: Number(row.promo_months),
    contract_months: Number(row.contract_months),
    data_cap_gb: row.data_cap_gb != null ? Number(row.data_cap_gb) : null,
    install_fee: Number(row.install_fee),
    source: String(row.source),
    source_url: row.source_url != null ? String(row.source_url) : null,
    last_verified_at: new Date(row.last_verified_at as string).toISOString(),
    stale_flag: Boolean(row.stale_flag),
  }));

  const bundle = { plans };
  const filePath = path.join(OUTPUT_DIR, "plans.json");
  fs.writeFileSync(filePath, JSON.stringify(bundle));

  console.log(`Done. Bundled ${plans.length} plans into plans.json.`);
  await sql.end();
}

main().catch((err) => {
  console.error("Plans generation failed:", err);
  process.exit(1);
});
