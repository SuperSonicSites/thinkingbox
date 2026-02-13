import type { SpeedThreshold } from "@/types";

/**
 * Compact coverage data embedded in each PHH point.
 * c=combined, w=wired, x=wireless, s=satellite max thresholds.
 * lte=LTE mobile availability, at=ingested timestamp.
 */
export interface CompactCoverage {
  c: SpeedThreshold;
  w: SpeedThreshold;
  x: SpeedThreshold;
  s: SpeedThreshold;
  lte: boolean;
  at: string; // ISO timestamp
}

/** A single PHH point within a geohash cell. */
export interface CellPoint {
  id: string;    // PHH_ID as string (e.g., "PHH_123456")
  lat: number;
  lng: number;
  hex: string;   // HEXUID
  prov: string;  // Province code (lowercase)
  cov: CompactCoverage;
}

/** CSD (Census Subdivision) info attached to a cell. */
export interface CSDInfo {
  uid: string;
  en: string;
  fr: string;
}

/** Data stored in each cells/{geohash6}.json file. */
export interface CellData {
  csd: CSDInfo;
  points: CellPoint[];
}

/** ISP entry stored in isps/{hexuid}.json files. */
export interface ISPEntry {
  name: string;
  tech_en: string;
  tech_fr: string;
}

/** A single provider plan in the plans bundle. */
export interface BundledPlan {
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

/** The full plans.json bundle. */
export interface PlansBundle {
  plans: BundledPlan[];
}

/** Result from the PHH matcher. */
export interface PHHMatchResult {
  point: CellPoint;
  distanceMeters: number;
  csd: CSDInfo;
}
