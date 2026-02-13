import type { GeocodeResult } from "@/types";

interface TestAddress {
  input: string;
  lat: number;
  lng: number;
  province: string;
  context: string;
}

interface TestAddressesData {
  _comment: string;
  addresses: TestAddress[];
}

import testAddressData from "@/data/test_addresses.json";
const testAddresses = testAddressData as TestAddressesData;

/**
 * Geocode an address string to lat/lng coordinates.
 * Uses mock geocoder in dev, Google Places API in production.
 */
export async function geocodeAddress(
  address: string,
  provider: string = "mock",
  apiKey?: string
): Promise<GeocodeResult | null> {
  if (provider === "google" && apiKey) {
    return geocodeWithGoogle(address, apiKey);
  }
  return geocodeWithMock(address);
}

/**
 * Mock geocoder: matches against test_addresses.json using fuzzy string matching.
 * Returns deterministic results for development and testing.
 */
function geocodeWithMock(address: string): GeocodeResult | null {
  const normalized = address.toLowerCase().trim();

  // Try exact-ish match first
  for (const entry of testAddresses.addresses) {
    const testNormalized = entry.input.toLowerCase();
    if (normalized === testNormalized) {
      return mockEntryToResult(entry);
    }
  }

  // Try partial match on city/province
  for (const entry of testAddresses.addresses) {
    const testNormalized = entry.input.toLowerCase();
    const parts = normalized.split(",").map((p: string) => p.trim());
    const testParts = testNormalized.split(",").map((p: string) => p.trim());

    // Match if any significant part overlaps
    for (const part of parts) {
      for (const testPart of testParts) {
        if (part.length > 3 && testPart.includes(part)) {
          return mockEntryToResult(entry);
        }
      }
    }
  }

  // Default: return Toronto if nothing matches (for dev convenience)
  const toronto = testAddresses.addresses.find((a: TestAddress) => a.context === "urban-downtown" && a.province === "ON");
  if (toronto) {
    return mockEntryToResult(toronto);
  }

  return null;
}

function mockEntryToResult(entry: TestAddress): GeocodeResult {
  const parts = entry.input.split(",").map((p) => p.trim());
  const postalMatch = entry.input.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);

  return {
    latitude: entry.lat,
    longitude: entry.lng,
    normalized_address: entry.input,
    postal_code: postalMatch ? postalMatch[0].toUpperCase() : null,
    province: entry.province,
    city: parts.length >= 2 ? parts[1] : null,
    provider: "mock",
  };
}

/**
 * Google Places API (New) geocoder.
 * Uses the Geocoding API for address-to-coordinates.
 */
async function geocodeWithGoogle(
  address: string,
  apiKey: string
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address: address,
    components: "country:CA",
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  );

  if (!response.ok) {
    console.error(`Google Geocoding API error: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as GoogleGeocodeResponse;

  if (data.status !== "OK" || data.results.length === 0) {
    return null;
  }

  const result = data.results[0];
  const location = result.geometry.location;

  // Extract address components
  let postalCode: string | null = null;
  let province: string | null = null;
  let city: string | null = null;

  for (const component of result.address_components) {
    if (component.types.includes("postal_code")) {
      postalCode = component.long_name;
    }
    if (component.types.includes("administrative_area_level_1")) {
      province = component.short_name;
    }
    if (component.types.includes("locality")) {
      city = component.long_name;
    }
  }

  return {
    latitude: location.lat,
    longitude: location.lng,
    normalized_address: result.formatted_address,
    postal_code: postalCode,
    province: province,
    city: city,
    provider: "google",
  };
}

// Google Geocoding API response types
interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
}
