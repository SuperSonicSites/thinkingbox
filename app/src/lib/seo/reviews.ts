import reviewsData from "@/data/seo/reviews.json";

export interface ISPReviewSummary {
  providerSlug: string;
  overall: number;
  reviewCount: number;
  confidenceLabelEn: "High" | "Medium" | "Developing";
  confidenceLabelFr: "Élevée" | "Moyenne" | "En développement";
  dimensions: {
    reliability: number;
    value: number;
    support: number;
    installation: number;
  };
  highlightsEn: string[];
  highlightsFr: string[];
}

const reviewSummaries = reviewsData as ISPReviewSummary[];

export function getISPReviewSummary(providerSlug: string): ISPReviewSummary | undefined {
  return reviewSummaries.find((item) => item.providerSlug === providerSlug);
}

export function buildAggregateRatingSchema(providerName: string, summary: ISPReviewSummary): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: providerName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(summary.overall.toFixed(1)),
      bestRating: 5,
      worstRating: 1,
      reviewCount: summary.reviewCount,
    },
  };
}
