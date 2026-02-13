/**
 * API Contract Compliance Evaluation Script
 *
 * Tests that all API endpoints conform to their expected contracts:
 * correct status codes, response envelope structure, and error handling.
 *
 * Usage: npx tsx evals/api-contracts.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";

interface ContractTest {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  expectedStatus: number;
  /** Validate the parsed JSON body. Return an array of error strings (empty = pass). */
  validate: (body: unknown, status: number) => string[];
}

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  httpStatus: number;
  expectedStatus: number;
  errors: string[];
  responseTime: number;
}

// ---------------------------------------------------------------------------
// Shared validators
// ---------------------------------------------------------------------------

function hasEnvelope(body: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) {
    errors.push("Response is not a JSON object");
    return errors;
  }
  const obj = body as Record<string, unknown>;
  if (!("data" in obj) && !("error" in obj)) {
    errors.push("Response missing both 'data' and 'error' fields");
  }
  if (!("meta" in obj)) {
    errors.push("Response missing 'meta' field");
  }
  return errors;
}

function hasDataField(body: unknown): string[] {
  const errors = hasEnvelope(body);
  if (errors.length > 0) return errors;
  const obj = body as Record<string, unknown>;
  if (obj.data === null || obj.data === undefined) {
    errors.push("Expected 'data' to be present (non-null) for success response");
  }
  return errors;
}

