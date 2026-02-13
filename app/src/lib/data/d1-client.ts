/**
 * D1 (SQLite) client for write operations.
 * Handles discrepancy reports — the only write path remaining
 * after eliminating PostGIS.
 */

/** Cloudflare D1 Database binding shape. */
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Result {
  meta: { last_row_id: number; changes: number };
}

/**
 * Save a discrepancy report to D1.
 */
export async function saveDiscrepancyReport(
  db: D1Database,
  report: {
    phh_id: number | null;
    reporter_email: string | null;
    report_type: string;
    description: string;
    latitude: number | null;
    longitude: number | null;
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO discrepancy_reports
       (phh_id, reporter_email, report_type, description, latitude, longitude, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      report.phh_id,
      report.reporter_email,
      report.report_type,
      report.description,
      report.latitude,
      report.longitude
    )
    .run();

  return result.meta.last_row_id;
}

/**
 * Get discrepancy count for a PHH to feed into confidence scoring.
 */
export async function getDiscrepancyCount(
  db: D1Database,
  phhId: number,
  sinceDays: number = 90
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM discrepancy_reports
       WHERE phh_id = ? AND created_at > datetime('now', '-' || ? || ' days')`
    )
    .bind(phhId, sinceDays)
    .first<{ count: number }>();

  return row?.count ?? 0;
}
