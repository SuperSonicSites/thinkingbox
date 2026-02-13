import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  shouldShowRecommendation,
  CONFIDENCE_SUPPRESSION_THRESHOLD,
} from "./scoring";

describe("computeConfidence", () => {
  it("returns high confidence for close match with fresh data", () => {
    const result = computeConfidence({
      distanceMeters: 30,
      csdMatch: true,
      freshnessHours: 24,
      discrepancyCount: 0,
    });

    expect(result.level).toBe("high");
    expect(result.overall).toBeGreaterThanOrEqual(90);
    expect(result.spatial_score).toBe(100);
    expect(result.concordance_score).toBe(100);
    expect(result.discrepancy_score).toBe(100);
    expect(result.csd_match).toBe("matched");
  });

  it("returns medium confidence for moderate distance", () => {
    const result = computeConfidence({
      distanceMeters: 1500,
      csdMatch: true,
      freshnessHours: 4000,
      discrepancyCount: 2,
    });

    expect(result.level).toBe("medium");
    expect(result.overall).toBeGreaterThanOrEqual(40);
    expect(result.overall).toBeLessThan(70);
  });

  it("returns low confidence for distant match with stale data", () => {
    const result = computeConfidence({
      distanceMeters: 4000,
      csdMatch: false,
      freshnessHours: 8000,
      discrepancyCount: 5,
    });

    expect(result.level).toBe("low");
    expect(result.overall).toBeLessThan(40);
  });

  it("clamps score to 0-100 range", () => {
    const result = computeConfidence({
      distanceMeters: 0,
      csdMatch: true,
      freshnessHours: 0,
      discrepancyCount: 0,
    });

    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.overall).toBeGreaterThanOrEqual(0);
  });

  describe("spatial scoring", () => {
    it("scores 100 for distances under 50m", () => {
      const result = computeConfidence({
        distanceMeters: 10,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.spatial_score).toBe(100);
    });

    it("scores between 80-100 for distances 50-150m", () => {
      const result = computeConfidence({
        distanceMeters: 100,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.spatial_score).toBeGreaterThanOrEqual(80);
      expect(result.spatial_score).toBeLessThanOrEqual(100);
    });

    it("scores 0 for distances beyond 5000m", () => {
      const result = computeConfidence({
        distanceMeters: 6000,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.spatial_score).toBe(0);
    });
  });

  describe("concordance scoring", () => {
    it("scores 100 for CSD match", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.concordance_score).toBe(100);
      expect(result.csd_match).toBe("matched");
    });

    it("scores 30 for CSD mismatch", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: false,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.concordance_score).toBe(30);
      expect(result.csd_match).toBe("unmatched");
    });
  });

  describe("freshness scoring", () => {
    it("scores 100 for brand new data", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.freshness_score).toBe(100);
    });

    it("scores ~50 for 6-month-old data", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 4380, // ~6 months
        discrepancyCount: 0,
      });
      expect(result.freshness_score).toBe(50);
    });

    it("scores 0 for data older than 1 year", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 9000,
        discrepancyCount: 0,
      });
      expect(result.freshness_score).toBe(0);
    });
  });

  describe("discrepancy scoring", () => {
    it("scores 100 for 0 reports", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      expect(result.discrepancy_score).toBe(100);
    });

    it("scores 70 for 1 report", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 1,
      });
      expect(result.discrepancy_score).toBe(70);
    });

    it("scores 0 for 10+ reports", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 15,
      });
      expect(result.discrepancy_score).toBe(0);
    });
  });

  describe("overall weights", () => {
    it("applies 40% spatial, 30% concordance, 20% freshness, 10% discrepancy", () => {
      const result = computeConfidence({
        distanceMeters: 0,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      // All sub-scores 100, so overall should be 100
      expect(result.overall).toBe(100);

      // Only spatial fails (beyond 5km)
      const spatialFail = computeConfidence({
        distanceMeters: 6000,
        csdMatch: true,
        freshnessHours: 0,
        discrepancyCount: 0,
      });
      // 0*0.4 + 100*0.3 + 100*0.2 + 100*0.1 = 60
      expect(spatialFail.overall).toBe(60);
    });
  });
});

describe("shouldShowRecommendation", () => {
  it("returns true for scores at or above threshold", () => {
    expect(shouldShowRecommendation(CONFIDENCE_SUPPRESSION_THRESHOLD)).toBe(
      true
    );
    expect(shouldShowRecommendation(100)).toBe(true);
  });

  it("returns false for scores below threshold", () => {
    expect(
      shouldShowRecommendation(CONFIDENCE_SUPPRESSION_THRESHOLD - 1)
    ).toBe(false);
    expect(shouldShowRecommendation(0)).toBe(false);
  });
});
