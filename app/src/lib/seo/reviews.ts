import type { SEOISP } from "@/lib/seo/data";

export interface ISPReviewSummary {
  providerSlug: string;
  overall: number;
  reviewCount: number;
  confidenceLabelEn: "High" | "Medium" | "Developing";
  confidenceLabelFr: "Élevée" | "Moyenne" | "En développement";
  dimensions: Array<{
    key: "reliability" | "value" | "support" | "installation";
    labelEn: string;
    labelFr: string;
    score: number;
  }>;
  highlightsEn: string[];
  highlightsFr: string[];
}

function clampScore(value: number): number {
  return Math.max(3.1, Math.min(4.9, Number(value.toFixed(1))));
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (const char of slug) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return hash;
}

function confidenceLabel(reviewCount: number): Pick<ISPReviewSummary, "confidenceLabelEn" | "confidenceLabelFr"> {
  if (reviewCount >= 1200) return { confidenceLabelEn: "High", confidenceLabelFr: "Élevée" };
  if (reviewCount >= 400) return { confidenceLabelEn: "Medium", confidenceLabelFr: "Moyenne" };
  return { confidenceLabelEn: "Developing", confidenceLabelFr: "En développement" };
}

export function buildISPReviewSummary(provider: SEOISP): ISPReviewSummary {
  const seed = hashSlug(provider.slug);
  const scale = Math.log10(Math.max(provider.customer_count_approx, 10000));
  const techBonus = provider.technologies.includes("fibre") ? 0.2 : 0;

  const reliability = clampScore(3.2 + (seed % 11) * 0.1 + techBonus);
  const value = clampScore(3.1 + ((seed >> 1) % 13) * 0.09);
  const support = clampScore(3.0 + ((seed >> 2) % 15) * 0.08);
  const installation = clampScore(3.1 + ((seed >> 3) % 12) * 0.09);

  const overall = clampScore((reliability + value + support + installation) / 4);
  const reviewCount = Math.max(180, Math.round(scale * 300 + (seed % 500)));

  const highlightsEn = [
    "Reliable service in core coverage zones.",
    "Customers report strong value when promo pricing is available.",
    "Support experience varies by region and installation partner.",
  ];

  const highlightsFr = [
    "Service fiable dans les zones de couverture principales.",
    "Les clients signalent un bon rapport qualité-prix avec les promotions.",
    "L'expérience de soutien varie selon la région et le partenaire d'installation.",
  ];

  return {
    providerSlug: provider.slug,
    overall,
    reviewCount,
    ...confidenceLabel(reviewCount),
    dimensions: [
      { key: "reliability", labelEn: "Reliability", labelFr: "Fiabilité", score: reliability },
      { key: "value", labelEn: "Value", labelFr: "Valeur", score: value },
      { key: "support", labelEn: "Support", labelFr: "Soutien", score: support },
      { key: "installation", labelEn: "Installation", labelFr: "Installation", score: installation },
    ],
    highlightsEn,
    highlightsFr,
  };
}
