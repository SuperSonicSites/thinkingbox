/**
 * Lookup Accuracy Evaluation Script
 *
 * Reads test addresses from mock/test_addresses.json and validates
 * that the lookup API returns correctly structured responses for each.
 *
 * Usage: npx tsx evals/lookup-accuracy.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const LOOKUP_URL = `${BASE_URL}/api/v1/lookup`;

interface TestAddress {
  input: string;
  lat: number;
  lng: number;
  province: string;
  context: string;
}

interface TestAddressFile {
  _comment: string;
  addresses: TestAddress[];
}

interface AddressResult {
  address: string;
  province: string;
  context: string;
  status: "PASS" | "FAIL";
  httpStatus: number;
  errors: string[];
  responseTime: number;
}

const VALID_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

function validateResponseStructure(body: unknown): string[] {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    errors.push("Response body is not an object");
    return errors;
  }

  const resp = body as Record<string, unknown>;

  // Validate top-level envelope: { data, error, meta }
  if (!("data" in resp) && !("error" in resp)) {
    errors.push("Response missing both 'data' and 'error' fields");
    return errors;
  }

  // If there's an error response, it may be a valid "no match" -- still validate structure
  if (resp.error !== null && resp.error !== undefined) {
    const err = resp.error as Record<string, unknown>;
    if (typeof err.code !== "string") {
      errors.push("error.code is not a string");
    }
    if (typeof err.message !== "string") {
      errors.push("error.message is not a string");
    }
    // Some addresses may not match -- that's valid API behavior, but we note it
    errors.push(`API returned error: ${err.code} - ${err.message}`);
    return errors;
  }

  const data = resp.data as Record<string, unknown> | null;

  if (!data) {
    errors.push("Response data is null without an error");
    return errors;
  }

  // Validate lookup_id
  if (typeof data.lookup_id !== "string" || data.lookup_id.length === 0) {
    errors.push("Missing or invalid lookup_id");
  }

  // Validate address object
  if (typeof data.address !== "object" || data.address === null) {
    errors.push("Missing address object");
  } else {
    const addr = data.address as Record<string, unknown>;
    if (typeof addr.raw_input !== "string") errors.push("address.raw_input is not a string");
    if (typeof addr.normalized !== "string") errors.push("address.normalized is not a string");
    if (typeof addr.latitude !== "number") errors.push("address.latitude is not a number");
    if (typeof addr.longitude !== "number") errors.push("address.longitude is not a number");
  }

  // Validate confidence object
  if (typeof data.confidence !== "object" || data.confidence === null) {
    errors.push("Missing confidence object");
  } else {
    const conf = data.confidence as Record<string, unknown>;

    // confidence.overall (aliased as score in spec) should be 0-100
    const scoreField = "overall" in conf ? conf.overall : (conf as Record<string, unknown>).score;
    if (typeof scoreField !== "number") {
      errors.push("confidence score/overall is not a number");
    } else if (scoreField < 0 || scoreField > 100) {
      errors.push(`confidence score/overall out of range: ${scoreField}`);
    }

    // confidence.level
    if (
      typeof conf.level !== "string" ||
      !VALID_CONFIDENCE_LEVELS.includes(conf.level as typeof VALID_CONFIDENCE_LEVELS[number])
    ) {
      errors.push(
        `confidence.level invalid: expected one of ${VALID_CONFIDENCE_LEVELS.join(", ")}, got "${conf.level}"`
      );
    }
  }

  // Validate availability object
  if (typeof data.availability !== "object" || data.availability === null) {
    errors.push("Missing availability object");
  } else {
    const avail = data.availability as Record<string, unknown>;

    for (const key of ["combined", "wired", "wireless"]) {
      if (typeof avail[key] !== "object" || avail[key] === null) {
        errors.push(`availability.${key} is missing or not an object`);
      } else {
        const detail = avail[key] as Record<string, unknown>;
        if (typeof detail.available !== "boolean") {
          errors.push(`availability.${key}.available is not a boolean`);
        }
        if (typeof detail.max_threshold !== "string") {
          errors.push(`availability.${key}.max_threshold is not a string`);
        }
        if (typeof detail.availability_class !== "string") {
          errors.push(`availability.${key}.availability_class is not a string`);
        }
      }
    }
  }

  return errors;
}

async function testAddress(addr: TestAddress): Promise<AddressResult> {
  const result: AddressResult = {
    address: addr.input,
    province: addr.province,
    context: addr.context,
    status: "FAIL",
    httpStatus: 0,
    errors: [],
    responseTime: 0,
  };

  const start = Date.now();

  try {
    const response = await fetch(LOOKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr.input }),
    });

    result.responseTime = Date.now() - start;
    result.httpStatus = response.status;

    if (response.status !== 200 && response.status !== 404) {
      result.errors.push(`Unexpected HTTP status: ${response.status}`);
      return result;
    }

    const body = await response.json();
    const validationErrors = validateResponseStructure(body);

    // Filter out "API returned error" messages for 404s (valid no-match)
    const structuralErrors = validationErrors.filter(
      (e) => !e.startsWith("API returned error:")
    );

    if (response.status === 404) {
      // A 404 with valid error structure is acceptable for some addresses
      const apiErrorMessages = validationErrors.filter((e) =>
        e.startsWith("API returned error:")
      );
      if (structuralErrors.length === 0) {
        result.status = "PASS";
        if (apiErrorMessages.length > 0) {
          result.errors = apiErrorMessages; // informational only
        }
      } else {
        result.errors = structuralErrors;
      }
    } else {
      // 200 -- expect full valid structure
      if (structuralErrors.length === 0) {
        result.status = "PASS";
      } else {
        result.errors = structuralErrors;
      }
    }
  } catch (err) {
    result.responseTime = Date.now() - start;
    result.errors.push(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

async function run(): Promise<void> {
  // Load test addresses
  const filePath = resolve(process.cwd(), "mock", "test_addresses.json");
  let testData: TestAddressFile;

  try {
    const raw = readFileSync(filePath, "utf-8");
    testData = JSON.parse(raw) as TestAddressFile;
  } catch (err) {
    console.error(`Failed to read test addresses from ${filePath}:`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const addresses = testData.addresses;
  console.log(`Loaded ${addresses.length} test addresses from ${filePath}`);
  console.log(`Target API: ${LOOKUP_URL}\n`);

  // Run all address tests
  const results: AddressResult[] = [];

  for (const addr of addresses) {
    const result = await testAddress(addr);
    results.push(result);

    const statusIcon = result.status === "PASS" ? "[PASS]" : "[FAIL]";
    const timing = `${result.responseTime}ms`;
    console.log(
      `${statusIcon} ${result.address.padEnd(55)} HTTP ${result.httpStatus}  ${timing.padStart(6)}`
    );

    if (result.errors.length > 0 && result.status === "FAIL") {
      for (const e of result.errors) {
        console.log(`        ${e}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(90));

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const passRate = ((passCount / results.length) * 100).toFixed(1);

  const avgTime =
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  console.log(
    `\nResults: ${passCount} PASS, ${failCount} FAIL out of ${results.length} addresses`
  );
  console.log(`Pass rate: ${passRate}%`);
  console.log(`Avg response time: ${avgTime.toFixed(0)}ms`);

  // Breakdown by context
  const contexts = [...new Set(results.map((r) => r.context))];
  if (contexts.length > 1) {
    console.log("\nBreakdown by context:");
    for (const ctx of contexts) {
      const ctxResults = results.filter((r) => r.context === ctx);
      const ctxPass = ctxResults.filter((r) => r.status === "PASS").length;
      console.log(`  ${ctx.padEnd(30)} ${ctxPass}/${ctxResults.length} pass`);
    }
  }

  // Breakdown by province
  const provinces = [...new Set(results.map((r) => r.province))].sort();
  if (provinces.length > 1) {
    console.log("\nBreakdown by province:");
    for (const prov of provinces) {
      const provResults = results.filter((r) => r.province === prov);
      const provPass = provResults.filter((r) => r.status === "PASS").length;
      console.log(`  ${prov.padEnd(5)} ${provPass}/${provResults.length} pass`);
    }
  }

  if (failCount > 0) {
    console.log("\nFailed addresses:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.address} (${r.context})`);
      for (const e of r.errors) {
        console.log(`    ${e}`);
      }
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Lookup accuracy evaluation failed:", err);
  process.exit(1);
});
