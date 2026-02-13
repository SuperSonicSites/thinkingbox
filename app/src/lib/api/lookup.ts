import type { LookupResult, Locale, CoverageSnapshot, ProviderPlan } from "@/types";
import { geocodeAddress } from "@/lib/geo/geocoder";
import { encodeGeohash, getNeighbors } from "@/lib/geo/geohash";
import { findNearestPHH } from "@/lib/data/phh-matcher";
import { getDataClient, type DataClient } from "@/lib/data/r2-client";
import type { CellData, CompactCoverage, BundledPlan } from "@/lib/data/types";
import { computeConfidence } from "@/lib/confidence/scoring";
import { deriveAvailability, resolveISPsFromData } from "@/lib/plans/resolver";
import { generateLookupId } from "./utils";
import { performMockLookup } from "./mock-lookup";

interface LookupParams {
  address: string;
  city?: string;
  province?: string;
  postal_code?: string;
}

interface LookupEnv {
  GEOCODE_PROVIDER: string;
  GOOGLE_PLACES_API_KEY?: string;
}

/**
 * Execute a full address lookup.
 * This is the core orchestration function that ties together:
 * geocoding -> geohash cell lookup -> PHH matching -> coverage -> ISP resolution -> confidence scoring
 */
export async function performLookup(
  env: Record<string, unknown>,
  params: LookupParams,
  lookupEnv: LookupEnv,
  _locale: Locale = "en"
): Promise<LookupResult | null> {
  // Step 1: Geocode the address
  const fullAddress = buildFullAddress(params);
  const geocodeResult = await geocodeAddress(
    fullAddress,
    lookupEnv.GEOCODE_PROVIDER,
    lookupEnv.GOOGLE_PLACES_API_KEY
  );

  if (!geocodeResult) return null;

  // Step 2: Look up data via R2/KV (with mock fallback)
  try {
    const client = getDataClient(env);
    return await performDataLookup(client, params, geocodeResult);
  } catch (dataError: unknown) {
    console.warn("[lookup] Data client error, using mock data:", dataError);
    return performMockLookup(geocodeResult, params.address);
  }
}

/**
 * Build a full address string from parts.
 */
function buildFullAddress(params: LookupParams): string {
  const parts = [params.address];
  if (params.city) parts.push(params.city);
  if (params.province) parts.push(params.province);
  if (params.postal_code) parts.push(params.postal_code);
  return parts.join(", ");
}

/**
 * Compute hours since a timestamp.
 */
function computeFreshnessHours(isoTimestamp: string): number {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  return Math.max(0, (now - then) / (1000 * 60 * 60));
}

/**
 * Expand compact coverage to full CoverageSnapshot for deriveAvailability().
 */
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

/**
 * R2/KV-backed lookup. Fetches geohash cells, finds nearest PHH,
 * resolves ISPs and plans from pre-computed data.
 */
async function performDataLookup(
  client: DataClient,
  params: LookupParams,
  geocodeResult: import("@/types").GeocodeResult
): Promise<LookupResult | null> {
  const { latitude, longitude } = geocodeResult;

  // Step 2: Compute geohash and fetch 9 cells (center + 8 neighbors)
  const centerHash = encodeGeohash(latitude, longitude, 6);
  const neighborHashes = getNeighbors(centerHash);
  const allHashes = [centerHash, ...neighborHashes];

  // Fetch all 9 cells in parallel
  const cellPromises = allHashes.map((h) => client.getCellData(h));
  const cellResults = await Promise.all(cellPromises);
  const cells: CellData[] = cellResults.filter((c): c is CellData => c !== null);

  if (cells.length === 0) return null;

  // Step 3: Find nearest PHH point via haversine distance
  const match = findNearestPHH(latitude, longitude, cells);
  if (!match) return null;

  // Step 4: Extract coverage from the matched point
  const phhIdNum = parseInt(match.point.id.replace("PHH_", ""), 10);
  const coverage = expandCoverage(match.point.cov, phhIdNum);

  // Step 5: Compute confidence
  const freshnessHours = computeFreshnessHours(match.point.cov.at);
  const csdMatched = match.csd.uid !== "";

  // Discrepancy count is 0 for pre-computed data (no D1 lookup yet)
  const discrepancyCount = 0;

  const confidence = computeConfidence({
    distanceMeters: match.distanceMeters,
    csdMatch: csdMatched,
    freshnessHours,
    discrepancyCount,
  });

  // Step 6: Derive availability
  const availability = deriveAvailability(coverage);

  // Step 7: Resolve ISPs and plans
  const ispEntries = await client.getISPsForHex(match.point.hex);
  const plansBundle = await client.getPlans();
  const providers = resolveISPsFromData(
    ispEntries,
    plansBundle.plans,
    match.point.prov
  );

  const lookupId = generateLookupId();

  return {
    lookup_id: lookupId,
    address: {
      raw_input: params.address,
      normalized: geocodeResult.normalized_address,
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      postal_code: geocodeResult.postal_code,
      province: geocodeResult.province,
      city: geocodeResult.city,
    },
    availability,
    confidence,
    providers,
    provenance: {
      data_source: "ISED National Broadband Data",
      phh_id: phhIdNum,
      snapshot_date: match.point.cov.at,
      freshness_hours: Math.round(freshnessHours),
    },
    created_at: new Date().toISOString(),
  };
}
