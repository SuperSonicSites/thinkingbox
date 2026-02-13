import type { APIRoute } from "astro";
import { z } from "zod";
import { saveDiscrepancyReport } from "@/lib/data/d1-client";
import {
  successResponse,
  jsonResponse,
  errors,
  generateRequestId,
} from "@/lib/api/utils";

const DiscrepancySchema = z.object({
  phh_id: z.number().int().positive().optional(),
  reporter_email: z.string().email().optional(),
  report_type: z.enum([
    "wrong_provider",
    "wrong_speed",
    "missing_provider",
    "pricing_error",
    "other",
  ]),
  description: z.string().min(10).max(2000),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta: { last_row_id: number } }>;
    };
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const parsed = DiscrepancySchema.safeParse(body);

    if (!parsed.success) {
      return errors.badRequest(
        "Invalid report data",
        parsed.error.flatten().fieldErrors
      );
    }

    const env = (locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const db = env.DISCREPANCY_DB as D1Database | undefined;

    if (!db) {
      // In dev without D1, return a mock ID
      console.warn("[discrepancy] D1 not available, returning mock report ID");
      return jsonResponse(
        successResponse(
          { report_id: Math.floor(Math.random() * 10000), status: "pending" },
          { request_id: requestId }
        ),
        201
      );
    }

    const reportId = await saveDiscrepancyReport(db as Parameters<typeof saveDiscrepancyReport>[0], {
      phh_id: parsed.data.phh_id ?? null,
      reporter_email: parsed.data.reporter_email ?? null,
      report_type: parsed.data.report_type,
      description: parsed.data.description,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    });

    return jsonResponse(
      successResponse(
        { report_id: reportId, status: "pending" },
        { request_id: requestId }
      ),
      201
    );
  } catch (err) {
    console.error(`[${requestId}] Discrepancy report error:`, err);
    return errors.serverError();
  }
};
