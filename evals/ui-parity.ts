/**
 * UI Parity Evaluation Script (EN/FR)
 *
 * Checks that every English page has a corresponding French page,
 * both respond with 200, and each includes the correct lang attribute.
 *
 * Usage: npx tsx evals/ui-parity.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";

interface PagePair {
  label: string;
  enPath: string;
  frPath: string;
}

const PAGE_PAIRS: PagePair[] = [
  { label: "Home",      enPath: "/",            frPath: "/fr" },
  { label: "Lookup",    enPath: "/lookup",      frPath: "/fr/lookup" },
  { label: "Pricing",   enPath: "/pricing",     frPath: "/fr/pricing" },
  { label: "Partners",  enPath: "/partners",    frPath: "/fr/partners" },
  { label: "API Docs",  enPath: "/api-docs",    frPath: "/fr/api-docs" },
];

interface PairResult {
  label: string;
  enPath: string;
  frPath: string;
  status: "PASS" | "FAIL";
  errors: string[];
  enStatus: number;
  frStatus: number;
  enResponseTime: number;
  frResponseTime: number;
}

async function fetchPage(
  url: string
): Promise<{ status: number; html: string; responseTime: number }> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html" },
      redirect: "follow",
    });
    const html = await response.text();
    return { status: response.status, html, responseTime: Date.now() - start };
  } catch (err) {
    return {
      status: 0,
      html: "",
      responseTime: Date.now() - start,
    };
  }
}

function checkLangAttribute(html: string, expectedLang: string): boolean {
  // Look for lang="en" or lang="fr" in the <html> tag
  // Handles variations: lang="en", lang='en', lang=en
  const htmlTagMatch = html.match(/<html[^>]*>/i);
  if (!htmlTagMatch) return false;

  const htmlTag = htmlTagMatch[0];
  const langMatch = htmlTag.match(/lang\s*=\s*["']?([a-z]{2})["']?/i);
  if (!langMatch) return false;

  return langMatch[1].toLowerCase() === expectedLang.toLowerCase();
}

async function testPair(pair: PagePair): Promise<PairResult> {
  const result: PairResult = {
    label: pair.label,
    enPath: pair.enPath,
    frPath: pair.frPath,
    status: "FAIL",
    errors: [],
    enStatus: 0,
    frStatus: 0,
    enResponseTime: 0,
    frResponseTime: 0,
  };

  // Fetch both pages in parallel
  const [enResult, frResult] = await Promise.all([
    fetchPage(`${BASE_URL}${pair.enPath}`),
    fetchPage(`${BASE_URL}${pair.frPath}`),
  ]);

  result.enStatus = enResult.status;
  result.frStatus = frResult.status;
  result.enResponseTime = enResult.responseTime;
  result.frResponseTime = frResult.responseTime;

  // Check EN page responds with 200
  if (enResult.status === 0) {
    result.errors.push(`EN page ${pair.enPath} failed to connect`);
  } else if (enResult.status !== 200) {
    result.errors.push(`EN page ${pair.enPath} returned HTTP ${enResult.status}, expected 200`);
  }

  // Check FR page responds with 200
  if (frResult.status === 0) {
    result.errors.push(`FR page ${pair.frPath} failed to connect`);
  } else if (frResult.status !== 200) {
    result.errors.push(`FR page ${pair.frPath} returned HTTP ${frResult.status}, expected 200`);
  }

  // Check EN page has lang="en"
  if (enResult.status === 200) {
    if (!checkLangAttribute(enResult.html, "en")) {
      result.errors.push(`EN page ${pair.enPath} missing lang="en" in <html> tag`);
    }
  }

  // Check FR page has lang="fr"
  if (frResult.status === 200) {
    if (!checkLangAttribute(frResult.html, "fr")) {
      result.errors.push(`FR page ${pair.frPath} missing lang="fr" in <html> tag`);
    }
  }

  if (result.errors.length === 0) {
    result.status = "PASS";
  }

  return result;
}

async function run(): Promise<void> {
  console.log(`UI Parity Evaluation (EN/FR)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Page pairs: ${PAGE_PAIRS.length}`);
  console.log("=".repeat(90) + "\n");

  const results: PairResult[] = [];

  for (const pair of PAGE_PAIRS) {
    const result = await testPair(pair);
    results.push(result);

    const statusIcon = result.status === "PASS" ? "[PASS]" : "[FAIL]";
    const enInfo = `EN ${result.enPath} -> ${result.enStatus} (${result.enResponseTime}ms)`;
    const frInfo = `FR ${result.frPath} -> ${result.frStatus} (${result.frResponseTime}ms)`;

    console.log(`${statusIcon} ${result.label}`);
    console.log(`        ${enInfo}`);
    console.log(`        ${frInfo}`);

    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.log(`        [ERROR] ${e}`);
      }
    }
    console.log();
  }

  // Summary table
  console.log("=".repeat(90));

  const nameWidth = 12;
  const pathWidth = 16;
  const statusWidth = 8;
  const langWidth = 10;

  const divider =
    "-".repeat(nameWidth + pathWidth * 2 + statusWidth * 2 + langWidth * 2 + 23);

  console.log(divider);
  console.log(
    `| ${"Page".padEnd(nameWidth)} | ${"EN Path".padEnd(pathWidth)} | ${"EN".padEnd(statusWidth)} | ${"EN lang".padEnd(langWidth)} | ${"FR Path".padEnd(pathWidth)} | ${"FR".padEnd(statusWidth)} | ${"FR lang".padEnd(langWidth)} |`
  );
  console.log(divider);

  for (const r of results) {
    const enStatusStr = r.enStatus === 200 ? "200 OK" : `${r.enStatus}`;
    const frStatusStr = r.frStatus === 200 ? "200 OK" : `${r.frStatus}`;
    const enLang = r.errors.some((e) => e.includes('missing lang="en"'))
      ? "MISSING"
      : r.enStatus === 200
        ? "OK"
        : "N/A";
    const frLang = r.errors.some((e) => e.includes('missing lang="fr"'))
      ? "MISSING"
      : r.frStatus === 200
        ? "OK"
        : "N/A";

    console.log(
      `| ${r.label.padEnd(nameWidth)} | ${r.enPath.padEnd(pathWidth)} | ${enStatusStr.padEnd(statusWidth)} | ${enLang.padEnd(langWidth)} | ${r.frPath.padEnd(pathWidth)} | ${frStatusStr.padEnd(statusWidth)} | ${frLang.padEnd(langWidth)} |`
    );
  }

  console.log(divider);

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;

  console.log(
    `\nResults: ${passCount} PASS, ${failCount} FAIL out of ${results.length} page pairs`
  );

  if (failCount > 0) {
    console.log("\nFailed pairs:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.label}`);
      for (const e of r.errors) {
        console.log(`    ${e}`);
      }
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("UI parity evaluation failed:", err);
  process.exit(1);
});
