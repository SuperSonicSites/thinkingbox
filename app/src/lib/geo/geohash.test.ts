import { describe, it, expect } from "vitest";
import { encodeGeohash, decodeGeohash, getNeighbors } from "./geohash";

describe("encodeGeohash", () => {
  it("encodes Toronto to a known geohash", () => {
    // Toronto: 43.6532, -79.3832
    const hash = encodeGeohash(43.6532, -79.3832, 6);
    expect(hash).toHaveLength(6);
    expect(hash).toBe("dpz83d");
  });

  it("encodes Montreal to a known geohash", () => {
    // Montreal: 45.5017, -73.5673
    const hash = encodeGeohash(45.5017, -73.5673, 6);
    expect(hash).toHaveLength(6);
    expect(hash).toBe("f25dvg");
  });

  it("encodes Vancouver correctly", () => {
    // Vancouver: 49.2827, -123.1207
    const hash = encodeGeohash(49.2827, -123.1207, 6);
    expect(hash).toHaveLength(6);
    expect(hash).toBe("c2b2q7");
  });

  it("handles precision parameter", () => {
    const hash4 = encodeGeohash(43.6532, -79.3832, 4);
    const hash8 = encodeGeohash(43.6532, -79.3832, 8);
    expect(hash4).toHaveLength(4);
    expect(hash8).toHaveLength(8);
    // Longer hash should start with shorter hash
    expect(hash8.startsWith(hash4)).toBe(true);
  });

  it("encodes equator/prime meridian", () => {
    const hash = encodeGeohash(0, 0, 6);
    expect(hash).toHaveLength(6);
    expect(hash).toBe("s00000");
  });
});

describe("decodeGeohash", () => {
  it("decode is inverse of encode (within cell precision)", () => {
    const original = { lat: 43.6532, lng: -79.3832 };
    const hash = encodeGeohash(original.lat, original.lng, 6);
    const decoded = decodeGeohash(hash);

    // At precision 6, error should be <0.01 degrees (~1km)
    expect(Math.abs(decoded.lat - original.lat)).toBeLessThan(0.01);
    expect(Math.abs(decoded.lng - original.lng)).toBeLessThan(0.01);
  });

  it("throws on invalid characters", () => {
    expect(() => decodeGeohash("abc!@#")).toThrow("Invalid geohash character");
  });
});

describe("getNeighbors", () => {
  it("returns exactly 8 neighbors", () => {
    const hash = encodeGeohash(43.6532, -79.3832, 6);
    const neighbors = getNeighbors(hash);
    expect(neighbors).toHaveLength(8);
  });

  it("returns all unique hashes", () => {
    const hash = encodeGeohash(43.6532, -79.3832, 6);
    const neighbors = getNeighbors(hash);
    const unique = new Set(neighbors);
    expect(unique.size).toBe(8);
    // Center hash should not be in neighbors
    expect(neighbors.includes(hash)).toBe(false);
  });

  it("neighbors have same precision as input", () => {
    const hash = encodeGeohash(43.6532, -79.3832, 6);
    const neighbors = getNeighbors(hash);
    for (const n of neighbors) {
      expect(n).toHaveLength(6);
    }
  });

  it("neighbor centers are close to original", () => {
    const hash = encodeGeohash(43.6532, -79.3832, 6);
    const center = decodeGeohash(hash);
    const neighbors = getNeighbors(hash);

    for (const n of neighbors) {
      const nc = decodeGeohash(n);
      // At precision 6, neighbors should be within ~2km
      expect(Math.abs(nc.lat - center.lat)).toBeLessThan(0.02);
      expect(Math.abs(nc.lng - center.lng)).toBeLessThan(0.03);
    }
  });
});
