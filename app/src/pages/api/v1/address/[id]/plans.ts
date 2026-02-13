import type { APIContext } from "astro";
import { getDatabase } from "@/lib/db/connection";
import { resolveISPsAtLocation } from "@/lib/plans/resolver";
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
    const addressId = context.params.id;

    if (!addressId || isNaN(Number(addressId))) {
      return errors.badRequest("Invalid address ID");
    }

    const env = (context.locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const sql = getDatabase(env as Parameters<typeof getDatabase>[0]);

    // Find the address and its matched PHH point's hex
    const [address] = await sql`
      SELECT a.id, a.province, p.hexuid
      FROM addresses a
      JOIN address_phh_matches apm ON apm.address_id = a.id AND apm.rank = 1
      JOIN phh_points p ON p.phh_id = apm.phh_id
      WHERE a.id = ${Number(addressId)}
    `;

    if (!address) {
      return errors.notFound("Address not found");
    }

    const isps = await resolveISPsAtLocation(
      sql,
      address.hexuid,
      address.province ?? ""
    );

    return jsonResponse(
      successResponse(
        {
          address_id: Number(addressId),
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
