import { describe, expect, it } from "vitest";
import { getISPs } from "@/lib/seo/data";
import { buildAggregateRatingSchema, getISPReviewSummary } from "@/lib/seo/reviews";

describe("getISPReviewSummary", () => {
  it("returns a review summary for every known ISP slug", () => {
    for (const isp of getISPs()) {
      const summary = getISPReviewSummary(isp.slug);
      expect(summary, `missing summary for ${isp.slug}`).toBeDefined();
    }
  });

  it("returns undefined for unknown slugs", () => {
    expect(getISPReviewSummary("unknown-provider")).toBeUndefined();
  });
});

describe("buildAggregateRatingSchema", () => {
  it("builds an Organization schema with AggregateRating", () => {
    const sample = getISPReviewSummary("bell");
    expect(sample).toBeDefined();

    const schema = buildAggregateRatingSchema("Bell", sample!);
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("Bell");

    const rating = schema.aggregateRating as { [key: string]: unknown };
    expect(rating["@type"]).toBe("AggregateRating");
    expect(rating.reviewCount).toBeTypeOf("number");
  });
});
