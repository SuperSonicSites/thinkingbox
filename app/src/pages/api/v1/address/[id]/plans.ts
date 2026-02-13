import type { APIContext } from "astro";
import { z } from "zod";
import { getDataClient } from "@/lib/data/r2-client";
import { resolveISPsFromData } from "@/lib/plans/resolver";
import {
  successResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateRequestId,
} from "@/lib/api/utils";

const QuerySchema = z.object({
  hexuid: z.string().min(1),
  province: z.string().min(1).max(2),
});

/**
 * GET /api/v1/address/[id]/plans?hexuid=...&province=...
 *
 * Refactored to accept hexuid + province params directly (no stored address_id).
 * The [id] param is kept for URL compatibility but the actual lookup
 * is now stateless.
 */
export async function GET(context: APIContext) {
  const requestId = generateRequestId();
  const locale = extractLocale(context.request);

  try {
    const url = new URL(context.request.url);
    const parsed = QuerySchema.safeParse({
      hexuid: url.searchParams.get("hexuid"),
      province: url.searchParams.get("province"),
    });

    if (!parsed.success) {
      return errors.badRequest(
        "hexuid and province query parameters are required",
        parsed.error.flatten().fieldErrors
      );
    }

    const { hexuid, province } = parsed.data;
    const env = (context.locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const client = getDataClient(env);

    const ispEntries = await client.getISPsForHex(hexuid);
    const plansBundle = await client.getPlans();
    const isps = resolveISPsFromData(ispEntries, plansBundle.plans, province);

    return jsonResponse(
      successResponse(
        {
          hexuid,
          providers_count: isps.length,
          isps,
        },
        { request_id: requestId, locale }
      )
    );
  } catch (err) {
    console.error("Address plans error:", err);
    return errors.serverError();
  }
}
