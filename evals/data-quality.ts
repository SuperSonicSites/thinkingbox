/**
 * Data Quality Evaluation Script
 *
 * Connects to the local PostGIS database and runs data quality checks
 * against the ISP-by-Address Canada dataset.
 *
 * Usage: npx tsx evals/data-quality.ts
 */

import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/ispbyaddress";

interface CheckResult {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  value: string;
  expected: string;
  detail: string;
}

const results: CheckResult[] = [];

function addResult(
  name: string,
  status: "PASS" | "WARN" | "FAIL",
  value: string,
  expected: string,
  detail: string = ""
): void {
  results.push({ name, status, value, expected, detail });
}

async function run(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    max: 5,
    idle_timeout: 10,
    connect_timeout: 15,
    prepare: false,
  });

  try {
    console.log("Connecting to database...");
    await sql`SELECT 1`;
    console.log("Connected. Running data quality checks...\n");

    // ---------------------------------------------------------------
    // 1. Count of PHH points (expect ~16.6M)
    // ---------------------------------------------------------------
    {
      const [row] = await sql`SELECT count(*)::int AS cnt FROM phh_points`;
      const count = row.cnt;
      const min = 15_000_000;
      const max = 18_000_000;
      const status =
        count >= min && count <= max
          ? "PASS"
          : count > 0
            ? "WARN"
            : "FAIL";
      addResult(
        "PHH point count",
        status,
        count.toLocaleString(),
        "~16.6M (15M-18M)",
        count === 0 ? "Table is empty" : ""
      );
    }

    // ---------------------------------------------------------------
    // 2. PHH points with valid (non-null) geometry
    // ---------------------------------------------------------------
    {
      const [total] = await sql`SELECT count(*)::int AS cnt FROM phh_points`;
      const [valid] = await sql`
        SELECT count(*)::int AS cnt FROM phh_points
        WHERE geom IS NOT NULL
      `;
      const pct =
        total.cnt > 0 ? ((valid.cnt / total.cnt) * 100).toFixed(2) : "0.00";
      const status =
        Number(pct) >= 99.9 ? "PASS" : Number(pct) >= 95 ? "WARN" : "FAIL";
      addResult(
        "PHH valid geometry",
        status,
        `${valid.cnt.toLocaleString()} (${pct}%)`,
        ">=99.9% non-null",
        Number(pct) < 99.9
          ? `${(total.cnt - valid.cnt).toLocaleString()} rows have NULL geometry`
          : ""
      );
    }

    // ---------------------------------------------------------------
    // 3. Coverage snapshot count
    // ---------------------------------------------------------------
    {
      const [row] = await sql`
        SELECT count(*)::int AS cnt FROM phh_coverage_snapshots
      `;
      const count = row.cnt;
      const status = count > 0 ? "PASS" : "FAIL";
      addResult(
        "Coverage snapshot count",
        status,
        count.toLocaleString(),
        "> 0",
        count === 0 ? "No coverage snapshots found" : ""
      );
    }

    // ---------------------------------------------------------------
    // 4. Coverage snapshot completeness
    //    % of PHH points with at least one coverage snapshot
    // ---------------------------------------------------------------
    {
      const [totalRow] = await sql`SELECT count(*)::int AS cnt FROM phh_points`;
      const [coveredRow] = await sql`
        SELECT count(DISTINCT phh_id)::int AS cnt FROM phh_coverage_snapshots
      `;
      const pct =
        totalRow.cnt > 0
          ? ((coveredRow.cnt / totalRow.cnt) * 100).toFixed(2)
          : "0.00";
      const status =
        Number(pct) >= 99 ? "PASS" : Number(pct) >= 90 ? "WARN" : "FAIL";
      addResult(
        "Coverage completeness",
        status,
        `${coveredRow.cnt.toLocaleString()} / ${totalRow.cnt.toLocaleString()} (${pct}%)`,
        ">=99% of PHH points covered",
        Number(pct) < 99
          ? `${(totalRow.cnt - coveredRow.cnt).toLocaleString()} PHH points have no coverage snapshot`
          : ""
      );
    }

    // ---------------------------------------------------------------
    // 5. Hex ISP coverage record count
    // ---------------------------------------------------------------
    {
      const [row] = await sql`
        SELECT count(*)::int AS cnt FROM hex_isp_coverage
      `;
      const count = row.cnt;
      const status = count > 0 ? "PASS" : "FAIL";
      addResult(
        "Hex ISP coverage records",
        status,
        count.toLocaleString(),
        "> 0",
        count === 0 ? "No hex ISP coverage records found" : ""
      );
    }

    // ---------------------------------------------------------------
    // 6. Census subdivision count
    // ---------------------------------------------------------------
    {
      const [row] = await sql`
        SELECT count(*)::int AS cnt FROM census_subdivisions
      `;
      const count = row.cnt;
      // Canada has ~5,000 CSDs
      const status =
        count >= 4000 && count <= 6000
          ? "PASS"
          : count > 0
            ? "WARN"
            : "FAIL";
      addResult(
        "Census subdivision count",
        status,
        count.toLocaleString(),
        "~5,000 (4,000-6,000)",
        count === 0 ? "Table is empty" : ""
      );
    }

    // ---------------------------------------------------------------
    // 7. Provider count
    // ---------------------------------------------------------------
    {
      const [row] = await sql`SELECT count(*)::int AS cnt FROM providers`;
      const count = row.cnt;
      const status = count >= 5 ? "PASS" : count > 0 ? "WARN" : "FAIL";
      addResult(
        "Provider count",
        status,
        count.toLocaleString(),
        ">= 5",
        count === 0 ? "No providers found" : ""
      );
    }

    // ---------------------------------------------------------------
    // 8. Provider plan count
    // ---------------------------------------------------------------
    {
      const [row] = await sql`SELECT count(*)::int AS cnt FROM provider_plans`;
      const count = row.cnt;
      const status = count >= 10 ? "PASS" : count > 0 ? "WARN" : "FAIL";
      addResult(
        "Provider plan count",
        status,
        count.toLocaleString(),
        ">= 10",
        count === 0 ? "No provider plans found" : ""
      );
    }

    // ---------------------------------------------------------------
    // 9. Orphan check: PHH IDs in coverage_snapshots not in phh_points
    // ---------------------------------------------------------------
    {
      const [row] = await sql`
        SELECT count(*)::int AS cnt
        FROM (
          SELECT DISTINCT cs.phh_id
          FROM phh_coverage_snapshots cs
          LEFT JOIN phh_points pp ON pp.phh_id = cs.phh_id
          WHERE pp.phh_id IS NULL
        ) orphans
      `;
      const count = row.cnt;
      const status = count === 0 ? "PASS" : count <= 100 ? "WARN" : "FAIL";
      addResult(
        "Orphan coverage snapshots",
        status,
        count.toLocaleString(),
        "0 orphans",
        count > 0
          ? `${count.toLocaleString()} PHH IDs in coverage_snapshots have no matching phh_points row`
          : ""
      );
    }

    // ---------------------------------------------------------------
    // 10. Duplicate check: duplicate PHH IDs in phh_points
    // ---------------------------------------------------------------
    {
      const [row] = await sql`
        SELECT count(*)::int AS cnt
        FROM (
          SELECT phh_id
          FROM phh_points
          GROUP BY phh_id
          HAVING count(*) > 1
        ) dupes
      `;
      const count = row.cnt;
      const status = count === 0 ? "PASS" : "FAIL";
      addResult(
        "Duplicate PHH IDs",
        status,
        count.toLocaleString(),
        "0 duplicates",
        count > 0
          ? `${count.toLocaleString()} PHH IDs appear more than once in phh_points`
          : ""
      );
    }
  } finally {
    await sql.end();
  }

  // ---------------------------------------------------------------
  // Print results table
  // ---------------------------------------------------------------
  printResults();
}

