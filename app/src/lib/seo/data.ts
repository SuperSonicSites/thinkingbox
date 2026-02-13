import type { Locale } from "@/types/index";

// ── Type definitions for SEO data ──

export interface SEOCity {
  slug: string;
  name_en: string;
  name_fr: string;
  province_code: string;
  province_en: string;
  province_fr: string;
  population: number;
  latitude: number;
  longitude: number;
  nearby_cities: string[];
  major_isps: string[];
  description_en: string;
  description_fr: string;
}

export interface SEOISP {
  slug: string;
  name: string;
  legal_name: string;
  description_en: string;
  description_fr: string;
  founded_year: number;
  headquarters: string;
  website: string;
  technologies: string[];
  provinces_served: string[];
  metro_markets: string[];
  ownership_type: string;
  customer_count_approx: number;
}

export interface SEOComparison {
  slug: string;
  provider_a_slug: string;
  provider_b_slug: string;
  provider_a_name: string;
  provider_b_name: string;
  verdict_en: string;
  verdict_fr: string;
  common_provinces: string[];
  faqs_en: Array<{ question: string; answer: string }>;
  faqs_fr: Array<{ question: string; answer: string }>;
}

export interface SEOTechnology {
  slug: string;
  name_en: string;
  name_fr: string;
  description_en: string;
  description_fr: string;
  how_it_works_en: string;
  how_it_works_fr: string;
  speed_range_down: string;
  speed_range_up: string;
  typical_latency_ms: string;
  availability_percent: number;
  pros_en: string[];
  pros_fr: string[];
  cons_en: string[];
  cons_fr: string[];
  best_for_en: string;
  best_for_fr: string;
  major_providers: string[];
  faqs_en: Array<{ question: string; answer: string }>;
  faqs_fr: Array<{ question: string; answer: string }>;
}

export interface SEOSpeedTier {
  slug: string;
  name_en: string;
  name_fr: string;
  range_en: string;
  range_fr: string;
  description_en: string;
  description_fr: string;
  crtc_classification_en: string;
  crtc_classification_fr: string;
  suitable_activities_en: string[];
  suitable_activities_fr: string[];
  not_suitable_en: string[];
  not_suitable_fr: string[];
  household_size: string;
  device_count: string;
  typical_technologies: string[];
  typical_price_range_en: string;
  typical_price_range_fr: string;
  faqs_en: Array<{ question: string; answer: string }>;
  faqs_fr: Array<{ question: string; answer: string }>;
}

export interface SEOGuideSection {
  heading_en: string;
  heading_fr: string;
  content_en: string;
  content_fr: string;
}

export interface SEOGuide {
  slug: string;
  title_en: string;
  title_fr: string;
  description_en: string;
  description_fr: string;
  reading_time_minutes: number;
  sections: SEOGuideSection[];
  related_pages: Array<{ type: string; slug: string }>;
  faqs_en: Array<{ question: string; answer: string }>;
  faqs_fr: Array<{ question: string; answer: string }>;
}

// ── Data imports ──

import citiesData from "@/data/seo/cities.json";
import ispsData from "@/data/seo/isps.json";
import comparisonsData from "@/data/seo/comparisons.json";
import technologiesData from "@/data/seo/technologies.json";
import speedTiersData from "@/data/seo/speed-tiers.json";
import guidesData from "@/data/seo/guides.json";

const cities = citiesData as SEOCity[];
const isps = ispsData as SEOISP[];
const comparisons = comparisonsData as SEOComparison[];
const technologies = technologiesData as SEOTechnology[];
const speedTiers = speedTiersData as SEOSpeedTier[];
const guides = guidesData as SEOGuide[];

// ── Province data ──

export interface Province {
  code: string;
  name_en: string;
  name_fr: string;
}

export const provinces: Province[] = [
  { code: "on", name_en: "Ontario", name_fr: "Ontario" },
  { code: "qc", name_en: "Quebec", name_fr: "Qu\u00e9bec" },
  { code: "bc", name_en: "British Columbia", name_fr: "Colombie-Britannique" },
  { code: "ab", name_en: "Alberta", name_fr: "Alberta" },
  { code: "mb", name_en: "Manitoba", name_fr: "Manitoba" },
  { code: "sk", name_en: "Saskatchewan", name_fr: "Saskatchewan" },
  { code: "ns", name_en: "Nova Scotia", name_fr: "Nouvelle-\u00c9cosse" },
  { code: "nb", name_en: "New Brunswick", name_fr: "Nouveau-Brunswick" },
  { code: "nl", name_en: "Newfoundland and Labrador", name_fr: "Terre-Neuve-et-Labrador" },
  { code: "pe", name_en: "Prince Edward Island", name_fr: "\u00cele-du-Prince-\u00c9douard" },
  { code: "nt", name_en: "Northwest Territories", name_fr: "Territoires du Nord-Ouest" },
  { code: "yt", name_en: "Yukon", name_fr: "Yukon" },
  { code: "nu", name_en: "Nunavut", name_fr: "Nunavut" },
];

// ── City queries ──

export function getCities(): SEOCity[] {
  return cities;
}

export function getCityBySlug(slug: string): SEOCity | undefined {
  return cities.find((c) => c.slug === slug);
}

export function getCitiesByProvince(provinceCode: string): SEOCity[] {
  return cities.filter((c) => c.province_code === provinceCode);
}

// ── ISP queries ──

export function getISPs(): SEOISP[] {
  return isps;
}

export function getISPBySlug(slug: string): SEOISP | undefined {
  return isps.find((i) => i.slug === slug);
}

export function getISPsByProvince(provinceCode: string): SEOISP[] {
  return isps.filter((i) => i.provinces_served.includes(provinceCode));
}

// ── Comparison queries ──

export function getComparisons(): SEOComparison[] {
  return comparisons;
}

export function getComparisonBySlug(slug: string): SEOComparison | undefined {
  return comparisons.find((c) => c.slug === slug);
}

// ── Technology queries ──

export function getTechnologies(): SEOTechnology[] {
  return technologies;
}

export function getTechnologyBySlug(slug: string): SEOTechnology | undefined {
  return technologies.find((t) => t.slug === slug);
}

// ── Speed tier queries ──

export function getSpeedTiers(): SEOSpeedTier[] {
  return speedTiers;
}

export function getSpeedTierBySlug(slug: string): SEOSpeedTier | undefined {
  return speedTiers.find((s) => s.slug === slug);
}

// ── Guide queries ──

export function getGuides(): SEOGuide[] {
  return guides;
}

export function getGuideBySlug(slug: string): SEOGuide | undefined {
  return guides.find((g) => g.slug === slug);
}

// ── Province queries ──

export function getProvinceByCode(code: string): Province | undefined {
  return provinces.find((p) => p.code === code);
}

// ── Locale helpers ──

export function localized<T>(obj: T, field: string, locale: Locale): string {
  const key = `${field}_${locale}` as keyof T;
  return (obj[key] as string) ?? "";
}

export function localizedFaqs(
  obj: { faqs_en: Array<{ question: string; answer: string }>; faqs_fr: Array<{ question: string; answer: string }> },
  locale: Locale
): Array<{ question: string; answer: string }> {
  return locale === "fr" ? obj.faqs_fr : obj.faqs_en;
}
