/**
 * Pre-compute plans bundle from mock provider plans JSON.
 *
 * Reads plans from mock/provider_plans.json and writes a bundled
 * plans.json with additional metadata fields to data/precomputed/.
 *
 * Run locally:
 *   npx tsx scripts/precompute/generate-plans.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface MockPlan {
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
  source_url?: string | null;
  last_verified_at?: string;
  stale_flag?: boolean;
}

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

interface MockPlansFile {
  _comment?: string;
  plans: MockPlan[];
}

const MOCK_PLANS_PATH = path.resolve(__dirname, "../../mock/provider_plans.json");
const OUTPUT_DIR = path.resolve(__dirname, "../../data/precomputed");

function main(): void {
  console.log("Starting plans bundle generation from mock JSON...");
  console.log(`Source: ${MOCK_PLANS_PATH}`);

  if (!fs.existsSync(MOCK_PLANS_PATH)) {
    throw new Error(`Mock plans file not found: ${MOCK_PLANS_PATH}`);
  }

  const raw = fs.readFileSync(MOCK_PLANS_PATH, "utf-8");
  const mockData: MockPlansFile = JSON.parse(raw) as MockPlansFile;

  if (!Array.isArray(mockData.plans)) {
    throw new Error("Invalid mock plans file: missing 'plans' array");
  }

  const now = new Date().toISOString();

  const plans: BundledPlan[] = mockData.plans.map((plan) => ({
    provider_name: plan.provider_name,
    region_code: plan.region_code,
    technology: plan.technology,
    plan_name: plan.plan_name,
    speed_down: plan.speed_down,
    speed_up: plan.speed_up,
    monthly_price: plan.monthly_price,
    promo_price: plan.promo_price ?? null,
    promo_months: plan.promo_months,
    contract_months: plan.contract_months,
    data_cap_gb: plan.data_cap_gb ?? null,
    install_fee: plan.install_fee,
    source: plan.source,
    source_url: plan.source_url ?? null,
    last_verified_at: plan.last_verified_at ?? now,
    stale_flag: plan.stale_flag ?? false,
  }));

  plans.sort((a, b) => {
    const nameCompare = a.provider_name.localeCompare(b.provider_name);
    if (nameCompare !== 0) return nameCompare;
    const techCompare = a.technology.localeCompare(b.technology);
    if (techCompare !== 0) return techCompare;
    return a.monthly_price - b.monthly_price;
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const bundle = { plans };
  const filePath = path.join(OUTPUT_DIR, "plans.json");
  fs.writeFileSync(filePath, JSON.stringify(bundle));

  console.log(`Done. Bundled ${plans.length} plans into ${filePath}`);
}

main();
