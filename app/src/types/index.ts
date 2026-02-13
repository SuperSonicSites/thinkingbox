// Speed tier enum
export type SpeedThreshold = "" | "<5_1" | "5_1" | "10_2" | "25_5" | "50_10";

// Dataset variants from ISED data
export type DatasetVariant = "current" | "cib" | "ubf_core" | "ubf_rrs" | "government_support" | "private_expansions";

// Technology types (from ISP_Hex_FSI.csv)
export type TechnologyType = "Fibre" | "Cable" | "DSL" | "Fixed Wireless" | "Satellite" | "Mobile Wireless";

// Confidence level
export type ConfidenceLevel = "high" | "medium" | "low";

// PHH point from phh_points table
export interface PHHPoint {
  phh_id: number;
  type: number;
  pop_2021: number;
  total_dwellings_2021: number;
  usual_res_dwellings_2021: number;
  dbuid: string;
  hexuid: string;
  province_code: string;
  latitude: number;
  longitude: number;
}

// Coverage snapshot from phh_coverage_snapshots
export interface CoverageSnapshot {
  phh_id: number;
  dataset_variant: DatasetVariant;
  combined_lt5_1: boolean;
  wired_lt5_1: boolean;
  wireless_lt5_1: boolean;
  combined_5_1: boolean;
  wired_5_1: boolean;
  wireless_5_1: boolean;
  combined_10_2: boolean;
  wired_10_2: boolean;
  wireless_10_2: boolean;
  combined_25_5: boolean;
  wired_25_5: boolean;
  wireless_25_5: boolean;
  combined_50_10: boolean;
  wired_50_10: boolean;
  wireless_50_10: boolean;
  avail_lte_mobile: boolean;
  combined_max_threshold: SpeedThreshold;
  wired_max_threshold: SpeedThreshold;
  wireless_max_threshold: SpeedThreshold;
  satellite_max_threshold: SpeedThreshold;
  ingested_at: string;
}

// Hex ISP entry
export interface HexISPCoverage {
  hexuid: string;
  provider_name: string;
  technology_en: string;
  technology_fr: string;
}

// Provider
export interface Provider {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
  affiliate_status: string;
}

// Provider plan
export interface ProviderPlan {
  id: number;
  provider_id: number;
  provider_name: string;
  region_code: string;
  technology: string;
  plan_name: string;
  speed_down: number;
  speed_up: number;
  monthly_price: number;
  promo_price: number | null;
  promo_months: number;
  contract_months: number;
  data_cap_gb: number | null;
  install_fee: number;
  source: string;
  source_url: string | null;
  last_verified_at: string;
  stale_flag: boolean;
}

// Geocode result
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  normalized_address: string;
  postal_code: string | null;
  province: string | null;
  city: string | null;
  provider: string; // "mock" | "google"
}

// Confidence score breakdown
export interface ConfidenceBreakdown {
  overall: number; // 0-100
  level: ConfidenceLevel;
  spatial_score: number; // 0-100
  concordance_score: number; // 0-100
  freshness_score: number; // 0-100
  discrepancy_score: number; // 0-100
  nearest_phh_distance_meters: number;
  csd_match: string | null;
}

// Availability classification
export type AvailabilityClass = "50_10_plus" | "25_5" | "10_2" | "5_1" | "lt5_1" | "unknown_or_unserved";

// Availability result for a single connection type
export interface AvailabilityDetail {
  available: boolean;
  max_threshold: SpeedThreshold;
  availability_class: AvailabilityClass;
}

// Full availability summary
export interface AvailabilitySummary {
  combined: AvailabilityDetail;
  wired: AvailabilityDetail;
  wireless: AvailabilityDetail;
  satellite_max_threshold: SpeedThreshold;
  lte_mobile_available: boolean;
  wireless_dependent: boolean; // wired unavailable but wireless available
}

// ISP at location (provider + plans if available)
export interface ISPAtLocation {
  provider: {
    name: string;
    slug: string;
    website_url: string | null;
  };
  technology: string;
  technology_fr: string;
  plans: ProviderPlan[];
  has_pricing: boolean; // false = "Pricing Coming Soon"
}

// Full lookup result
export interface LookupResult {
  lookup_id: string;
  address: {
    raw_input: string;
    normalized: string;
    latitude: number;
    longitude: number;
    postal_code: string | null;
    province: string | null;
    city: string | null;
  };
  availability: AvailabilitySummary;
  confidence: ConfidenceBreakdown;
  providers: ISPAtLocation[];
  provenance: {
    data_source: string;
    phh_id: number;
    snapshot_date: string;
    freshness_hours: number;
  };
  created_at: string;
}

// API standard response envelope
export interface APIResponse<T> {
  data: T | null;
  error: APIError | null;
  meta: APIMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

export interface APIMeta {
  request_id: string;
  timestamp: string;
  cached: boolean;
  locale: "en" | "fr";
}

// Lookup request
export interface LookupRequest {
  address: string;
  city?: string;
  province?: string;
  postal_code?: string;
}

// Discrepancy report request
export interface DiscrepancyRequest {
  address_id?: number;
  phh_id?: number;
  reporter_email?: string;
  report_type: "wrong_provider" | "wrong_speed" | "missing_provider" | "pricing_error" | "other";
  description: string;
}

// Locale type
export type Locale = "en" | "fr";
