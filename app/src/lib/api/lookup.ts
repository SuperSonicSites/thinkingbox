import type { SQL } from "@/lib/db/connection";
import type { LookupResult, Locale } from "@/types";
import { geocodeAddress } from "@/lib/geo/geocoder";
import {
  findNearestPHHPoints,
  getCoverageForPHH,
  findCSDForPoint,
  saveAddress,
  saveAddressPHHMatch,
  getDiscrepancyCount,
} from "@/lib/db/queries";
import { computeConfidence } from "@/lib/confidence/scoring";
import { deriveAvailability, resolveISPsAtLocation } from "@/lib/plans/resolver";
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
 * geocoding → PHH matching → coverage → ISP resolution → confidence scoring
 */
export async function performLookup(
  sql: SQL,
  params: LookupParams,
  env: LookupEnv,
  _locale: Locale = "en"
): Promise<LookupResult | null> {
  // Step 1: Geocode the address
  const fullAddress = buildFullAddress(params);
  const geocodeResult = await geocodeAddress(
    fullAddress,
    env.GEOCODE_PROVIDER,
    env.GOOGLE_PLACES_API_KEY
  );

  if (!geocodeResult) return null;

  // Step 2: Find nearest PHH points (with DB fallback)
  try {
    return await performDBLookup(sql, params, geocodeResult);
  } catch (dbError: unknown) {
    const isConnectionError =
      dbError instanceof Error &&
      ("code" in dbError && (dbError as { code?: string }).code === "ECONNREFUSED" ||
       dbError?.constructor?.name === "AggregateError");
    if (isConnectionError) {
      console.warn("[lookup] Database unavailable, using mock data");
      return performMockLookup(geocodeResult, params.address);
    }
    throw dbError;
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
 * Database-backed lookup. Runs the full PHH match → coverage → ISP pipeline.
 */
async function performDBLookup(
  sql: SQL,
  params: LookupParams,
  geocodeResult: import("@/types").GeocodeResult
): Promise<LookupResult | null> {
  let phhResults = await findNearestPHHPoints(
    sql,
    geocodeResult.latitude,
    geocodeResult.longitude,
    1000,
    5
  );

  if (phhResults.length === 0) {
    phhResults = await findNearestPHHPoints(
      sql,
      geocodeResult.latitude,
      geocodeResult.longitude,
      5000,
      5
    );
  }

  if (phhResults.length === 0) return null;

  const nearestPHH = phhResults[0];

  const coverage = await getCoverageForPHH(sql, nearestPHH.phh_id, "current");
  if (!coverage) return null;

  const csd = await findCSDForPoint(
    sql,
    geocodeResult.latitude,
    geocodeResult.longitude
  );

  const freshnessHours = computeFreshnessHours(coverage.ingested_at);
  const discrepancyCount = await getDiscrepancyCount(sql, nearestPHH.phh_id);

  const confidence = computeConfidence({
    distanceMeters: nearestPHH.distance_meters,
    csdMatch: csd !== null,
    freshnessHours,
    discrepancyCount,
  });

  const availability = deriveAvailability(coverage);

  const providers = await resolveISPsAtLocation(
    sql,
    nearestPHH.hexuid,
    nearestPHH.province_code
  );

  const addressId = await saveAddress(sql, {
    raw_input: params.address,
    normalized_address: geocodeResult.normalized_address,
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
    postal_code: geocodeResult.postal_code,
    province: geocodeResult.province,
    city: geocodeResult.city,
    geocode_provider: geocodeResult.provider,
  });

  await saveAddressPHHMatch(sql, {
    address_id: addressId,
    phh_id: nearestPHH.phh_id,
    distance_meters: nearestPHH.distance_meters,
    rank: 1,
    confidence_score: confidence.overall,
    spatial_score: confidence.spatial_score,
    concordance_score: confidence.concordance_score,
    freshness_score: confidence.freshness_score,
    discrepancy_score: confidence.discrepancy_score,
    csd_match: csd?.csd_uid ?? null,
  });

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
      phh_id: nearestPHH.phh_id,
      snapshot_date: coverage.ingested_at,
      freshness_hours: Math.round(freshnessHours),
    },
    created_at: new Date().toISOString(),
  };
}
