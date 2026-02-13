import type { SQL } from "./connection";
import type {
  PHHPoint,
  CoverageSnapshot,
  HexISPCoverage,
  ProviderPlan,
  DatasetVariant,
} from "@/types";

export interface NearestPHHResult extends PHHPoint {
  distance_meters: number;
}

/**
 * Find nearest PHH points to a given lat/lng within a radius.
 * Uses ST_DWithin for spatial index efficiency.
 */
export async function findNearestPHHPoints(
  sql: SQL,
  latitude: number,
  longitude: number,
  radiusMeters: number = 1000,
  limit: number = 5
): Promise<NearestPHHResult[]> {
  const rows = await sql`
    SELECT
      phh_id,
      type,
      pop_2021,
      total_dwellings_2021,
      usual_res_dwellings_2021,
      dbuid,
      hexuid,
      province_code,
      latitude,
      longitude,
      ST_Distance(
        geometry,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) AS distance_meters
    FROM phh_points
    WHERE ST_DWithin(
      geometry,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
      ${radiusMeters}
    )
    ORDER BY geometry <-> ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    phh_id: Number(row.phh_id),
    type: Number(row.type),
    pop_2021: Number(row.pop_2021),
    total_dwellings_2021: Number(row.total_dwellings_2021),
    usual_res_dwellings_2021: Number(row.usual_res_dwellings_2021),
    dbuid: String(row.dbuid),
    hexuid: String(row.hexuid),
    province_code: String(row.province_code),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distance_meters: Number(row.distance_meters),
  }));
}

/**
 * Get coverage snapshot for a PHH point.
 */
export async function getCoverageForPHH(
  sql: SQL,
  phhId: number,
  variant: DatasetVariant = "current"
): Promise<CoverageSnapshot | null> {
  const rows = await sql`
    SELECT *
    FROM phh_coverage_snapshots
    WHERE phh_id = ${phhId}
      AND dataset_variant = ${variant}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    phh_id: Number(row.phh_id),
    dataset_variant: String(row.dataset_variant) as DatasetVariant,
    combined_lt5_1: Boolean(row.combined_lt5_1),
    wired_lt5_1: Boolean(row.wired_lt5_1),
    wireless_lt5_1: Boolean(row.wireless_lt5_1),
    combined_5_1: Boolean(row.combined_5_1),
    wired_5_1: Boolean(row.wired_5_1),
    wireless_5_1: Boolean(row.wireless_5_1),
    combined_10_2: Boolean(row.combined_10_2),
    wired_10_2: Boolean(row.wired_10_2),
    wireless_10_2: Boolean(row.wireless_10_2),
    combined_25_5: Boolean(row.combined_25_5),
    wired_25_5: Boolean(row.wired_25_5),
    wireless_25_5: Boolean(row.wireless_25_5),
    combined_50_10: Boolean(row.combined_50_10),
    wired_50_10: Boolean(row.wired_50_10),
    wireless_50_10: Boolean(row.wireless_50_10),
    avail_lte_mobile: Boolean(row.avail_lte_mobile),
    combined_max_threshold: String(row.combined_max_threshold || "") as CoverageSnapshot["combined_max_threshold"],
    wired_max_threshold: String(row.wired_max_threshold || "") as CoverageSnapshot["wired_max_threshold"],
    wireless_max_threshold: String(row.wireless_max_threshold || "") as CoverageSnapshot["wireless_max_threshold"],
    satellite_max_threshold: String(row.satellite_max_threshold || "") as CoverageSnapshot["satellite_max_threshold"],
    ingested_at: String(row.ingested_at),
  };
}

/**
 * Get ISP coverage entries for a given hex ID.
 */
export async function getISPsForHex(
  sql: SQL,
  hexuid: string
): Promise<HexISPCoverage[]> {
  const rows = await sql`
    SELECT hexuid, provider_name, technology_en, technology_fr
    FROM hex_isp_coverage
    WHERE hexuid = ${hexuid}
    ORDER BY provider_name
  `;

  return rows.map((row) => ({
    hexuid: String(row.hexuid),
    provider_name: String(row.provider_name),
    technology_en: String(row.technology_en),
    technology_fr: String(row.technology_fr),
  }));
}

/**
 * Get plans for a provider matching technology and region.
 */
