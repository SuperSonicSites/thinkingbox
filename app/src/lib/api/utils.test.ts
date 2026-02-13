import { describe, it, expect } from "vitest";
import {
  generateRequestId,
  successResponse,
  errorResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateLookupId,
} from "./utils";

describe("generateRequestId()", () => {
  it("generates a string starting with req_", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});

describe("generateLookupId()", () => {
  it("generates a non-empty string", () => {
    const id = generateLookupId();
    expect(id.length).toBeGreaterThan(0);
    expect(typeof id).toBe("string");
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateLookupId()));
    expect(ids.size).toBe(100);
  });
});

describe("successResponse()", () => {
  it("returns an APIResponse object with data and meta", () => {
    const result = successResponse({ foo: "bar" }, { request_id: "req_test", locale: "en" });
    expect(result.data).toEqual({ foo: "bar" });
    expect(result.error).toBeNull();
    expect(result.meta.request_id).toBe("req_test");
    expect(result.meta.locale).toBe("en");
    expect(result.meta.cached).toBe(false);
    expect(result.meta.timestamp).toBeDefined();
  });

  it("uses defaults when no meta provided", () => {
    const result = successResponse("hello");
    expect(result.data).toBe("hello");
    expect(result.meta.request_id).toMatch(/^req_/);
    expect(result.meta.locale).toBe("en");
  });
});

describe("errorResponse()", () => {
  it("returns an APIResponse object with error and null data", () => {
    const result = errorResponse("TEST_ERROR", "something broke");
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe("TEST_ERROR");
    expect(result.error!.message).toBe("something broke");
  });

  it("includes details when provided", () => {
    const result = errorResponse("ERR", "msg", { field: "address" });
    expect(result.error!.details).toEqual({ field: "address" });
  });
});

describe("jsonResponse()", () => {
  it("wraps an APIResponse in a Response with correct status", async () => {
    const apiResponse = successResponse({ ok: true });
    const response = jsonResponse(apiResponse, 200);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();
    expect(body.data).toEqual({ ok: true });
  });

  it("sets no-cache for non-cached responses", () => {
    const apiResponse = successResponse("test");
    const response = jsonResponse(apiResponse);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("sets X-Request-ID header", () => {
    const apiResponse = successResponse("test", { request_id: "req_abc" });
    const response = jsonResponse(apiResponse);
    expect(response.headers.get("X-Request-ID")).toBe("req_abc");
  });
});

describe("errors factory", () => {
  it("creates bad request response with 400 status", async () => {
    const response = errors.badRequest("bad input");
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toBe("bad input");
  });

  it("creates not found response with 404 status", async () => {
    const response = errors.notFound("missing");
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("creates server error response with 500 status", async () => {
    const response = errors.serverError();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("creates geocode failed response with 422 status", async () => {
    const response = errors.geocodeFailed();
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.error.code).toBe("GEOCODE_FAILED");
  });

  it("creates rate limited response with 429 status", async () => {
    const response = errors.rateLimited();
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

describe("extractLocale()", () => {
  it("returns en by default", () => {
    const request = new Request("http://localhost/api/v1/lookup");
    expect(extractLocale(request)).toBe("en");
  });

  it("extracts fr from /fr/ path prefix", () => {
    const request = new Request("http://localhost/fr/api/v1/lookup");
    expect(extractLocale(request)).toBe("fr");
  });

  it("extracts fr from Accept-Language header", () => {
    const request = new Request("http://localhost/api/v1/lookup", {
      headers: { "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.8" },
    });
    expect(extractLocale(request)).toBe("fr");
  });

  it("extracts fr from ?lang=fr query param", () => {
    const request = new Request("http://localhost/api/v1/lookup?lang=fr");
    expect(extractLocale(request)).toBe("fr");
  });

  it("returns en for English Accept-Language", () => {
    const request = new Request("http://localhost/api/v1/lookup", {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });
    expect(extractLocale(request)).toBe("en");
  });
});
