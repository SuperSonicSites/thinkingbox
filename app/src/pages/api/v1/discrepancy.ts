import type { APIRoute } from "astro";
import { z } from "zod";
import { getDatabase } from "@/lib/db/connection";
import { saveDiscrepancyReport } from "@/lib/db/queries";
import {
  successResponse,
  jsonResponse,
  errors,
  generateRequestId,
} from "@/lib/api/utils";

const DiscrepancySchema = z.object({
  address_id: z.number().int().positive().optional(),
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
});

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
    const sql = getDatabase(env as Parameters<typeof getDatabase>[0]);

    const reportId = await saveDiscrepancyReport(sql, {
      address_id: parsed.data.address_id ?? null,
      phh_id: parsed.data.phh_id ?? null,
      reporter_email: parsed.data.reporter_email ?? null,
      report_type: parsed.data.report_type,
      description: parsed.data.description,
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
