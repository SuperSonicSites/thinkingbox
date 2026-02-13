import type { APIRoute } from "astro";
import { getCities, getISPs, getComparisons, getTechnologies, getSpeedTiers, getGuides, provinces } from "@/lib/seo/data";

export const prerender = true;

const SITE = "https://ispbyaddress.ca";

interface SitemapEntry {
  loc: string;
  hreflang_en: string;
  hreflang_fr: string;
  changefreq: string;
  priority: string;
}

function entry(enPath: string, frPath: string, changefreq: string, priority: string): SitemapEntry {
  return {
    loc: `${SITE}${enPath}`,
    hreflang_en: `${SITE}${enPath}`,
    hreflang_fr: `${SITE}${frPath}`,
    changefreq,
    priority,
  };
}

function entryPair(enPath: string, frPath: string, changefreq: string, priorityEn: string, priorityFr: string): SitemapEntry[] {
  return [
    { loc: `${SITE}${enPath}`, hreflang_en: `${SITE}${enPath}`, hreflang_fr: `${SITE}${frPath}`, changefreq, priority: priorityEn },
    { loc: `${SITE}${frPath}`, hreflang_en: `${SITE}${enPath}`, hreflang_fr: `${SITE}${frPath}`, changefreq, priority: priorityFr },
  ];
}

export const GET: APIRoute = () => {
  const entries: SitemapEntry[] = [];

  // Static pages
  entries.push(...entryPair("/", "/fr", "weekly", "1.0", "0.9"));
  entries.push(...entryPair("/privacy", "/fr/privacy", "yearly", "0.3", "0.3"));
  entries.push(...entryPair("/terms", "/fr/terms", "yearly", "0.3", "0.3"));

  // Coverage hub
  entries.push(...entryPair("/coverage", "/fr/coverage", "monthly", "0.8", "0.7"));

  // Province coverage pages
  for (const prov of provinces) {
    entries.push(...entryPair(`/coverage/${prov.code}`, `/fr/coverage/${prov.code}`, "monthly", "0.7", "0.6"));
  }

  // City pages
  for (const city of getCities()) {
    entries.push(...entryPair(
      `/internet/${city.province_code}/${city.slug}`,
      `/fr/internet/${city.province_code}/${city.slug}`,
      "monthly",
      "0.8",
      "0.7",
    ));
  }

  // Provider hub + pages
  entries.push(...entryPair("/providers", "/fr/providers", "monthly", "0.8", "0.7"));
  for (const isp of getISPs()) {
    entries.push(...entryPair(`/providers/${isp.slug}`, `/fr/providers/${isp.slug}`, "monthly", "0.7", "0.6"));
  }

  // Technology hub + pages
  entries.push(...entryPair("/technology", "/fr/technology", "monthly", "0.7", "0.6"));
  for (const tech of getTechnologies()) {
    entries.push(...entryPair(`/technology/${tech.slug}`, `/fr/technology/${tech.slug}`, "monthly", "0.7", "0.6"));
  }

  // Speed tier hub + pages
  entries.push(...entryPair("/speeds", "/fr/speeds", "monthly", "0.7", "0.6"));
  for (const tier of getSpeedTiers()) {
    entries.push(...entryPair(`/speeds/${tier.slug}`, `/fr/speeds/${tier.slug}`, "monthly", "0.7", "0.6"));
  }

  // Comparison hub + pages
  entries.push(...entryPair("/compare", "/fr/compare", "monthly", "0.7", "0.6"));
  for (const comp of getComparisons()) {
    entries.push(...entryPair(`/compare/${comp.slug}`, `/fr/compare/${comp.slug}`, "monthly", "0.7", "0.6"));
  }

  // Guide hub + pages
  entries.push(...entryPair("/guides", "/fr/guides", "monthly", "0.7", "0.6"));
  for (const guide of getGuides()) {
    entries.push(...entryPair(`/guides/${guide.slug}`, `/fr/guides/${guide.slug}`, "monthly", "0.7", "0.6"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${e.hreflang_en}"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${e.hreflang_fr}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${e.hreflang_en}"/>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