export async function getPlansForProvider(
  sql: SQL,
  providerName: string,
  technology: string,
  regionCode: string
): Promise<ProviderPlan[]> {
  const rows = await sql`
    SELECT
      pp.id,
      pp.provider_id,
      p.name AS provider_name,
      pp.region_code,
      pp.technology,
      pp.plan_name,
      pp.speed_down,
      pp.speed_up,
      pp.monthly_price,
      pp.promo_price,
      pp.promo_months,
      pp.contract_months,
      pp.data_cap_gb,
      pp.install_fee,
      pp.source,
      pp.source_url,
      pp.last_verified_at,
      pp.stale_flag
    FROM provider_plans pp
    JOIN providers p ON p.id = pp.provider_id
    WHERE p.name = ${providerName}
      AND pp.technology = ${technology}
      AND pp.region_code = ${regionCode}
    ORDER BY pp.monthly_price ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    provider_id: Number(row.provider_id),
    provider_name: String(row.provider_name),
    region_code: String(row.region_code),
    technology: String(row.technology),
    plan_name: String(row.plan_name),
    speed_down: Number(row.speed_down),
    speed_up: Number(row.speed_up),
    monthly_price: Number(row.monthly_price),
    promo_price: row.promo_price != null ? Number(row.promo_price) : null,
    promo_months: Number(row.promo_months),
    contract_months: Number(row.contract_months),
    data_cap_gb: row.data_cap_gb != null ? Number(row.data_cap_gb) : null,
    install_fee: Number(row.install_fee),
    source: String(row.source),
    source_url: row.source_url != null ? String(row.source_url) : null,
    last_verified_at: String(row.last_verified_at),
    stale_flag: Boolean(row.stale_flag),
  }));
}

/**
 * Find the Census Subdivision containing a lat/lng point.
 */
export async function findCSDForPoint(
  sql: SQL,
  latitude: number,
  longitude: number
): Promise<{ csd_uid: string; name_en: string; name_fr: string; province: string } | null> {
  const rows = await sql`
    SELECT csd_uid, name_en, name_fr, province
    FROM census_subdivisions
    WHERE ST_Contains(
      geometry,
      ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
    )
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  return {
    csd_uid: String(rows[0].csd_uid),
    name_en: String(rows[0].name_en),
    name_fr: String(rows[0].name_fr),
    province: String(rows[0].province),
  };
}

/**
 * Save a geocoded address and return its ID.
 */
export async function saveAddress(
  sql: SQL,
  address: {
    raw_input: string;
    normalized_address: string | null;
    latitude: number;
    longitude: number;
    postal_code: string | null;
    province: string | null;
    city: string | null;
    geocode_provider: string;
  }
): Promise<number> {
  const rows = await sql`
    INSERT INTO addresses (
      raw_input, normalized_address, latitude, longitude,
      postal_code, province, city,
      geometry, geocode_provider
    ) VALUES (
      ${address.raw_input},
      ${address.normalized_address},
      ${address.latitude},
      ${address.longitude},
      ${address.postal_code},
      ${address.province},
      ${address.city},
      ST_SetSRID(ST_MakePoint(${address.longitude}, ${address.latitude}), 4326)::geography,
      ${address.geocode_provider}
    )
    RETURNING id
  `;

  return Number(rows[0].id);
}

/**
 * Save an address-to-PHH match.
 */
export async function saveAddressPHHMatch(
  sql: SQL,
  match: {
    address_id: number;
    phh_id: number;
    distance_meters: number;
    rank: number;
    confidence_score: number;
    spatial_score: number;
    concordance_score: number;
    freshness_score: number;
    discrepancy_score: number;
    csd_match: string | null;
  }
): Promise<number> {
  const rows = await sql`
    INSERT INTO address_phh_matches (
      address_id, phh_id, distance_meters, rank,
      confidence_score, spatial_score, concordance_score,
      freshness_score, discrepancy_score, csd_match
    ) VALUES (
      ${match.address_id}, ${match.phh_id}, ${match.distance_meters}, ${match.rank},
      ${match.confidence_score}, ${match.spatial_score}, ${match.concordance_score},
      ${match.freshness_score}, ${match.discrepancy_score}, ${match.csd_match}
    )
    RETURNING id
  `;

  return Number(rows[0].id);
}

/**
 * Save a discrepancy report.
 */
export async function saveDiscrepancyReport(
  sql: SQL,
  report: {
    address_id: number | null;
    phh_id: number | null;
    reporter_email: string | null;
    report_type: string;
    description: string;
  }
): Promise<number> {
  const rows = await sql`
    INSERT INTO discrepancy_reports (
      address_id, phh_id, reporter_email, report_type, description
    ) VALUES (
      ${report.address_id}, ${report.phh_id},
      ${report.reporter_email}, ${report.report_type}, ${report.description}
    )
    RETURNING id
  `;

  return Number(rows[0].id);
}

/**
 * Get discrepancy count for a PHH/hex to feed into confidence scoring.
 */
export async function getDiscrepancyCount(
  sql: SQL,
  phhId: number,
  sinceDays: number = 90
): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM discrepancy_reports
    WHERE phh_id = ${phhId}
      AND created_at > NOW() - INTERVAL '1 day' * ${sinceDays}
  `;

  return Number(rows[0].count);
}

/**
 * Get provider by slug.
 */
export async function getProviderBySlug(
  sql: SQL,
  slug: string
): Promise<{ id: number; name: string; slug: string; website_url: string | null } | null> {
  const rows = await sql`
    SELECT id, name, slug, website_url
    FROM providers
    WHERE slug = ${slug}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  return {
    id: Number(rows[0].id),
    name: String(rows[0].name),
    slug: String(rows[0].slug),
    website_url: rows[0].website_url != null ? String(rows[0].website_url) : null,
  };
}