function printResults(): void {
  const nameWidth = 30;
  const statusWidth = 6;
  const valueWidth = 35;
  const expectedWidth = 28;

  const divider = "-".repeat(nameWidth + statusWidth + valueWidth + expectedWidth + 13);

  console.log(divider);
  console.log(
    `| ${"Check".padEnd(nameWidth)} | ${"Status".padEnd(statusWidth)} | ${"Value".padEnd(valueWidth)} | ${"Expected".padEnd(expectedWidth)} |`
  );
  console.log(divider);

  for (const r of results) {
    const statusTag =
      r.status === "PASS"
        ? "PASS  "
        : r.status === "WARN"
          ? "WARN  "
          : "FAIL  ";

    console.log(
      `| ${r.name.padEnd(nameWidth)} | ${statusTag} | ${r.value.padEnd(valueWidth)} | ${r.expected.padEnd(expectedWidth)} |`
    );
    if (r.detail) {
      console.log(
        `|   ${"".padEnd(nameWidth - 2)} |        | ${"^ " + r.detail}`.slice(
          0,
          nameWidth + statusWidth + valueWidth + expectedWidth + 13
        )
      );
    }
  }

  console.log(divider);

  const passCount = results.filter((r) => r.status === "PASS").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;

  console.log(
    `\nSummary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL out of ${results.length} checks`
  );

  if (failCount > 0) {
    console.log("\nFailed checks:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.name}: got ${r.value}, expected ${r.expected}`);
      if (r.detail) console.log(`    ${r.detail}`);
    }
  }
}

run()
  .then(() => {
    const hasFail = results.some((r) => r.status === "FAIL");
    process.exit(hasFail ? 1 : 0);
  })
  .catch((err) => {
    console.error("Data quality evaluation failed:", err);
    process.exit(1);
  });
