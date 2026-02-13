import type { APIContext } from "astro";
import { getDatabase } from "@/lib/db/connection";
import {
  successResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateRequestId,
} from "@/lib/api/utils";

export async function GET(context: APIContext) {
  const requestId = generateRequestId();
  const locale = extractLocale(context.request);

  try {
    const env = (context.locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const sql = getDatabase(env as Parameters<typeof getDatabase>[0]);
    const url = new URL(context.request.url);

    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? "50"),
      100
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);
    const provider = url.searchParams.get("provider");

    let changes;
    if (provider) {
      changes = await sql`
        SELECT
          cl.id,
          cl.field_changed,
          cl.old_value,
          cl.new_value,
          cl.change_source,
          cl.changed_at,
          pp.plan_name,
          p.name AS provider_name,
          p.slug AS provider_slug
        FROM provider_plan_change_log cl
        JOIN provider_plans pp ON pp.id = cl.plan_id
        JOIN providers p ON p.id = pp.provider_id
        WHERE p.slug = ${provider}
        ORDER BY cl.changed_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      changes = await sql`
        SELECT
          cl.id,
          cl.field_changed,
          cl.old_value,
          cl.new_value,
          cl.change_source,
          cl.changed_at,
          pp.plan_name,
          p.name AS provider_name,
          p.slug AS provider_slug
        FROM provider_plan_change_log cl
        JOIN provider_plans pp ON pp.id = cl.plan_id
        JOIN providers p ON p.id = pp.provider_id
        ORDER BY cl.changed_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    return jsonResponse(
      successResponse(
        {
          changes,
          pagination: {
            limit,
            offset,
            count: changes.length,
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
