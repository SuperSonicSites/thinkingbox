import type { Locale } from "../types/index";
import en from "./en.json";
import fr from "./fr.json";

type TranslationValue = string | TranslationObject;
interface TranslationObject {
  [key: string]: TranslationValue;
}

const translations: Record<Locale, TranslationObject> = {
  en: en as TranslationObject,
  fr: fr as TranslationObject,
};

/**
 * Returns the full translation object for a given locale.
 */
export function getTranslations(locale: Locale): TranslationObject {
  return translations[locale];
}

/**
 * Looks up a translation string by dot-notation key.
 *
 * Example: t("en", "results.confidence.high") returns "High confidence"
 *
 * Returns the key itself if the path is not found or does not resolve to a string.
 */
export function t(locale: Locale, key: string): string {
  const parts = key.split(".");
  let current: TranslationValue = translations[locale];

  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return key;
    }
    const obj = current as TranslationObject;
    if (!(part in obj)) {
      return key;
    }
    current = obj[part];
  }

  if (typeof current === "string") {
    return current;
  }

  return key;
}

/**
 * Formats a CAD price according to the locale.
 *
 * English: "$64.95" (dollar sign prefix, period decimal separator)
 * French:  "64,95 $" (dollar sign suffix with non-breaking space, comma decimal separator)
 */
export function formatPrice(amount: number, locale: Locale): string {
  if (locale === "fr") {
    const formatted = amount.toFixed(2).replace(".", ",");
    return `${formatted}\u00a0$`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Formats a speed string showing download/upload.
 *
 * English: "50/10 Mbps"
 * French:  "50/10 Mbit/s"
 */
export function formatSpeed(down: number, up: number, locale: Locale): string {
  const unit = t(locale, "units.mbps");
  return `${down}/${up} ${unit}`;
}
