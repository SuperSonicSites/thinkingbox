import { describe, it, expect } from "vitest";
import { t, getTranslations, formatPrice, formatSpeed } from "./utils";

describe("t()", () => {
  it("resolves dot-notation keys for English", () => {
    expect(t("en", "nav.home")).toBe("Home");
    expect(t("en", "results.confidence.high")).toBe("High confidence");
  });

  it("resolves dot-notation keys for French", () => {
    expect(t("fr", "nav.home")).toBe("Accueil");
    expect(t("fr", "results.confidence.high")).toContain("lev");
  });

  it("returns the key itself for missing paths", () => {
    expect(t("en", "nonexistent.key.deep")).toBe("nonexistent.key.deep");
  });

  it("returns the key if path resolves to object not string", () => {
    expect(t("en", "nav")).toBe("nav");
  });

  it("handles top-level string keys", () => {
    expect(t("en", "common.loading")).toBe("Loading...");
    expect(t("fr", "common.loading")).toBe("Chargement...");
  });
});

describe("getTranslations()", () => {
  it("returns the full EN translation object", () => {
    const trans = getTranslations("en");
    expect(trans).toHaveProperty("nav");
    expect(trans).toHaveProperty("lookup");
    expect(trans).toHaveProperty("results");
    expect(trans).toHaveProperty("common");
  });

  it("returns the full FR translation object", () => {
    const trans = getTranslations("fr");
    expect(trans).toHaveProperty("nav");
    expect(trans).toHaveProperty("lookup");
  });
});

describe("formatPrice()", () => {
  it("formats English prices with $ prefix", () => {
    expect(formatPrice(64.95, "en")).toBe("$64.95");
    expect(formatPrice(0, "en")).toBe("$0.00");
    expect(formatPrice(99, "en")).toBe("$99.00");
  });

  it("formats French prices with $ suffix and comma decimal", () => {
    expect(formatPrice(64.95, "fr")).toBe("64,95\u00a0$");
    expect(formatPrice(0, "fr")).toBe("0,00\u00a0$");
    expect(formatPrice(99, "fr")).toBe("99,00\u00a0$");
  });
});

describe("formatSpeed()", () => {
  it("formats English speeds with Mbps", () => {
    expect(formatSpeed(50, 10, "en")).toBe("50/10 Mbps");
    expect(formatSpeed(1000, 500, "en")).toBe("1000/500 Mbps");
  });

  it("formats French speeds with Mbit/s", () => {
    expect(formatSpeed(50, 10, "fr")).toBe("50/10 Mbit/s");
  });
});
