import type { APIContext } from "astro";
import { getDatabase } from "@/lib/db/connection";
import { getCoverageForPHH } from "@/lib/db/queries";
import { deriveAvailability } from "@/lib/plans/resolver";
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

    // Fetch the address to get its PHH match
    const [address] = await sql`
      SELECT a.id, a.latitude, a.longitude, apm.phh_id
      FROM addresses a
      JOIN address_phh_matches apm ON apm.address_id = a.id AND apm.rank = 1
      WHERE a.id = ${Number(addressId)}
    `;

    if (!address) {
      return errors.notFound("Address not found");
    }

    const coverage = await getCoverageForPHH(sql, address.phh_id);

    if (!coverage) {
      return errors.notFound("No coverage data for this address");
    }

    const availability = deriveAvailability(coverage);

    return jsonResponse(
      successResponse(
        {
          address_id: Number(addressId),
          phh_id: address.phh_id,
          availability,
        },
        { request_id: requestId, locale }
      )
    );
  } catch (err) {
    console.error("Address availability error:", err);
    return errors.serverError();
  }
}
