import type { ISPAtLocation, ProviderPlan, Locale } from "@/types";

interface ProviderCardProps {
  isp: ISPAtLocation;
  locale: Locale;
}

/** Map technology strings to colour classes. */
function techBadgeClass(technology: string): string {
  const normalized = technology.toLowerCase();
  if (normalized.includes("fibre") || normalized.includes("fiber")) {
    return "bg-tech-fibre/10 text-tech-fibre border-tech-fibre/20";
  }
  if (normalized.includes("cable")) {
    return "bg-tech-cable/10 text-tech-cable border-tech-cable/20";
  }
  if (normalized.includes("dsl")) {
    return "bg-tech-cable/10 text-tech-cable border-tech-cable/20";
  }
  if (normalized.includes("satellite")) {
    return "bg-tech-satellite/10 text-tech-satellite border-tech-satellite/20";
  }
  if (normalized.includes("mobile") || normalized.includes("lte")) {
    return "bg-tech-lte/10 text-tech-lte border-tech-lte/20";
  }
  // Fixed Wireless or other wireless
  return "bg-tech-fixed-wireless/10 text-tech-fixed-wireless border-tech-fixed-wireless/20";
}

const COPY: Record<
  Locale,
  {
    pricingComingSoon: string;
    visitProvider: string;
    monthly: string;
    promoForMonths: string;
    noContract: string;
    contractMonths: string;
    dataCap: string;
    unlimited: string;
    installFee: string;
    staleWarning: string;
    speed: string;
    price: string;
    plan: string;
    details: string;
  }
> = {
  en: {
    pricingComingSoon: "Pricing Coming Soon",
    visitProvider: "Visit Provider",
    monthly: "/mo",
    promoForMonths: "for {{months}} months",
    noContract: "No contract",
    contractMonths: "{{months}}-month contract",
    dataCap: "{{cap}} GB data cap",
    unlimited: "Unlimited data",
    installFee: "Installation fee: ${{fee}}",
    staleWarning:
      "This pricing has not been verified recently and may be outdated.",
    speed: "Speed",
    price: "Price",
    plan: "Plan",
    details: "Details",
  },
  fr: {
    pricingComingSoon: "Tarification \u00e0 venir",
    visitProvider: "Visiter le fournisseur",
    monthly: "/mois",
    promoForMonths: "pour {{months}} mois",
    noContract: "Sans contrat",
    contractMonths: "Contrat de {{months}} mois",
    dataCap: "Limite de donn\u00e9es de {{cap}} Go",
    unlimited: "Donn\u00e9es illimit\u00e9es",
    installFee: "Frais d\u2019installation\u00a0: {{fee}}\u00a0$",
    staleWarning:
      "Cette tarification n\u2019a pas \u00e9t\u00e9 v\u00e9rifi\u00e9e r\u00e9cemment et pourrait \u00eatre d\u00e9pass\u00e9e.",
    speed: "Vitesse",
    price: "Prix",
    plan: "Forfait",
    details: "D\u00e9tails",
  },
};

function formatPrice(amount: number, locale: Locale): string {
  if (locale === "fr") {
    const formatted = amount.toFixed(2).replace(".", ",");
    return `${formatted}\u00a0$`;
  }
  return `$${amount.toFixed(2)}`;
}

function formatSpeed(down: number, up: number, locale: Locale): string {
  const unit = locale === "fr" ? "Mbit/s" : "Mbps";
  return `${down}/${up} ${unit}`;
}

function PlanRow({ plan, locale }: { plan: ProviderPlan; locale: Locale }) {
  const copy = COPY[locale];

  const contractLabel =
    plan.contract_months === 0
      ? copy.noContract
      : copy.contractMonths.replace("{{months}}", String(plan.contract_months));

  const dataLabel =
    plan.data_cap_gb === null
      ? copy.unlimited
      : copy.dataCap.replace("{{cap}}", String(plan.data_cap_gb));

  return (
    <div className="border-t border-border-subtle px-4 py-3 first:border-t-0">
      {/* Stale warning */}
      {plan.stale_flag && (
        <div className="mb-2 flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            className="shrink-0 text-confidence-medium"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 6V11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
          </svg>
          <span className="font-body text-xs text-confidence-medium">
            {copy.staleWarning}
          </span>
        </div>
      )}

      {/* Plan name */}
      <p className="font-body text-sm font-semibold text-text-primary">
        {plan.plan_name}
      </p>

      {/* Speed & price row */}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-sm text-text-primary">
          {formatSpeed(plan.speed_down, plan.speed_up, locale)}
        </span>
        <span className="font-mono text-sm font-bold text-primary-600">
          {formatPrice(plan.monthly_price, locale)}
          <span className="font-body text-xs font-normal text-text-muted">
            {copy.monthly}
          </span>
        </span>
        {plan.promo_price !== null && (
          <span className="inline-flex items-center gap-1 rounded-md bg-confidence-high/10 px-1.5 py-0.5 text-xs font-medium text-confidence-high">
            {formatPrice(plan.promo_price, locale)}
            {" "}
            {copy.promoForMonths.replace(
              "{{months}}",
              String(plan.promo_months)
            )}
          </span>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
        <span>{contractLabel}</span>
        <span>{dataLabel}</span>
        {plan.install_fee > 0 && (
          <span>
            {locale === "fr"
              ? copy.installFee.replace("{{fee}}", plan.install_fee.toFixed(2).replace(".", ","))
              : copy.installFee.replace("{{fee}}", plan.install_fee.toFixed(2))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProviderCard({ isp, locale }: ProviderCardProps) {
  const copy = COPY[locale];
  const techLabel = locale === "fr" ? isp.technology_fr : isp.technology;

  return (
    <article
      className="
        group overflow-hidden rounded-lg border border-border
        bg-surface-raised shadow-card
        transition-shadow duration-200
        hover:shadow-card-hover
      "
      aria-label={isp.provider.name}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2 sm:px-5">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-text-primary sm:text-lg">
            {isp.provider.name}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 font-body text-xs font-semibold ${techBadgeClass(isp.technology)}`}
        >
          {techLabel}
        </span>
      </div>

      {/* Plans or Coming Soon */}
      {isp.has_pricing ? (
        <div className="mx-4 mb-3 rounded-md border border-border-subtle bg-surface sm:mx-5">
          {isp.plans.map((plan) => (
            <PlanRow key={plan.id} plan={plan} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="mx-4 mb-3 sm:mx-5">
          <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-sunken px-4 py-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              className="shrink-0 text-text-muted"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 7V10.5L12.5 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-body text-sm font-medium text-text-muted">
              {copy.pricingComingSoon}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      {isp.provider.website_url && (
        <div className="border-t border-border-subtle px-4 py-3 sm:px-5">
          <a
            href={isp.provider.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center gap-1.5 font-body text-sm font-medium
              text-primary-500 transition-colors
              hover:text-primary-700
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
            "
          >
            {copy.visitProvider}
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              className="shrink-0"
              aria-hidden="true"
            >
              <path
                d="M7 5H15V13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">
              ({locale === "en" ? "Opens in a new tab" : "Ouvre dans un nouvel onglet"})
            </span>
          </a>
        </div>
      )}
    </article>
  );
}
