import type {
  CoverageSnapshot,
  HexISPCoverage,
  AvailabilitySummary,
  AvailabilityDetail,
  AvailabilityClass,
  ISPAtLocation,
  SpeedThreshold,
} from "@/types";
import type { SQL } from "@/lib/db/connection";
import { getISPsForHex, getPlansForProvider } from "@/lib/db/queries";

/**
 * Derive the availability summary from a PHH coverage snapshot.
 * Implements PRD Section 9 decision rules.
 */
export function deriveAvailability(
  snapshot: CoverageSnapshot
): AvailabilitySummary {
  const combined = classifyAvailability(
    snapshot.combined_max_threshold,
    snapshot.combined_50_10,
    snapshot.combined_25_5,
    snapshot.combined_10_2,
    snapshot.combined_5_1,
    snapshot.combined_lt5_1
  );

  const wired = classifyAvailability(
    snapshot.wired_max_threshold,
    snapshot.wired_50_10,
    snapshot.wired_25_5,
    snapshot.wired_10_2,
    snapshot.wired_5_1,
    snapshot.wired_lt5_1
  );

  const wireless = classifyAvailability(
    snapshot.wireless_max_threshold,
    snapshot.wireless_50_10,
    snapshot.wireless_25_5,
    snapshot.wireless_10_2,
    snapshot.wireless_5_1,
    snapshot.wireless_lt5_1
  );

  // PRD Rule 2: wireless-dependent if wired unavailable but wireless available
  const wirelessDependent =
    !wired.available && wireless.available;

  return {
    combined,
    wired,
    wireless,
    satellite_max_threshold: snapshot.satellite_max_threshold,
    lte_mobile_available: snapshot.avail_lte_mobile,
    wireless_dependent: wirelessDependent,
  };
}

/**
 * Classify a single connection type's availability.
 */
function classifyAvailability(
  maxThreshold: SpeedThreshold,
  has50_10: boolean,
  has25_5: boolean,
  has10_2: boolean,
  has5_1: boolean,
  hasLt5_1: boolean
): AvailabilityDetail {
  // PRD Rule 1: 50_10 threshold = 50_10_plus
  if (maxThreshold === "50_10" || has50_10) {
    return { available: true, max_threshold: "50_10", availability_class: "50_10_plus" };
  }
  if (maxThreshold === "25_5" || has25_5) {
    return { available: true, max_threshold: "25_5", availability_class: "25_5" };
  }
  if (maxThreshold === "10_2" || has10_2) {
    return { available: true, max_threshold: "10_2", availability_class: "10_2" };
  }
  if (maxThreshold === "5_1" || has5_1) {
    return { available: true, max_threshold: "5_1", availability_class: "5_1" };
  }
  if (maxThreshold === "<5_1" || hasLt5_1) {
    return { available: true, max_threshold: "<5_1", availability_class: "lt5_1" };
  }

  // PRD Rule 3: empty enum + all booleans false = unknown_or_unserved
  return { available: false, max_threshold: "", availability_class: "unknown_or_unserved" };
}

/**
 * Resolve all ISPs and their plans for a given hex + province.
 * This is the core "plan-to-location join logic" from PRD Section 8.5.
 */
export async function resolveISPsAtLocation(
  sql: SQL,
  hexuid: string,
  provinceCode: string
): Promise<ISPAtLocation[]> {
  const hexISPs = await getISPsForHex(sql, hexuid);

  if (hexISPs.length === 0) return [];

  // Group by provider to deduplicate (a provider may serve via multiple technologies)
  const providerMap = new Map<string, HexISPCoverage[]>();
  for (const isp of hexISPs) {
    const existing = providerMap.get(isp.provider_name) ?? [];
    existing.push(isp);
    providerMap.set(isp.provider_name, existing);
  }

  const results: ISPAtLocation[] = [];

  for (const [providerName, entries] of providerMap) {
    // For each technology this provider offers at this hex
    for (const entry of entries) {
      const technologyKey = mapTechnologyToDBKey(entry.technology_en);
      const plans = await getPlansForProvider(
        sql,
        providerName,
        technologyKey,
        provinceCode
      );

      results.push({
        provider: {
          name: providerName,
          slug: slugify(providerName),
          website_url: null, // Populated from providers table if needed
        },
        technology: entry.technology_en,
        technology_fr: entry.technology_fr,
        plans,
        has_pricing: plans.length > 0,
      });
    }
  }

  // Sort: providers with plans first, then alphabetically
  results.sort((a, b) => {
    if (a.has_pricing && !b.has_pricing) return -1;
    if (!a.has_pricing && b.has_pricing) return 1;
    return a.provider.name.localeCompare(b.provider.name);
  });

  return results;
}

/**
 * Map ISED technology names to our provider_plans technology column values.
 */
function mapTechnologyToDBKey(isedTechnology: string): string {
  const mapping: Record<string, string> = {
    "Fibre": "Fibre",
    "Cable": "Cable",
    "DSL": "DSL",
    "Fixed Wireless": "Fixed Wireless",
    "Satellite": "Satellite",
    "Mobile Wireless": "Mobile Wireless",
    "Mobile": "Mobile Wireless",
  };
  return mapping[isedTechnology] ?? isedTechnology;
}

/**
 * Generate URL-safe slug from provider name.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get a human-readable label for an availability class.
 */
export function availabilityClassLabel(
  cls: AvailabilityClass,
  locale: "en" | "fr" = "en"
): string {
  const labels: Record<AvailabilityClass, { en: string; fr: string }> = {
    "50_10_plus": { en: "50/10 Mbps+", fr: "50/10 Mbit/s+" },
    "25_5": { en: "25/5 Mbps", fr: "25/5 Mbit/s" },
    "10_2": { en: "10/2 Mbps", fr: "10/2 Mbit/s" },
    "5_1": { en: "5/1 Mbps", fr: "5/1 Mbit/s" },
    "lt5_1": { en: "Below 5/1 Mbps", fr: "Sous 5/1 Mbit/s" },
    "unknown_or_unserved": {
      en: "Unknown or unserved",
      fr: "Inconnu ou non desservi",
    },
  };
  return labels[cls][locale];
}
