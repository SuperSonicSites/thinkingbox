import React, { useState, useEffect } from "react";
import type { LookupResult, Locale } from "@/types";
import { ConfidenceGauge } from "@/components/ui/ConfidenceGauge";
import AvailabilityCard from "./AvailabilityCard";
import ProviderList from "./ProviderList";
import ProvenancePanel from "./ProvenancePanel";
import { Skeleton } from "@/components/ui/Skeleton";

export interface ResultsViewProps {
  result?: LookupResult;
  lookupId?: string;
  locale: Locale;
}

const COPY: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    loading: string;
    error: string;
  }
> = {
  en: {
    title: "Internet Options at Your Address",
    subtitle:
      "Based on ISED broadband coverage data for your location.",
    loading: "Loading results...",
    error: "Could not load results. Please try again.",
  },
  fr: {
    title: "Options Internet \u00e0 votre adresse",
    subtitle:
      "Bas\u00e9 sur les donn\u00e9es de couverture large bande d\u2019ISDE pour votre emplacement.",
    loading: "Chargement des r\u00e9sultats\u2026",
    error: "Impossible de charger les r\u00e9sultats. Veuillez r\u00e9essayer.",
  },
};

/**
 * Staggered fade-in animation wrapper.
 */
function FadeInSection({
  delayMs,
  children,
}: {
  delayMs: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="
        animate-[fadeInUp_0.4s_ease-out_both]
        motion-reduce:animate-none
      "
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export default function ResultsView({ result: initialResult, lookupId, locale }: ResultsViewProps) {
  const copy = COPY[locale];
  const [result, setResult] = useState<LookupResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(!initialResult && !!lookupId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialResult || !lookupId) return;

    let cancelled = false;

    async function fetchResult() {
      try {
        // Try to read from sessionStorage first (set by LookupForm after a successful lookup)
        const cached = sessionStorage.getItem(`lookup_${lookupId}`);
        if (cached) {
          const parsed = JSON.parse(cached) as LookupResult;
          if (!cancelled) {
            setResult(parsed);
            setLoading(false);
          }
          return;
        }
      } catch {
        // sessionStorage might not be available
      }

      // Fallback: we don't have the result cached, show error
      if (!cancelled) {
        setError(copy.error);
        setLoading(false);
      }
    }

    fetchResult();
    return () => { cancelled = true; };
  }, [lookupId, initialResult, copy.error]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="text-center">
          <p className="text-sm text-text-muted">{copy.loading}</p>
        </div>
        <Skeleton variant="card" />
        <Skeleton variant="gauge" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto w-full max-w-4xl text-center py-12">
        <p className="text-text-secondary">{error ?? copy.error}</p>
        <a
          href={locale === "fr" ? "/fr" : "/"}
          className="mt-4 inline-block rounded-md bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {locale === "fr" ? "Nouvelle recherche" : "New Search"}
        </a>
      </div>
    );
  }

  const { address, availability, confidence, providers, provenance } = result;

  // Build address display
  const cityProvince: string[] = [];
  if (address.city) cityProvince.push(address.city);
  if (address.province) cityProvince.push(address.province);
  const cityProvinceStr = cityProvince.join(", ");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Keyframes definition */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* 1. Address header */}
      <FadeInSection delayMs={0}>
        <header className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1 font-body text-sm text-text-muted">
            {copy.subtitle}
          </p>
          <div className="mt-4 rounded-lg border border-border bg-surface-raised px-4 py-3 shadow-card sm:px-6">
            <p className="font-body text-base font-semibold text-text-primary sm:text-lg">
              {address.normalized}
            </p>
            {cityProvinceStr && (
              <p className="mt-0.5 font-body text-sm text-text-secondary">
                {cityProvinceStr}
                {address.postal_code ? ` \u2022 ${address.postal_code}` : ""}
              </p>
            )}
          </div>
        </header>
      </FadeInSection>

      {/* 2. Confidence gauge */}
      <FadeInSection delayMs={50}>
        <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-card sm:p-6">
          <ConfidenceGauge
            score={confidence.overall}
            level={confidence.level}
            locale={locale}
            showBreakdown
          />
        </div>
      </FadeInSection>

      {/* 3. Availability card */}
      <FadeInSection delayMs={100}>
        <AvailabilityCard availability={availability} locale={locale} />
      </FadeInSection>

      {/* 4. Provider list */}
      <FadeInSection delayMs={150}>
        <ProviderList providers={providers} locale={locale} />
      </FadeInSection>

      {/* 5. Provenance panel */}
      <FadeInSection delayMs={200}>
        <ProvenancePanel
          provenance={provenance}
          confidence={confidence}
          locale={locale}
        />
      </FadeInSection>
    </div>
  );
}
