import React, { useState, useRef } from "react";
import type { Locale, APIResponse, LookupResult } from "@/types";

interface LookupFormProps {
  locale: Locale;
}

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

const COPY: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    placeholder: string;
    button: string;
    searching: string;
    errors: Record<string, string>;
    fallbackError: string;
  }
> = {
  en: {
    title: "Find Internet Providers at Your Address",
    subtitle:
      "Enter your Canadian address to see which ISPs serve your location, available speeds, and pricing.",
    placeholder: "Enter your address (e.g., 123 Main St, Ottawa, ON)",
    button: "Search",
    searching: "Searching...",
    errors: {
      BAD_REQUEST:
        "Please enter a valid Canadian address including street number and name.",
      GEOCODE_FAILED:
        "We were unable to locate that address. Please verify the address and try again.",
      NO_PHH_MATCH:
        "We couldn\u2019t find any coverage data for that address. Please check the address and try again.",
      RATE_LIMITED: "Too many requests. Please try again in a few moments.",
      INTERNAL_ERROR:
        "Something went wrong on our end. Please try again in a few moments.",
    },
    fallbackError: "An unexpected error occurred. Please try again.",
  },
  fr: {
    title: "Trouvez les fournisseurs Internet \u00e0 votre adresse",
    subtitle:
      "Entrez votre adresse canadienne pour voir quels fournisseurs desservent votre emplacement, les vitesses disponibles et les tarifs.",
    placeholder:
      "Entrez votre adresse (ex.\u00a0: 123, rue Principale, Ottawa, ON)",
    button: "Rechercher",
    searching: "Recherche en cours...",
    errors: {
      BAD_REQUEST:
        "Veuillez entrer une adresse canadienne valide incluant le num\u00e9ro et le nom de la rue.",
      GEOCODE_FAILED:
        "Nous n\u2019avons pas pu localiser cette adresse. Veuillez v\u00e9rifier l\u2019adresse et r\u00e9essayer.",
      NO_PHH_MATCH:
        "Nous n\u2019avons trouv\u00e9 aucune donn\u00e9e de couverture pour cette adresse. Veuillez v\u00e9rifier l\u2019adresse et r\u00e9essayer.",
      RATE_LIMITED:
        "Trop de requ\u00eates. Veuillez r\u00e9essayer dans quelques instants.",
      INTERNAL_ERROR:
        "Une erreur est survenue de notre c\u00f4t\u00e9. Veuillez r\u00e9essayer dans quelques instants.",
    },
    fallbackError:
      "Une erreur inattendue est survenue. Veuillez r\u00e9essayer.",
  },
};

export default function LookupForm({ locale }: LookupFormProps) {
  const [address, setAddress] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = COPY[locale];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = address.trim();
    if (trimmed.length < 3) {
      setFormState({
        status: "error",
        message: copy.errors.BAD_REQUEST,
      });
      inputRef.current?.focus();
      return;
    }

    setFormState({ status: "loading" });

    try {
      const response = await fetch("/api/v1/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ address: trimmed }),
      });

      const json: APIResponse<LookupResult> = await response.json();

      if (!response.ok || json.error) {
        const errorCode = json.error?.code ?? "INTERNAL_ERROR";
        const message =
          copy.errors[errorCode] ?? json.error?.message ?? copy.fallbackError;
        setFormState({ status: "error", message });
        return;
      }

      if (json.data) {
        try {
          sessionStorage.setItem(
            `lookup_${json.data.lookup_id}`,
            JSON.stringify(json.data)
          );
        } catch {
          // sessionStorage might be full or unavailable
        }
        const prefix = locale === "fr" ? "/fr" : "";
        window.location.href = `${prefix}/result/${json.data.lookup_id}`;
      }
    } catch {
      setFormState({
        status: "error",
        message: copy.fallbackError,
      });
    }
  }

  const isLoading = formState.status === "loading";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={copy.title}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="address-input" className="sr-only">
              {copy.placeholder}
            </label>
            <input
              ref={inputRef}
              id="address-input"
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (formState.status === "error") {
                  setFormState({ status: "idle" });
                }
              }}
              placeholder={copy.placeholder}
              disabled={isLoading}
              autoComplete="street-address"
              aria-describedby={
                formState.status === "error" ? "lookup-error" : undefined
              }
              aria-invalid={formState.status === "error" ? true : undefined}
              className="
                w-full rounded-lg border border-border bg-surface-raised
                px-4 py-3.5 font-body text-base text-text-primary
                shadow-card placeholder:text-text-muted
                transition-all duration-200
                hover:border-primary-300
                focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(27,143,175,0.15)]
                focus:outline-none
                disabled:cursor-not-allowed disabled:opacity-60
                sm:py-4 sm:text-lg
              "
            />
            {isLoading && (
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              >
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="
              inline-flex shrink-0 items-center justify-center gap-2
              rounded-lg bg-primary-500 px-6 py-3.5
              font-display text-base font-semibold text-white
              shadow-card transition-all duration-200
              hover:bg-primary-600 hover:shadow-card-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
              active:bg-primary-700
              disabled:cursor-not-allowed disabled:opacity-60
              sm:py-4 sm:text-lg
            "
          >
            {isLoading ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                {copy.searching}
              </>
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <circle
                    cx="9"
                    cy="9"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M13.5 13.5L17 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {copy.button}
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {formState.status === "error" && (
          <div
            id="lookup-error"
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-3"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="mt-0.5 shrink-0 text-error"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 6.5V11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
            </svg>
            <p className="font-body text-sm text-error">{formState.message}</p>
          </div>
        )}

        {/* Skeleton loading state */}
        {isLoading && (
          <div
            className="mt-6 space-y-3"
            aria-live="polite"
            aria-label={copy.searching}
          >
            <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
          </div>
        )}
      </form>
    </div>
  );
}
