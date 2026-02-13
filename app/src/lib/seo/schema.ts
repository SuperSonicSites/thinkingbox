import type { Locale } from "@/types/index";

interface BreadcrumbListItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item: string;
}

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function prettifySegment(segment: string): string {
  const decoded = decodeURIComponent(segment).replace(/[-_]/g, " ").trim();
  return decoded ? decoded.charAt(0).toUpperCase() + decoded.slice(1) : segment;
}

export function buildBreadcrumbListSchema(siteUrl: string, canonicalPath: string, locale: Locale): Record<string, unknown> | null {
  const normalized = normalizePath(canonicalPath);
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const rootLabel = locale === "fr" ? "Accueil" : "Home";
  const items: BreadcrumbListItem[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: rootLabel,
      item: `${siteUrl}${locale === "fr" ? "/fr" : "/"}`,
    },
  ];

  const skipLeadingLocale = locale === "fr" && parts[0] === "fr";
  const segments = skipLeadingLocale ? parts.slice(1) : parts;

  let accumulatedPath = locale === "fr" ? "/fr" : "";

  segments.forEach((segment, index) => {
    accumulatedPath = `${accumulatedPath}/${segment}`;
    items.push({
      "@type": "ListItem",
      position: index + 2,
      name: prettifySegment(segment),
      item: `${siteUrl}${accumulatedPath}`,
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
