/**
 * Geohash encoding/decoding utilities.
 * Pure TypeScript, zero dependencies. Standard base32 geohash algorithm.
 */

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/**
 * Encode latitude/longitude to a geohash string of given precision.
 * Precision 6 gives ~1.2km x 0.6km cells.
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision: number = 6
): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let hash = "";
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch |= 1 << (4 - bit);
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch |= 1 << (4 - bit);
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isLng = !isLng;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/**
 * Decode a geohash string to the center lat/lng of the cell.
 */
export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  let isLng = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) {
      throw new Error(`Invalid geohash character: ${c}`);
    }

    for (let bit = 4; bit >= 0; bit--) {
      const mask = 1 << bit;
      if (isLng) {
        const mid = (lngMin + lngMax) / 2;
        if (idx & mask) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if (idx & mask) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isLng = !isLng;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

/**
 * Get the 8 neighboring geohash cells (N, NE, E, SE, S, SW, W, NW).
 */
export function getNeighbors(hash: string): string[] {
  const { lat, lng } = decodeGeohash(hash);
  const { latError, lngError } = getGeohashErrors(hash.length);

  const latStep = latError * 2;
  const lngStep = lngError * 2;

  const directions: Array<[number, number]> = [
    [latStep, 0],       // N
    [latStep, lngStep],  // NE
    [0, lngStep],        // E
    [-latStep, lngStep], // SE
    [-latStep, 0],       // S
    [-latStep, -lngStep], // SW
    [0, -lngStep],       // W
    [latStep, -lngStep], // NW
  ];

  return directions.map(([dLat, dLng]) =>
    encodeGeohash(lat + dLat, lng + dLng, hash.length)
  );
}

/**
 * Get the lat/lng error bounds for a geohash of given precision.
 */
function getGeohashErrors(precision: number): {
  latError: number;
  lngError: number;
} {
  // Each precision level halves the error alternating between lng and lat.
  // Total bits = precision * 5. Lng gets ceil(bits/2), lat gets floor(bits/2).
  const totalBits = precision * 5;
  const lngBits = Math.ceil(totalBits / 2);
  const latBits = Math.floor(totalBits / 2);

  return {
    latError: 180 / Math.pow(2, latBits),
    lngError: 360 / Math.pow(2, lngBits),
  };
}
