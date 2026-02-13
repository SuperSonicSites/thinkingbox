import type {
  AvailabilitySummary,
  AvailabilityClass,
  SpeedThreshold,
  Locale,
} from "@/types";

interface AvailabilityCardProps {
  availability: AvailabilitySummary;
  locale: Locale;
}

/** Maps availability class to colour intent for the badge. */
const CLASS_BADGE_STYLES: Record<AvailabilityClass, string> = {
  "50_10_plus":
    "bg-confidence-high/10 text-confidence-high border border-confidence-high/20",
  "25_5":
    "bg-confidence-high/10 text-confidence-high border border-confidence-high/20",
  "10_2":
    "bg-confidence-medium/10 text-confidence-medium border border-confidence-medium/20",
  "5_1":
    "bg-confidence-low/10 text-confidence-low border border-confidence-low/20",
  lt5_1:
    "bg-confidence-low/10 text-confidence-low border border-confidence-low/20",
  unknown_or_unserved:
    "bg-surface-sunken text-text-muted border border-border",
};

/** Speed threshold to human-readable label. */
function thresholdLabel(
  threshold: SpeedThreshold,
  locale: Locale
): string {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      "50_10": "50/10 Mbps or higher",
      "25_5": "25/5 Mbps",
      "10_2": "10/2 Mbps",
      "5_1": "5/1 Mbps",
      "<5_1": "Below 5/1 Mbps",
      "": "N/A",
    },
    fr: {
      "50_10": "50/10 Mbit/s ou plus",
      "25_5": "25/5 Mbit/s",
      "10_2": "10/2 Mbit/s",
      "5_1": "5/1 Mbit/s",
      "<5_1": "Moins de 5/1 Mbit/s",
      "": "N/D",
    },
  };
  return labels[locale][threshold] ?? threshold;
}

const COPY: Record<
  Locale,
  {
    title: string;
    combined: string;
    wired: string;
    wireless: string;
    lte: string;
    satellite: string;
    available: string;
    unavailable: string;
    wirelessWarning: string;
    unknownDisclaimer: string;
  }
> = {
  en: {
    title: "Speed Availability",
    combined: "Combined (Best Available)",
    wired: "Wired (Fibre, Cable, DSL)",
    wireless: "Wireless (Fixed Wireless)",
    lte: "LTE Mobile",
    satellite: "Satellite",
    available: "Available",
    unavailable: "Unavailable",
    wirelessWarning:
      "Wired internet is not available at this location. The speeds shown are based on wireless coverage only.",
    unknownDisclaimer:
      "We do not have confirmed broadband coverage data for this location. Service may still be available through providers not yet in our database.",
  },
  fr: {
    title: "Disponibilit\u00e9 des vitesses",
    combined: "Combin\u00e9 (meilleur disponible)",
    wired: "Filaire (fibre, c\u00e2ble, DSL)",
    wireless: "Sans fil (sans fil fixe)",
    lte: "Mobile LTE",
    satellite: "Satellite",
    available: "Disponible",
    unavailable: "Non disponible",
    wirelessWarning:
      "L\u2019Internet filaire n\u2019est pas disponible \u00e0 cet emplacement. Les vitesses affich\u00e9es sont bas\u00e9es uniquement sur la couverture sans fil.",
    unknownDisclaimer:
      "Nous n\u2019avons pas de donn\u00e9es de couverture large bande confirm\u00e9es pour cet emplacement. Le service pourrait tout de m\u00eame \u00eatre disponible aupr\u00e8s de fournisseurs qui ne figurent pas encore dans notre base de donn\u00e9es.",
  },
};

function SpeedBadge({
  availClass,
  threshold,
  locale,
}: {
  availClass: AvailabilityClass;
  threshold: SpeedThreshold;
  locale: Locale;
}) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${CLASS_BADGE_STYLES[availClass]}`}
    >
      {thresholdLabel(threshold, locale)}
    </span>
  );
}

function AvailabilityIndicator({
  isAvailable,
  locale,
}: {
  isAvailable: boolean;
  locale: Locale;
}) {
  const label = isAvailable
    ? COPY[locale].available
    : COPY[locale].unavailable;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          isAvailable ? "bg-confidence-high" : "bg-text-muted"
        }`}
        aria-hidden="true"
      />
      <span
        className={`font-body text-sm font-medium ${
          isAvailable ? "text-confidence-high" : "text-text-muted"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

export default function AvailabilityCard({
  availability,
  locale,
}: AvailabilityCardProps) {
  const copy = COPY[locale];

  const rows: Array<{
    label: string;
    content: React.ReactNode;
  }> = [
    {
      label: copy.combined,
      content: (
        <SpeedBadge
          availClass={availability.combined.availability_class}
          threshold={availability.combined.max_threshold}
          locale={locale}
        />
      ),
    },
    {
      label: copy.wired,
      content: (
        <SpeedBadge
          availClass={availability.wired.availability_class}
          threshold={availability.wired.max_threshold}
          locale={locale}
        />
      ),
    },
    {
      label: copy.wireless,
      content: (
        <SpeedBadge
          availClass={availability.wireless.availability_class}
          threshold={availability.wireless.max_threshold}
          locale={locale}
        />
      ),
    },
    {
      label: copy.lte,
      content: (
        <AvailabilityIndicator
          isAvailable={availability.lte_mobile_available}
          locale={locale}
        />
      ),
    },
    {
      label: copy.satellite,
      content: (
        <SpeedBadge
          availClass={
            availability.satellite_max_threshold === ""
              ? "unknown_or_unserved"
              : "50_10_plus"
          }
          threshold={availability.satellite_max_threshold}
          locale={locale}
        />
      ),
    },
  ];

  return (
    <section
      className="rounded-lg border border-border bg-surface-raised p-4 shadow-card sm:p-6"
      aria-labelledby="availability-title"
    >
      <h2
        id="availability-title"
        className="font-display text-lg font-bold text-text-primary"
      >
        {copy.title}
      </h2>

      {/* Wireless-dependent warning */}
      {availability.wireless_dependent && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-md border border-confidence-medium/20 bg-confidence-medium/5 px-3.5 py-2.5"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            className="mt-0.5 shrink-0 text-confidence-medium"
            aria-hidden="true"
          >
            <path
              d="M10 2L1.5 17.5H18.5L10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M10 8V12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
          </svg>
          <p className="font-body text-sm text-confidence-medium">
            {copy.wirelessWarning}
          </p>
        </div>
      )}

      {/* Speed rows */}
      <div className="mt-4 divide-y divide-border-subtle" role="list">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            role="listitem"
          >
            <span className="font-body text-sm text-text-secondary">
              {row.label}
            </span>
            <div className="shrink-0">{row.content}</div>
          </div>
        ))}
      </div>

      {/* Unknown/unserved disclaimer */}
      {availability.combined.availability_class === "unknown_or_unserved" && (
        <div
          role="note"
          className="mt-4 rounded-md border border-border bg-surface-sunken px-3.5 py-2.5"
        >
          <p className="font-body text-xs leading-relaxed text-text-muted">
            {copy.unknownDisclaimer}
          </p>
        </div>
      )}
    </section>
  );
}
