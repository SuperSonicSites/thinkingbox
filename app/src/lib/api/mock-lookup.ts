import type {
  LookupResult,
  GeocodeResult,
  CoverageSnapshot,
  ISPAtLocation,
} from "@/types";
import { computeConfidence } from "@/lib/confidence/scoring";
import { deriveAvailability } from "@/lib/plans/resolver";
import { generateLookupId } from "./utils";

/**
 * Province-based mock coverage profiles.
 * Urban areas get better speeds; rural/northern areas get lower tiers.
 */
const PROVINCE_PROFILES: Record<string, { tier: string; providers: MockProvider[] }> = {
  ON: {
    tier: "urban",
    providers: [
      { name: "Bell Canada", tech: "Fibre", techFr: "Fibre" },
      { name: "Rogers Communications", tech: "Cable", techFr: "C\u00e2ble" },
      { name: "TekSavvy Solutions", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  QC: {
    tier: "urban",
    providers: [
      { name: "Bell Canada", tech: "Fibre", techFr: "Fibre" },
      { name: "Vid\u00e9otron", tech: "Cable", techFr: "C\u00e2ble" },
      { name: "Cogeco Connexion", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  BC: {
    tier: "urban",
    providers: [
      { name: "TELUS Communications", tech: "Fibre", techFr: "Fibre" },
      { name: "Shaw Communications", tech: "Cable", techFr: "C\u00e2ble" },
      { name: "Novus Entertainment", tech: "Fibre", techFr: "Fibre" },
    ],
  },
  AB: {
    tier: "urban",
    providers: [
      { name: "TELUS Communications", tech: "Fibre", techFr: "Fibre" },
      { name: "Shaw Communications", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  MB: {
    tier: "mid",
    providers: [
      { name: "Bell MTS", tech: "Fibre", techFr: "Fibre" },
      { name: "Shaw Communications", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  SK: {
    tier: "mid",
    providers: [
      { name: "SaskTel", tech: "Fibre", techFr: "Fibre" },
      { name: "Shaw Communications", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  NS: {
    tier: "mid",
    providers: [
      { name: "Bell Aliant", tech: "Fibre", techFr: "Fibre" },
      { name: "Eastlink", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  NB: {
    tier: "mid",
    providers: [
      { name: "Bell Aliant", tech: "Fibre", techFr: "Fibre" },
      { name: "Rogers Communications", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  NL: {
    tier: "mid",
    providers: [
      { name: "Bell Aliant", tech: "Fibre", techFr: "Fibre" },
      { name: "Eastlink", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  PE: {
    tier: "rural",
    providers: [
      { name: "Bell Aliant", tech: "DSL", techFr: "DSL" },
      { name: "Eastlink", tech: "Cable", techFr: "C\u00e2ble" },
    ],
  },
  NT: {
    tier: "northern",
    providers: [
      { name: "Northwestel", tech: "DSL", techFr: "DSL" },
    ],
  },
  YT: {
    tier: "northern",
    providers: [
      { name: "Northwestel", tech: "Fibre", techFr: "Fibre" },
    ],
  },
  NU: {
    tier: "northern",
    providers: [
      { name: "Northwestel", tech: "Satellite", techFr: "Satellite" },
    ],
  },
};

interface MockProvider {
  name: string;
  tech: string;
  techFr: string;
}

function makeMockSnapshot(tier: string): CoverageSnapshot {
  const now = new Date();
  now.setHours(now.getHours() - 48);

  const base: CoverageSnapshot = {
    phh_id: 1000000 + Math.floor(Math.random() * 9000000),
    dataset_variant: "current",
    combined_lt5_1: true,
    wired_lt5_1: false,
    wireless_lt5_1: true,
    combined_5_1: true,
    wired_5_1: false,
    wireless_5_1: true,
    combined_10_2: false,
    wired_10_2: false,
    wireless_10_2: false,
    combined_25_5: false,
    wired_25_5: false,
    wireless_25_5: false,
    combined_50_10: false,
    wired_50_10: false,
    wireless_50_10: false,
    avail_lte_mobile: true,
    combined_max_threshold: "5_1",
    wired_max_threshold: "",
    wireless_max_threshold: "5_1",
    satellite_max_threshold: "25_5",
    ingested_at: now.toISOString(),
  };

  if (tier === "urban") {
    base.combined_50_10 = true;
    base.combined_25_5 = true;
    base.combined_10_2 = true;
    base.combined_5_1 = true;
    base.wired_50_10 = true;
    base.wired_25_5 = true;
    base.wired_10_2 = true;
    base.wired_5_1 = true;
    base.wired_lt5_1 = true;
    base.wireless_50_10 = true;
    base.wireless_25_5 = true;
    base.wireless_10_2 = true;
    base.combined_max_threshold = "50_10";
    base.wired_max_threshold = "50_10";
    base.wireless_max_threshold = "50_10";
  } else if (tier === "mid") {
    base.combined_25_5 = true;
    base.combined_10_2 = true;
    base.combined_5_1 = true;
    base.wired_25_5 = true;
    base.wired_10_2 = true;
    base.wired_5_1 = true;
    base.wired_lt5_1 = true;
    base.wireless_10_2 = true;
    base.combined_max_threshold = "25_5";
    base.wired_max_threshold = "25_5";
    base.wireless_max_threshold = "10_2";
  } else if (tier === "rural") {
    base.combined_10_2 = true;
    base.combined_5_1 = true;
    base.wired_5_1 = true;
    base.wired_lt5_1 = true;
    base.wireless_10_2 = true;
    base.combined_max_threshold = "10_2";
    base.wired_max_threshold = "5_1";
    base.wireless_max_threshold = "10_2";
  }
  // "northern" keeps the base defaults (5_1 wireless only)

  return base;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeMockProviders(providers: MockProvider[]): ISPAtLocation[] {
  return providers.map((p) => ({
    provider: {
      name: p.name,
      slug: slugify(p.name),
      website_url: null,
    },
    technology: p.tech,
    technology_fr: p.techFr,
    plans: [],
    has_pricing: false,
  }));
}

/**
 * Generate a full mock LookupResult from a geocode result.
 * Used when no database is available (dev without PostgreSQL).
 */
export function performMockLookup(
  geocode: GeocodeResult,
  rawInput: string
): LookupResult {
  const province = geocode.province ?? "ON";
  const profile = PROVINCE_PROFILES[province] ?? PROVINCE_PROFILES.ON;
  const snapshot = makeMockSnapshot(profile.tier);
  const availability = deriveAvailability(snapshot);
  const distanceMeters = 50 + Math.random() * 200;

  const confidence = computeConfidence({
    distanceMeters,
    csdMatch: true,
    freshnessHours: 48,
    discrepancyCount: 0,
  });

  return {
    lookup_id: generateLookupId(),
    address: {
      raw_input: rawInput,
      normalized: geocode.normalized_address,
      latitude: geocode.latitude,
      longitude: geocode.longitude,
      postal_code: geocode.postal_code,
      province: geocode.province,
      city: geocode.city,
    },
    availability,
    confidence,
    providers: makeMockProviders(profile.providers),
    provenance: {
      data_source: "ISED National Broadband Data (Mock)",
      phh_id: snapshot.phh_id,
      snapshot_date: snapshot.ingested_at,
      freshness_hours: 48,
    },
    created_at: new Date().toISOString(),
  };
}
