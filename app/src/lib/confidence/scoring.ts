import type { ConfidenceBreakdown, ConfidenceLevel } from "@/types";

/** Weights for confidence formula v1 (from PRD Section 9.4) */
const WEIGHTS = {
  spatial: 0.4,
  concordance: 0.3,
  freshness: 0.2,
  discrepancy: 0.1,
} as const;

/** Distance thresholds in meters for spatial scoring */
const SPATIAL_THRESHOLDS = {
  excellent: 50, // <50m = 100 score
  good: 150, // <150m = 80 score
  acceptable: 500, // <500m = 60 score
  marginal: 1000, // <1000m = 40 score
  poor: 2000, // <2000m = 20 score
  // >2000m = 0 score
} as const;

/** Max freshness age in hours before score drops to 0 */
const MAX_FRESHNESS_HOURS = 8760; // 365 days

/** Threshold for suppressing "best plan" recommendation */
export const CONFIDENCE_SUPPRESSION_THRESHOLD = 60;

/**
 * Compute the full confidence score for a PHH match.
 */
export function computeConfidence(params: {
  distanceMeters: number;
  csdMatch: boolean;
  freshnessHours: number;
  discrepancyCount: number;
}): ConfidenceBreakdown {
  const spatialScore = computeSpatialScore(params.distanceMeters);
  const concordanceScore = computeConcordanceScore(params.csdMatch);
  const freshnessScore = computeFreshnessScore(params.freshnessHours);
  const discrepancyScore = computeDiscrepancyScore(params.discrepancyCount);

  const overall = Math.round(
    spatialScore * WEIGHTS.spatial +
      concordanceScore * WEIGHTS.concordance +
      freshnessScore * WEIGHTS.freshness +
      discrepancyScore * WEIGHTS.discrepancy
  );

  const clampedOverall = Math.max(0, Math.min(100, overall));

  return {
    overall: clampedOverall,
    level: scoreToLevel(clampedOverall),
    spatial_score: Math.round(spatialScore),
    concordance_score: Math.round(concordanceScore),
    freshness_score: Math.round(freshnessScore),
    discrepancy_score: Math.round(discrepancyScore),
    nearest_phh_distance_meters: params.distanceMeters,
    csd_match: params.csdMatch ? "matched" : "unmatched",
  };
}

/**
 * Spatial score: closer PHH = higher score.
 * Uses stepped thresholds rather than linear interpolation
 * for clearer mental model.
 */
function computeSpatialScore(distanceMeters: number): number {
  if (distanceMeters <= SPATIAL_THRESHOLDS.excellent) return 100;
  if (distanceMeters <= SPATIAL_THRESHOLDS.good) {
    return lerp(100, 80, distanceMeters, SPATIAL_THRESHOLDS.excellent, SPATIAL_THRESHOLDS.good);
  }
  if (distanceMeters <= SPATIAL_THRESHOLDS.acceptable) {
    return lerp(80, 60, distanceMeters, SPATIAL_THRESHOLDS.good, SPATIAL_THRESHOLDS.acceptable);
  }
  if (distanceMeters <= SPATIAL_THRESHOLDS.marginal) {
    return lerp(60, 40, distanceMeters, SPATIAL_THRESHOLDS.acceptable, SPATIAL_THRESHOLDS.marginal);
  }
  if (distanceMeters <= SPATIAL_THRESHOLDS.poor) {
    return lerp(40, 20, distanceMeters, SPATIAL_THRESHOLDS.marginal, SPATIAL_THRESHOLDS.poor);
  }
  // Beyond 2km: linear decay from 20 to 0 over next 3km
  return Math.max(0, lerp(20, 0, distanceMeters, SPATIAL_THRESHOLDS.poor, 5000));
}

/**
 * Concordance score: does the geocoded address fall within
 * the expected Census Subdivision?
 * Binary for v1 — future versions may add postal code concordance.
 */
function computeConcordanceScore(csdMatch: boolean): number {
  return csdMatch ? 100 : 30;
}

/**
 * Freshness score: newer data = higher score.
 * Linear decay from 100 (just ingested) to 0 (1 year old).
 */
function computeFreshnessScore(ageHours: number): number {
  if (ageHours <= 0) return 100;
  if (ageHours >= MAX_FRESHNESS_HOURS) return 0;
  return 100 * (1 - ageHours / MAX_FRESHNESS_HOURS);
}

/**
 * Discrepancy score: fewer reports = higher score.
 * 0 reports = 100, 1 = 70, 2 = 50, 3+ = 30, 5+ = 10, 10+ = 0
 */
function computeDiscrepancyScore(count: number): number {
  if (count === 0) return 100;
  if (count === 1) return 70;
  if (count === 2) return 50;
  if (count <= 4) return 30;
  if (count <= 9) return 10;
  return 0;
}

/**
 * Map a numeric score to a confidence level.
 */
function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Linear interpolation between two values based on position between bounds.
 */
function lerp(
  outMin: number,
  outMax: number,
  value: number,
  inMin: number,
  inMax: number
): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

/**
 * Check if a confidence score is above the suppression threshold.
 * Used to decide whether to show "best plan" recommendation.
 */
export function shouldShowRecommendation(confidenceScore: number): boolean {
  return confidenceScore >= CONFIDENCE_SUPPRESSION_THRESHOLD;
}
