import type { APIContext } from "astro";
import { getDataClient } from "@/lib/data/r2-client";
import {
  successResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateRequestId,
} from "@/lib/api/utils";

/**
 * GET /api/v1/changes
 *
 * Returns plan changes. With the pre-computed architecture,
 * change tracking is derived from plans bundle metadata.
 * For now, returns an empty list — plan change logging
 * will be added when the plan curation workflow is built.
 */
export async function GET(context: APIContext) {
  const requestId = generateRequestId();
  const locale = extractLocale(context.request);

  try {
    const url = new URL(context.request.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? "50"),
      100
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

    return jsonResponse(
      successResponse(
        {
          changes: [],
          pagination: {
            limit,
            offset,
            count: 0,
          },
        },
        { request_id: requestId, locale }
      )
    );
  } catch (err) {
    console.error("Changes endpoint error:", err);
    return errors.serverError();
  }
}
