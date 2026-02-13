/**
 * seed-mock-plans.ts
 *
 * Reads mock/provider_plans.json, creates providers from unique provider names
 * (generating slugs), and inserts provider plans with source='mock'.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING on both providers and plans.
 *
 * Usage: npx tsx scripts/seed/seed-mock-plans.ts
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ispbyaddress";

const PLANS_FILE = resolve(__dirname, "../../mock/provider_plans.json");

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
}

interface PlansFile {
  _comment?: string;
  plans: MockPlan[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  console.log("[seed-mock-plans] Starting mock plan seeding...");
  console.log(`[seed-mock-plans] Plans file: ${PLANS_FILE}`);

  try {
    const raw = readFileSync(PLANS_FILE, "utf-8");
    const data: PlansFile = JSON.parse(raw);
    const plans = data.plans;

    console.log(`[seed-mock-plans] Found ${plans.length} plans in file`);

    // Step 1: Extract unique provider names and create providers
    const uniqueProviders = [...new Set(plans.map((p) => p.provider_name))];
    console.log(
      `[seed-mock-plans] Unique providers: ${uniqueProviders.length} (${uniqueProviders.join(", ")})`
    );

    let providersCreated = 0;
    for (const name of uniqueProviders) {
      const slug = slugify(name);
      const result = await sql`
        INSERT INTO providers (name, slug)
        VALUES (${name}, ${slug})
        ON CONFLICT (name) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) {
        providersCreated++;
      }
    }
    console.log(
      `[seed-mock-plans] Providers created: ${providersCreated} (${uniqueProviders.length - providersCreated} already existed)`
    );

    // Step 2: Build a name-to-id lookup for providers
    const providerRows = await sql`
      SELECT id, name FROM providers WHERE name = ANY(${uniqueProviders})
    `;

    const providerMap = new Map<string, number>();
    for (const row of providerRows) {
      providerMap.set(row.name, row.id);
    }

    // Step 3: Insert plans
    let plansInserted = 0;
    for (const plan of plans) {
      const providerId = providerMap.get(plan.provider_name);
      if (!providerId) {
        console.error(
          `[seed-mock-plans] Provider not found for: ${plan.provider_name}`
        );
        continue;
      }

      const result = await sql`
        INSERT INTO provider_plans (
          provider_id, region_code, technology, plan_name,
          speed_down, speed_up, monthly_price, promo_price,
          promo_months, contract_months, data_cap_gb, install_fee,
          source, source_url
        )
        VALUES (
          ${providerId},
          ${plan.region_code},
          ${plan.technology},
          ${plan.plan_name},
          ${plan.speed_down},
          ${plan.speed_up},
          ${plan.monthly_price},
          ${plan.promo_price},
          ${plan.promo_months},
          ${plan.contract_months},
          ${plan.data_cap_gb},
          ${plan.install_fee},
          ${"mock"},
          ${plan.source_url ?? null}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) {
        plansInserted++;
      }
    }

    console.log(
      `[seed-mock-plans] Plans inserted: ${plansInserted} (${plans.length - plansInserted} skipped/already existed)`
    );
    console.log("[seed-mock-plans] Done.");
  } catch (error) {
    console.error("[seed-mock-plans] Error during seeding:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
