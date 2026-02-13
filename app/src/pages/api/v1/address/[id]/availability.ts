import type { APIContext } from "astro";
import { z } from "zod";
import { getDataClient } from "@/lib/data/r2-client";
import { encodeGeohash, getNeighbors } from "@/lib/geo/geohash";
import { findNearestPHH } from "@/lib/data/phh-matcher";
import { deriveAvailability } from "@/lib/plans/resolver";
import type { CellData, CompactCoverage } from "@/lib/data/types";
import type { CoverageSnapshot } from "@/types";
import {
  successResponse,
  jsonResponse,
  errors,
  extractLocale,
  generateRequestId,
} from "@/lib/api/utils";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * GET /api/v1/address/[id]/availability?lat=...&lng=...
 *
 * Refactored to accept lat/lng params directly (no stored address_id).
 * The [id] param is kept for URL compatibility but the actual lookup
 * is now stateless via coordinates.
 */
export async function GET(context: APIContext) {
  const requestId = generateRequestId();
  const locale = extractLocale(context.request);

  try {
    const url = new URL(context.request.url);
    const parsed = QuerySchema.safeParse({
      lat: url.searchParams.get("lat"),
      lng: url.searchParams.get("lng"),
    });

    if (!parsed.success) {
      return errors.badRequest(
        "lat and lng query parameters are required",
        parsed.error.flatten().fieldErrors
      );
    }

    const { lat, lng } = parsed.data;
    const env = (context.locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? {};
    const client = getDataClient(env);

    // Fetch 9 cells
    const centerHash = encodeGeohash(lat, lng, 6);
    const allHashes = [centerHash, ...getNeighbors(centerHash)];
    const cellResults = await Promise.all(allHashes.map((h) => client.getCellData(h)));
    const cells: CellData[] = cellResults.filter((c): c is CellData => c !== null);

    if (cells.length === 0) {
      return errors.noPHHMatch();
    }

    const match = findNearestPHH(lat, lng, cells);
    if (!match) {
      return errors.noPHHMatch();
    }

    const phhIdNum = parseInt(match.point.id.replace("PHH_", ""), 10);
    const coverage = expandCoverage(match.point.cov, phhIdNum);
    const availability = deriveAvailability(coverage);

    return jsonResponse(
      successResponse(
        {
          phh_id: phhIdNum,
          distance_meters: Math.round(match.distanceMeters),
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

function expandCoverage(compact: CompactCoverage, phhId: number): CoverageSnapshot {
  const thresholdOrder = ["<5_1", "5_1", "10_2", "25_5", "50_10"] as const;

  function hasAtLeast(maxThreshold: string, target: string): boolean {
    const maxIdx = thresholdOrder.indexOf(maxThreshold as typeof thresholdOrder[number]);
    const targetIdx = thresholdOrder.indexOf(target as typeof thresholdOrder[number]);
    if (maxIdx === -1 || targetIdx === -1) return false;
    return maxIdx >= targetIdx;
  }

  return {
    phh_id: phhId,
    dataset_variant: "current",
    combined_lt5_1: hasAtLeast(compact.c, "<5_1"),
    wired_lt5_1: hasAtLeast(compact.w, "<5_1"),
    wireless_lt5_1: hasAtLeast(compact.x, "<5_1"),
    combined_5_1: hasAtLeast(compact.c, "5_1"),
    wired_5_1: hasAtLeast(compact.w, "5_1"),
    wireless_5_1: hasAtLeast(compact.x, "5_1"),
    combined_10_2: hasAtLeast(compact.c, "10_2"),
    wired_10_2: hasAtLeast(compact.w, "10_2"),
    wireless_10_2: hasAtLeast(compact.x, "10_2"),
    combined_25_5: hasAtLeast(compact.c, "25_5"),
    wired_25_5: hasAtLeast(compact.w, "25_5"),
    wireless_25_5: hasAtLeast(compact.x, "25_5"),
    combined_50_10: hasAtLeast(compact.c, "50_10"),
    wired_50_10: hasAtLeast(compact.w, "50_10"),
    wireless_50_10: hasAtLeast(compact.x, "50_10"),
    avail_lte_mobile: compact.lte,
    combined_max_threshold: compact.c,
    wired_max_threshold: compact.w,
    wireless_max_threshold: compact.x,
    satellite_max_threshold: compact.s,
    ingested_at: compact.at,
  };
}
