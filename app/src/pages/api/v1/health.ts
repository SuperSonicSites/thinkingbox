import type { APIRoute } from "astro";
import { getDataClient } from "@/lib/data/r2-client";
import { successResponse, jsonResponse, errorResponse } from "@/lib/api/utils";

export const GET: APIRoute = async ({ locals }) => {
  const checks: Record<string, { status: string; latency_ms?: number }> = {};

  // R2/KV data access check
  try {
    const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const client = getDataClient(env);
    const start = Date.now();
    // Try fetching a known cell or just verify the client works
    await client.getPlans();
    checks.data = { status: "healthy", latency_ms: Date.now() - start };
  } catch {
    checks.data = { status: "unhealthy" };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  const body = {
    status: allHealthy ? "healthy" : "degraded",
    version: "0.1.0",
    checks,
    timestamp: new Date().toISOString(),
  };

  if (allHealthy) {
    return jsonResponse(successResponse(body));
  }

  return jsonResponse(errorResponse("DEGRADED", "One or more services are unhealthy", body), 503);
};
