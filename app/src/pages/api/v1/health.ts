import type { APIRoute } from "astro";
import { getDatabase } from "@/lib/db/connection";
import { successResponse, jsonResponse, errorResponse } from "@/lib/api/utils";

export const GET: APIRoute = async ({ locals }) => {
  const checks: Record<string, { status: string; latency_ms?: number }> = {};

  // Database check
  try {
    const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const sql = getDatabase(env as Parameters<typeof getDatabase>[0]);
    const start = Date.now();
    await sql`SELECT 1`;
    checks.database = { status: "healthy", latency_ms: Date.now() - start };
  } catch {
    checks.database = { status: "unhealthy" };
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
