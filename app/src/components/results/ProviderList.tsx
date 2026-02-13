import { useState, useMemo } from "react";
import type { ISPAtLocation, Locale } from "@/types";
import ProviderCard from "./ProviderCard";

interface ProviderListProps {
  providers: ISPAtLocation[];
  locale: Locale;
}

type TechnologyFilter = "all" | "fibre" | "cable" | "wireless" | "satellite";
type SortOption = "price" | "speed";

const TECH_FILTERS: TechnologyFilter[] = [
  "all",
  "fibre",
  "cable",
  "wireless",
  "satellite",
];

const TECH_LABELS: Record<Locale, Record<TechnologyFilter, string>> = {
  en: {
    all: "All Technologies",
    fibre: "Fibre",
    cable: "Cable",
    wireless: "Wireless",
    satellite: "Satellite",
  },
  fr: {
    all: "Toutes les technologies",
    fibre: "Fibre",
    cable: "C\u00e2ble",
    wireless: "Sans fil",
    satellite: "Satellite",
  },
};

/** Chip styling that maps tech filter to the appropriate colour. */
function techChipClass(filter: TechnologyFilter, active: boolean): string {
  if (!active) {
    return "border-border bg-surface-raised text-text-secondary hover:bg-surface-sunken";
  }
  switch (filter) {
    case "fibre":
      return "border-tech-fibre/30 bg-tech-fibre/10 text-tech-fibre";
    case "cable":
      return "border-tech-cable/30 bg-tech-cable/10 text-tech-cable";
    case "wireless":
      return "border-tech-fixed-wireless/30 bg-tech-fixed-wireless/10 text-tech-fixed-wireless";
    case "satellite":
      return "border-tech-satellite/30 bg-tech-satellite/10 text-tech-satellite";
    default:
      return "border-primary-300 bg-primary-50 text-primary-600";
  }
}

/** Check if a provider technology matches a given filter. */
function matchesTech(technology: string, filter: TechnologyFilter): boolean {
  if (filter === "all") return true;
  const norm = technology.toLowerCase();
  switch (filter) {
    case "fibre":
      return norm.includes("fibre") || norm.includes("fiber");
    case "cable":
      return norm.includes("cable") || norm.includes("dsl");
    case "wireless":
      return norm.includes("wireless") || norm.includes("lte") || norm.includes("mobile");
    case "satellite":
      return norm.includes("satellite");
    default:
      return true;
  }
}

/** Get the lowest monthly price from an ISP's plans, or Infinity if none. */
function lowestPrice(isp: ISPAtLocation): number {
  if (!isp.has_pricing || isp.plans.length === 0) return Infinity;
  return Math.min(...isp.plans.map((p) => p.monthly_price));
}

/** Get the highest download speed from an ISP's plans, or 0 if none. */
function highestSpeed(isp: ISPAtLocation): number {
  if (!isp.has_pricing || isp.plans.length === 0) return 0;
  return Math.max(...isp.plans.map((p) => p.speed_down));
}

const COPY: Record<
  Locale,
  {
    title: string;
    noProviders: string;
    filterTitle: string;
    noContract: string;
    maxBudget: string;
    sortBy: string;
    sortPrice: string;
    sortSpeed: string;
    showingCount: string;
  }
> = {
  en: {
    title: "Available Providers",
    noProviders:
      "No provider information is currently available for this location.",
    filterTitle: "Filter Plans",
    noContract: "No contract required",
    maxBudget: "Maximum Monthly Budget",
    sortBy: "Sort by",
    sortPrice: "Lowest price",
    sortSpeed: "Highest speed",
    showingCount: "Showing {{count}} of {{total}} providers",
  },
  fr: {
    title: "Fournisseurs disponibles",
    noProviders:
      "Aucune information sur les fournisseurs n\u2019est actuellement disponible pour cet emplacement.",
    filterTitle: "Filtrer les forfaits",
    noContract: "Sans contrat requis",
    maxBudget: "Budget mensuel maximum",
    sortBy: "Trier par",
    sortPrice: "Prix le plus bas",
    sortSpeed: "Vitesse la plus \u00e9lev\u00e9e",
    showingCount: "Affichage de {{count}} sur {{total}} fournisseurs",
  },
};

