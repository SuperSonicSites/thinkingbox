import { describe, expect, it } from "vitest";
import { buildBreadcrumbListSchema } from "@/lib/seo/schema";

describe("buildBreadcrumbListSchema", () => {
  it("returns null for homepage path", () => {
    expect(buildBreadcrumbListSchema("https://ispbyaddress.ca", "/", "en")).toBeNull();
  });

  it("builds english breadcrumb list for nested paths", () => {
    const schema = buildBreadcrumbListSchema("https://ispbyaddress.ca", "/compare/bell-vs-rogers", "en") as {
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(schema.itemListElement[0].name).toBe("Home");
    expect(schema.itemListElement[1].item).toBe("https://ispbyaddress.ca/compare");
    expect(schema.itemListElement[2].name).toBe("Bell vs rogers");
  });

  it("builds french breadcrumb list and skips fr segment", () => {
    const schema = buildBreadcrumbListSchema("https://ispbyaddress.ca", "/fr/providers/bell", "fr") as {
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(schema.itemListElement[0].name).toBe("Accueil");
    expect(schema.itemListElement[1].item).toBe("https://ispbyaddress.ca/fr/providers");
    expect(schema.itemListElement[2].item).toBe("https://ispbyaddress.ca/fr/providers/bell");
  });
});
