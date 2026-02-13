import type { CellData, CellPoint, CSDInfo, PHHMatchResult } from "./types";
import { haversineDistance } from "@/lib/geo/haversine";

/** Maximum distance in meters to consider a PHH point a valid match. */
const MAX_MATCH_DISTANCE_METERS = 5000;

/**
 * Find the nearest PHH point to a given lat/lng from pre-fetched cell data.
 * Replaces PostGIS ST_DWithin spatial queries.
 *
 * @param lat - User's geocoded latitude
 * @param lng - User's geocoded longitude
 * @param cells - Array of cell data from the 9 fetched geohash cells (center + 8 neighbors)
 * @returns The nearest PHH point with distance and CSD info, or null if none within 5km
 */
export function findNearestPHH(
  lat: number,
  lng: number,
  cells: CellData[]
): PHHMatchResult | null {
  let nearest: { point: CellPoint; distance: number; csd: CSDInfo } | null = null;

  for (const cell of cells) {
    for (const point of cell.points) {
      const distance = haversineDistance(lat, lng, point.lat, point.lng);

      if (distance <= MAX_MATCH_DISTANCE_METERS) {
        if (nearest === null || distance < nearest.distance) {
          nearest = { point, distance, csd: cell.csd };
        }
      }
    }
  }

  if (!nearest) return null;

  return {
    point: nearest.point,
    distanceMeters: nearest.distance,
    csd: nearest.csd,
  };
}
