-- D1 (SQLite) schema for write operations.
-- Only discrepancy reports need persistence after eliminating PostGIS.

CREATE TABLE IF NOT EXISTS discrepancy_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phh_id INTEGER,
  reporter_email TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'wrong_provider', 'wrong_speed', 'missing_provider', 'pricing_error', 'other'
  )),
  description TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discrepancy_phh_id ON discrepancy_reports(phh_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_created_at ON discrepancy_reports(created_at);