function hasErrorField(body: unknown): string[] {
  const errors = hasEnvelope(body);
  if (errors.length > 0) return errors;
  const obj = body as Record<string, unknown>;
  if (obj.error === null || obj.error === undefined) {
    errors.push("Expected 'error' to be present (non-null) for error response");
  } else {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.code !== "string") errors.push("error.code is not a string");
    if (typeof err.message !== "string") errors.push("error.message is not a string");
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

const tests: ContractTest[] = [
  // ------ POST /api/v1/lookup ------

  {
    name: "POST /api/v1/lookup with valid body -> 200",
    method: "POST",
    path: "/api/v1/lookup",
    body: { address: "150 King St W, Toronto, ON M5H 1J9" },
    expectedStatus: 200,
    validate: (body, status) => {
      if (status === 404) {
        // A 404 for "no PHH match" is acceptable API behavior
        return hasErrorField(body);
      }
      const errors = hasDataField(body);
      if (errors.length > 0) return errors;
      const data = (body as Record<string, unknown>).data as Record<string, unknown>;
      if (typeof data.lookup_id !== "string") errors.push("data.lookup_id missing");
      if (typeof data.address !== "object") errors.push("data.address missing");
      if (typeof data.confidence !== "object") errors.push("data.confidence missing");
      if (typeof data.availability !== "object") errors.push("data.availability missing");
      return errors;
    },
  },

  {
    name: "POST /api/v1/lookup with empty body -> 400",
    method: "POST",
    path: "/api/v1/lookup",
    body: {},
    expectedStatus: 400,
    validate: (body) => hasErrorField(body),
  },

  {
    name: "POST /api/v1/lookup with missing address -> 400",
    method: "POST",
    path: "/api/v1/lookup",
    body: { city: "Toronto", province: "ON" },
    expectedStatus: 400,
    validate: (body) => hasErrorField(body),
  },

  // ------ GET /api/v1/health ------

  {
    name: "GET /api/v1/health -> 200 with status field",
    method: "GET",
    path: "/api/v1/health",
    expectedStatus: 200,
    validate: (body, status) => {
      // Health endpoint may return 503 if DB is down, which is valid behavior
      if (status === 503) {
        const errors = hasEnvelope(body);
        return errors;
      }
      const errors = hasDataField(body);
      if (errors.length > 0) return errors;
      const data = (body as Record<string, unknown>).data as Record<string, unknown>;
      if (typeof data.status !== "string") {
        errors.push("data.status is not a string");
      }
      return errors;
    },
  },

  // ------ POST /api/v1/discrepancy ------

  {
    name: "POST /api/v1/discrepancy with valid body -> 200/201",
    method: "POST",
    path: "/api/v1/discrepancy",
    body: {
      report_type: "wrong_speed",
      description: "The listed speed for Bell in my area is incorrect. I consistently get 100/30.",
    },
    expectedStatus: 200,
    validate: (body, status) => {
      // API may return 201 Created for new reports
      if (status !== 200 && status !== 201) {
        return [`Unexpected status ${status}, expected 200 or 201`];
      }
      const errors = hasDataField(body);
      if (errors.length > 0) return errors;
      const data = (body as Record<string, unknown>).data as Record<string, unknown>;
      if (!("report_id" in data) && !("status" in data)) {
        errors.push("data missing report_id or status field");
      }
      return errors;
    },
  },

  {
    name: "POST /api/v1/discrepancy with missing fields -> 400",
    method: "POST",
    path: "/api/v1/discrepancy",
    body: { description: "short" },
    expectedStatus: 400,
    validate: (body) => hasErrorField(body),
  },

  // ------ GET /api/v1/changes ------

  {
    name: "GET /api/v1/changes -> 200 with changes array",
    method: "GET",
    path: "/api/v1/changes",
    expectedStatus: 200,
    validate: (body) => {
      const errors = hasDataField(body);
      if (errors.length > 0) return errors;
      const data = (body as Record<string, unknown>).data as Record<string, unknown>;
      if (!Array.isArray(data.changes)) {
        errors.push("data.changes is not an array");
      }
      return errors;
    },
  },

  // ------ GET /api/v1/address/:id/availability ------

  {
    name: "GET /api/v1/address/99999/availability -> 404",
    method: "GET",
    path: "/api/v1/address/99999/availability",
    expectedStatus: 404,
    validate: (body) => hasErrorField(body),
  },

  // ------ GET /api/v1/address/:id/plans ------

  {
    name: "GET /api/v1/address/99999/plans -> 404",
    method: "GET",
    path: "/api/v1/address/99999/plans",
    expectedStatus: 404,
    validate: (body) => hasErrorField(body),
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runTest(test: ContractTest): Promise<TestResult> {
  const result: TestResult = {
    name: test.name,
    status: "FAIL",
    httpStatus: 0,
    expectedStatus: test.expectedStatus,
    errors: [],
    responseTime: 0,
  };

  const url = `${BASE_URL}${test.path}`;
  const start = Date.now();

  try {
    const options: RequestInit = {
      method: test.method,
      headers: { "Content-Type": "application/json" },
    };

    if (test.body !== undefined) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, options);
    result.responseTime = Date.now() - start;
    result.httpStatus = response.status;

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      result.errors.push("Response is not valid JSON");
      return result;
    }

    // Check status code (with some flexibility for the discrepancy endpoint)
    const statusMatch =
      test.name.includes("discrepancy with valid body")
        ? response.status === 200 || response.status === 201
        : test.name.includes("valid body -> 200") && response.status === 404
          ? true // lookup may return 404 for no-match, which is valid
          : response.status === test.expectedStatus;

    if (!statusMatch) {
      result.errors.push(
        `Expected HTTP ${test.expectedStatus}, got ${response.status}`
      );
    }

    // Validate response structure
    const validationErrors = test.validate(body, response.status);
    result.errors.push(...validationErrors);

    if (result.errors.length === 0) {
      result.status = "PASS";
    }
  } catch (err) {
    result.responseTime = Date.now() - start;
    result.errors.push(
      `Request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

async function run(): Promise<void> {
  console.log(`API Contract Evaluation`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Tests:  ${tests.length}`);
  console.log("=".repeat(90) + "\n");

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    const statusIcon = result.status === "PASS" ? "[PASS]" : "[FAIL]";
    const timing = `${result.responseTime}ms`;
    console.log(
      `${statusIcon} ${result.name.padEnd(60)} HTTP ${result.httpStatus}  ${timing.padStart(6)}`
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

  console.log(
    `\nResults: ${passCount} PASS, ${failCount} FAIL out of ${results.length} tests`
  );

  if (failCount > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.name}`);
      for (const e of r.errors) {
        console.log(`    ${e}`);
      }
    }
  }

  const avgTime =
    results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`\nAvg response time: ${avgTime.toFixed(0)}ms`);

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("API contract evaluation failed:", err);
  process.exit(1);
});