export default function ProviderList({ providers, locale }: ProviderListProps) {
  const copy = COPY[locale];

  const [techFilter, setTechFilter] = useState<TechnologyFilter>("all");
  const [noContractOnly, setNoContractOnly] = useState(false);
  const [maxBudget, setMaxBudget] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<SortOption>("price");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let result = [...providers];

    // Technology filter
    if (techFilter !== "all") {
      result = result.filter((isp) => matchesTech(isp.technology, techFilter));
    }

    // No-contract filter
    if (noContractOnly) {
      result = result.filter((isp) => {
        if (!isp.has_pricing || isp.plans.length === 0) return true;
        return isp.plans.some((p) => p.contract_months === 0);
      });
    }

    // Budget filter
    if (maxBudget !== "" && maxBudget > 0) {
      result = result.filter((isp) => {
        if (!isp.has_pricing || isp.plans.length === 0) return true;
        return isp.plans.some((p) => p.monthly_price <= maxBudget);
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "price") {
        return lowestPrice(a) - lowestPrice(b);
      }
      return highestSpeed(b) - highestSpeed(a);
    });

    return result;
  }, [providers, techFilter, noContractOnly, maxBudget, sortBy]);

  // Empty state
  if (providers.length === 0) {
    return (
      <section aria-labelledby="providers-title">
        <h2
          id="providers-title"
          className="font-display text-lg font-bold text-text-primary"
        >
          {copy.title}
        </h2>
        <div className="mt-4 rounded-lg border border-border bg-surface-raised p-8 text-center shadow-card">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            className="mx-auto text-text-muted"
            aria-hidden="true"
          >
            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M14 20H26"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="mt-3 font-body text-sm text-text-muted">
            {copy.noProviders}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="providers-title">
      {/* Section header with sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="providers-title"
          className="font-display text-lg font-bold text-text-primary"
        >
          {copy.title}
        </h2>

        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className="
              inline-flex items-center gap-1.5 rounded-md border border-border
              bg-surface-raised px-3 py-1.5
              font-body text-xs font-medium text-text-secondary
              transition-colors hover:bg-surface-sunken
              focus-visible:outline-2 focus-visible:outline-primary-500
            "
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 5H17M6 10H14M9 15H11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {copy.filterTitle}
          </button>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="provider-sort"
              className="font-body text-xs text-text-muted"
            >
              {copy.sortBy}:
            </label>
            <select
              id="provider-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="
                rounded-md border border-border bg-surface-raised
                px-2 py-1 font-body text-xs text-text-secondary
                focus-visible:outline-2 focus-visible:outline-primary-500
              "
            >
              <option value="price">{copy.sortPrice}</option>
              <option value="speed">{copy.sortSpeed}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter controls (collapsible) */}
      {filtersOpen && (
        <div className="mt-3 rounded-lg border border-border bg-surface-raised p-4 shadow-card">
          {/* Technology chips */}
          <fieldset>
            <legend className="mb-2 font-body text-xs font-semibold text-text-secondary">
              {locale === "en" ? "Connection Type" : "Type de connexion"}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {TECH_FILTERS.map((filter) => {
                const active = techFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTechFilter(filter)}
                    className={`
                      rounded-full border px-3 py-1 font-body text-xs font-medium
                      transition-colors
                      focus-visible:outline-2 focus-visible:outline-primary-500
                      ${techChipClass(filter, active)}
                    `}
                  >
                    {TECH_LABELS[locale][filter]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* No-contract toggle & Budget */}
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={noContractOnly}
                onChange={(e) => setNoContractOnly(e.target.checked)}
                className="
                  h-4 w-4 rounded border-border text-primary-500
                  focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
                "
              />
              <span className="font-body text-xs text-text-secondary">
                {copy.noContract}
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="max-budget"
                className="font-body text-xs text-text-secondary"
              >
                {copy.maxBudget} ($)
              </label>
              <input
                id="max-budget"
                type="number"
                min={0}
                step={5}
                value={maxBudget}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxBudget(val === "" ? "" : Number(val));
                }}
                placeholder="--"
                className="
                  w-24 rounded-md border border-border bg-surface
                  px-2.5 py-1 font-mono text-xs text-text-primary
                  placeholder:text-text-muted
                  focus-visible:outline-2 focus-visible:outline-primary-500
                "
              />
            </div>
          </div>
        </div>
      )}

      {/* Provider count */}
      {filteredAndSorted.length !== providers.length && (
        <p className="mt-3 font-body text-xs text-text-muted" aria-live="polite">
          {copy.showingCount
            .replace("{{count}}", String(filteredAndSorted.length))
            .replace("{{total}}", String(providers.length))}
        </p>
      )}

      {/* Provider cards grid */}
      <div
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
      >
        {filteredAndSorted.map((isp) => (
          <div key={`${isp.provider.slug}-${isp.technology}`} role="listitem">
            <ProviderCard isp={isp} locale={locale} />
          </div>
        ))}
      </div>

      {/* No results after filtering */}
      {filteredAndSorted.length === 0 && providers.length > 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface-raised p-6 text-center">
          <p className="font-body text-sm text-text-muted">
            {locale === "en"
              ? "No providers match your current filters."
              : "Aucun fournisseur ne correspond \u00e0 vos filtres actuels."}
          </p>
        </div>
      )}
    </section>
  );
}
