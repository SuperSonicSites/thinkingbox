import { describe, it, expect } from "vitest";
import { haversineDistance } from "./haversine";

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    const d = haversineDistance(43.6532, -79.3832, 43.6532, -79.3832);
    expect(d).toBe(0);
  });

  it("computes Toronto to Montreal (~504km)", () => {
    // Toronto: 43.6532, -79.3832
    // Montreal: 45.5017, -73.5673
    const d = haversineDistance(43.6532, -79.3832, 45.5017, -73.5673);
    // Known distance: ~504 km
    expect(d).toBeGreaterThan(490_000);
    expect(d).toBeLessThan(520_000);
  });

  it("computes short distance accurately (<1km)", () => {
    // Two points ~111m apart (0.001 degree latitude at ~45N)
    const d = haversineDistance(45.5000, -73.5670, 45.5010, -73.5670);
    // 0.001 degrees lat ≈ 111m
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it("is symmetric", () => {
    const d1 = haversineDistance(43.6532, -79.3832, 45.5017, -73.5673);
    const d2 = haversineDistance(45.5017, -73.5673, 43.6532, -79.3832);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it("computes antipodal distance (~20,000km)", () => {
    // Opposite sides of Earth
    const d = haversineDistance(0, 0, 0, 180);
    // Half circumference ≈ 20,015km
    expect(d).toBeGreaterThan(20_000_000);
    expect(d).toBeLessThan(20_100_000);
  });

  it("handles negative coordinates correctly", () => {
    // Buenos Aires (-34.6037, -58.3816) to Sydney (-33.8688, 151.2093)
    const d = haversineDistance(-34.6037, -58.3816, -33.8688, 151.2093);
    // Known distance: ~11,800 km
    expect(d).toBeGreaterThan(11_500_000);
    expect(d).toBeLessThan(12_100_000);
  });
});
