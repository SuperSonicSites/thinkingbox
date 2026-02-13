import { describe, it, expect } from "vitest";
import { deriveAvailability, availabilityClassLabel } from "./resolver";
import type { CoverageSnapshot } from "@/types";

function makeSnapshot(
  overrides: Partial<CoverageSnapshot> = {}
): CoverageSnapshot {
  return {
    phh_id: 12345,
    dataset_variant: "current",
    combined_lt5_1: false,
    wired_lt5_1: false,
    wireless_lt5_1: false,
    combined_5_1: false,
    wired_5_1: false,
    wireless_5_1: false,
    combined_10_2: false,
    wired_10_2: false,
    wireless_10_2: false,
    combined_25_5: false,
    wired_25_5: false,
    wireless_25_5: false,
    combined_50_10: false,
    wired_50_10: false,
    wireless_50_10: false,
    avail_lte_mobile: false,
    combined_max_threshold: "",
    wired_max_threshold: "",
    wireless_max_threshold: "",
    satellite_max_threshold: "",
    ingested_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("deriveAvailability", () => {
  it("classifies 50/10+ when combined_50_10 is true", () => {
    const snapshot = makeSnapshot({
      combined_50_10: true,
      wired_50_10: true,
    });
    const result = deriveAvailability(snapshot);

    expect(result.combined.available).toBe(true);
    expect(result.combined.availability_class).toBe("50_10_plus");
    expect(result.wired.available).toBe(true);
    expect(result.wired.availability_class).toBe("50_10_plus");
  });

  it("classifies based on max_threshold enum", () => {
    const snapshot = makeSnapshot({
      combined_max_threshold: "25_5",
      wired_max_threshold: "10_2",
    });
    const result = deriveAvailability(snapshot);

    expect(result.combined.availability_class).toBe("25_5");
    expect(result.wired.availability_class).toBe("10_2");
  });

  it("classifies unknown_or_unserved when no data", () => {
    const snapshot = makeSnapshot();
    const result = deriveAvailability(snapshot);

    expect(result.combined.available).toBe(false);
    expect(result.combined.availability_class).toBe("unknown_or_unserved");
    expect(result.wired.available).toBe(false);
    expect(result.wireless.available).toBe(false);
  });

  it("detects wireless-dependent state", () => {
    const snapshot = makeSnapshot({
      combined_50_10: true,
      wireless_50_10: true,
      // wired stays all false
    });
    const result = deriveAvailability(snapshot);

    expect(result.wireless_dependent).toBe(true);
    expect(result.wired.available).toBe(false);
    expect(result.wireless.available).toBe(true);
  });

  it("does not flag wireless_dependent when wired is available", () => {
    const snapshot = makeSnapshot({
      combined_50_10: true,
      wired_50_10: true,
      wireless_50_10: true,
    });
    const result = deriveAvailability(snapshot);

    expect(result.wireless_dependent).toBe(false);
  });

  it("includes LTE mobile and satellite data", () => {
    const snapshot = makeSnapshot({
      avail_lte_mobile: true,
      satellite_max_threshold: "25_5",
    });
    const result = deriveAvailability(snapshot);

    expect(result.lte_mobile_available).toBe(true);
    expect(result.satellite_max_threshold).toBe("25_5");
  });

  it("prefers boolean flags over empty enum", () => {
    const snapshot = makeSnapshot({
      combined_5_1: true,
      combined_max_threshold: "",
    });
    const result = deriveAvailability(snapshot);

    expect(result.combined.available).toBe(true);
    expect(result.combined.availability_class).toBe("5_1");
  });

  it("classifies lt5_1 correctly", () => {
    const snapshot = makeSnapshot({
      combined_lt5_1: true,
      combined_max_threshold: "<5_1",
    });
    const result = deriveAvailability(snapshot);

    expect(result.combined.available).toBe(true);
    expect(result.combined.availability_class).toBe("lt5_1");
  });
});

describe("availabilityClassLabel", () => {
  it("returns English labels by default", () => {
    expect(availabilityClassLabel("50_10_plus")).toBe("50/10 Mbps+");
    expect(availabilityClassLabel("unknown_or_unserved")).toBe(
      "Unknown or unserved"
    );
  });

  it("returns French labels when locale is fr", () => {
    expect(availabilityClassLabel("50_10_plus", "fr")).toBe("50/10 Mbit/s+");
    expect(availabilityClassLabel("lt5_1", "fr")).toBe("Sous 5/1 Mbit/s");
  });
});
