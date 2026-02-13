import { useState } from "react";
import type { LookupResult, ConfidenceBreakdown, Locale } from "@/types";

interface ProvenancePanelProps {
  provenance: LookupResult["provenance"];
  confidence: ConfidenceBreakdown;
  locale: Locale;
}

const COPY: Record<
  Locale,
  {
    title: string;
    dataSource: string;
    phhId: string;
    lastUpdated: string;
    freshness: string;
    hoursAgo: string;
    breakdownTitle: string;
    spatial: string;
    concordance: string;
    freshnessLabel: string;
    discrepancy: string;
    reportButton: string;
    expand: string;
    collapse: string;
  }
> = {
  en: {
    title: "Data Source",
    dataSource: "Source",
    phhId: "PHH Point ID",
    lastUpdated: "Last Updated",
    freshness: "Data Freshness",
    hoursAgo: "{{hours}} hours ago",
    breakdownTitle: "Score Breakdown",
    spatial: "Spatial Accuracy",
    concordance: "Data Concordance",
    freshnessLabel: "Data Freshness",
    discrepancy: "Discrepancy Adjustment",
    reportButton: "Report Incorrect Data",
    expand: "Show data provenance",
    collapse: "Hide data provenance",
  },
  fr: {
    title: "Source des donn\u00e9es",
    dataSource: "Source",
    phhId: "Identifiant du point PHH",
    lastUpdated: "Derni\u00e8re mise \u00e0 jour",
    freshness: "Fra\u00eecheur des donn\u00e9es",
    hoursAgo: "Il y a {{hours}} heures",
    breakdownTitle: "D\u00e9tail du score",
    spatial: "Pr\u00e9cision spatiale",
    concordance: "Concordance des donn\u00e9es",
    freshnessLabel: "Fra\u00eecheur des donn\u00e9es",
    discrepancy: "Ajustement d\u2019\u00e9cart",
    reportButton: "Signaler des donn\u00e9es incorrectes",
    expand: "Afficher la provenance des donn\u00e9es",
    collapse: "Masquer la provenance des donn\u00e9es",
  },
};

function BreakdownBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  /** Choose bar colour based on the score value. */
  function barColor(score: number): string {
    if (score >= 70) return "bg-confidence-high";
    if (score >= 40) return "bg-confidence-medium";
    return "bg-confidence-low";
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-body text-xs text-text-secondary">{label}</span>
        <span className="font-mono text-xs text-text-muted">{value}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(value)}`}
          role="meter"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${value} out of 100`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(isoString: string, locale: Locale): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function ProvenancePanel({
  provenance,
  confidence,
  locale,
}: ProvenancePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const copy = COPY[locale];

  const freshnessText = copy.hoursAgo.replace(
    "{{hours}}",
    String(Math.round(provenance.freshness_hours))
  );

  return (
    <section
      className="rounded-lg border border-border bg-surface-raised shadow-card"
      aria-labelledby="provenance-title"
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="
          flex w-full items-center justify-between gap-3 px-4 py-4
          text-left transition-colors
          hover:bg-surface-sunken/50
          focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-500
          sm:px-6
        "
      >
        <div className="flex items-center gap-2.5">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="shrink-0 text-text-muted"
            aria-hidden="true"
          >
            <path
              d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10C18 5.58 14.42 2 10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10 6V10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M10 13.5H10.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h2
            id="provenance-title"
            className="font-display text-sm font-bold text-text-primary sm:text-base"
          >
            {copy.title}
          </h2>
        </div>

        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          className={`shrink-0 text-text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">
          {expanded ? copy.collapse : copy.expand}
        </span>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-5 pt-4 sm:px-6">
          {/* Data source metadata */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-body text-xs font-medium text-text-muted">
                {copy.dataSource}
              </dt>
              <dd className="mt-0.5 font-body text-sm text-text-primary">
                {provenance.data_source}
              </dd>
            </div>
            <div>
              <dt className="font-body text-xs font-medium text-text-muted">
                {copy.phhId}
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-text-primary">
                {provenance.phh_id}
              </dd>
            </div>
            <div>
              <dt className="font-body text-xs font-medium text-text-muted">
                {copy.lastUpdated}
              </dt>
              <dd className="mt-0.5 font-body text-sm text-text-primary">
                {formatDate(provenance.snapshot_date, locale)}
              </dd>
            </div>
            <div>
              <dt className="font-body text-xs font-medium text-text-muted">
                {copy.freshness}
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-text-primary">
                {freshnessText}
              </dd>
            </div>
          </dl>

          {/* Confidence breakdown bars */}
          <div className="mt-5">
            <h3 className="mb-3 font-display text-sm font-bold text-text-primary">
              {copy.breakdownTitle}
            </h3>
            <div className="space-y-3">
              <BreakdownBar
                label={copy.spatial}
                value={confidence.spatial_score}
              />
              <BreakdownBar
                label={copy.concordance}
                value={confidence.concordance_score}
              />
              <BreakdownBar
                label={copy.freshnessLabel}
                value={confidence.freshness_score}
              />
              <BreakdownBar
                label={copy.discrepancy}
                value={confidence.discrepancy_score}
              />
            </div>
          </div>

          {/* Report incorrect data */}
          <div className="mt-5 border-t border-border-subtle pt-4">
            <a
              href={
                locale === "fr"
                  ? `/fr/discrepancy?phh=${provenance.phh_id}`
                  : `/discrepancy?phh=${provenance.phh_id}`
              }
              className="
                inline-flex items-center gap-2 rounded-md border border-border
                bg-surface px-4 py-2
                font-body text-sm font-medium text-text-secondary
                transition-colors
                hover:bg-surface-sunken hover:text-text-primary
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
              "
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                className="shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M3 17H17"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M12.5 3.5L16.5 7.5L7 17H3V13L12.5 3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              {copy.reportButton}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
