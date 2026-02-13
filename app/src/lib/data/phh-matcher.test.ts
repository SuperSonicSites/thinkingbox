import { describe, it, expect } from "vitest";
import { findNearestPHH } from "./phh-matcher";
import type { CellData } from "./types";

function makeCell(overrides: Partial<CellData> = {}): CellData {
  return {
    csd: { uid: "2466023", en: "Montreal", fr: "Montréal" },
    points: [],
    ...overrides,
  };
}

describe("findNearestPHH", () => {
  it("returns null when no cells have points", () => {
    const cells = [makeCell(), makeCell()];
    const result = findNearestPHH(45.5, -73.5, cells);
    expect(result).toBeNull();
  });

  it("returns null when no cells provided", () => {
    const result = findNearestPHH(45.5, -73.5, []);
    expect(result).toBeNull();
  });

  it("finds the nearest point across multiple cells", () => {
    const cells = [
      makeCell({
        csd: { uid: "1", en: "Far", fr: "Loin" },
        points: [
          {
            id: "PHH_100",
            lat: 45.6,
            lng: -73.6,
            hex: "HEX1",
            prov: "qc",
            cov: { c: "50_10", w: "50_10", x: "25_5", s: "5_1", lte: true, at: "2026-01-01T00:00:00Z" },
          },
        ],
      }),
      makeCell({
        csd: { uid: "2", en: "Near", fr: "Proche" },
        points: [
          {
            id: "PHH_200",
            lat: 45.5001,
            lng: -73.5001,
            hex: "HEX2",
            prov: "qc",
            cov: { c: "25_5", w: "10_2", x: "5_1", s: "5_1", lte: true, at: "2026-01-01T00:00:00Z" },
          },
        ],
      }),
    ];

    const result = findNearestPHH(45.5, -73.5, cells);
    expect(result).not.toBeNull();
    expect(result!.point.id).toBe("PHH_200");
    expect(result!.distanceMeters).toBeLessThan(50);
    expect(result!.csd.en).toBe("Near");
  });

  it("rejects points beyond 5km threshold", () => {
    const cells = [
      makeCell({
        points: [
          {
            id: "PHH_999",
            lat: 46.0, // ~56km away from 45.5
            lng: -73.5,
            hex: "HEX1",
            prov: "qc",
            cov: { c: "50_10", w: "50_10", x: "25_5", s: "5_1", lte: true, at: "2026-01-01T00:00:00Z" },
          },
        ],
      }),
    ];

    const result = findNearestPHH(45.5, -73.5, cells);
    expect(result).toBeNull();
  });

  it("includes CSD info from the cell containing the nearest point", () => {
    const cells = [
      makeCell({
        csd: { uid: "9999", en: "TestCity", fr: "VilleTest" },
        points: [
          {
            id: "PHH_300",
            lat: 45.5,
            lng: -73.5,
            hex: "HEX3",
            prov: "qc",
            cov: { c: "50_10", w: "50_10", x: "25_5", s: "5_1", lte: true, at: "2026-01-01T00:00:00Z" },
          },
        ],
      }),
    ];

    const result = findNearestPHH(45.5, -73.5, cells);
    expect(result).not.toBeNull();
    expect(result!.csd.uid).toBe("9999");
    expect(result!.csd.en).toBe("TestCity");
    expect(result!.csd.fr).toBe("VilleTest");
  });

  it("handles multiple points in the same cell", () => {
    const cells = [
      makeCell({
        points: [
          {
            id: "PHH_10",
            lat: 45.502,
            lng: -73.502,
            hex: "HEX1",
            prov: "qc",
            cov: { c: "5_1", w: "", x: "5_1", s: "5_1", lte: false, at: "2026-01-01T00:00:00Z" },
          },
          {
            id: "PHH_20",
            lat: 45.5001,
            lng: -73.5001,
            hex: "HEX1",
            prov: "qc",
            cov: { c: "50_10", w: "50_10", x: "25_5", s: "5_1", lte: true, at: "2026-01-01T00:00:00Z" },
          },
        ],
      }),
    ];

    const result = findNearestPHH(45.5, -73.5, cells);
    expect(result).not.toBeNull();
    expect(result!.point.id).toBe("PHH_20"); // Closer point
  });
});
