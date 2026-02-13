-- 001-initial-schema.sql
-- Initial database migration for ISP-by-Address Canada
-- Postgres 16 + PostGIS 3.4
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. phh_points - PHH representative points
-- ============================================================

CREATE TABLE IF NOT EXISTS phh_points (
    phh_id                    BIGINT           PRIMARY KEY,
    type                      SMALLINT,
    pop_2021                  NUMERIC(12,4),
    total_dwellings_2021      NUMERIC(12,4),
    usual_res_dwellings_2021  NUMERIC(12,4),
    dbuid                     TEXT,
    hexuid                    TEXT             NOT NULL,
    province_code             CHAR(2)          NOT NULL,
    latitude                  DOUBLE PRECISION NOT NULL,
    longitude                 DOUBLE PRECISION NOT NULL,
    geometry                  GEOGRAPHY(Point, 4326) NOT NULL
);

-- ============================================================
-- 3. phh_coverage_snapshots - Speed availability per PHH
-- ============================================================

CREATE TABLE IF NOT EXISTS phh_coverage_snapshots (
    id                        BIGSERIAL        PRIMARY KEY,
    phh_id                    BIGINT           NOT NULL REFERENCES phh_points (phh_id),
    dataset_variant           TEXT             NOT NULL DEFAULT 'current',
    combined_lt5_1            BOOLEAN          NOT NULL DEFAULT false,
    wired_lt5_1               BOOLEAN          NOT NULL DEFAULT false,
    wireless_lt5_1            BOOLEAN          NOT NULL DEFAULT false,
    combined_5_1              BOOLEAN          NOT NULL DEFAULT false,
    wired_5_1                 BOOLEAN          NOT NULL DEFAULT false,
    wireless_5_1              BOOLEAN          NOT NULL DEFAULT false,
    combined_10_2             BOOLEAN          NOT NULL DEFAULT false,
    wired_10_2                BOOLEAN          NOT NULL DEFAULT false,
    wireless_10_2             BOOLEAN          NOT NULL DEFAULT false,
    combined_25_5             BOOLEAN          NOT NULL DEFAULT false,
    wired_25_5                BOOLEAN          NOT NULL DEFAULT false,
    wireless_25_5             BOOLEAN          NOT NULL DEFAULT false,
    combined_50_10            BOOLEAN          NOT NULL DEFAULT false,
    wired_50_10               BOOLEAN          NOT NULL DEFAULT false,
    wireless_50_10            BOOLEAN          NOT NULL DEFAULT false,
    avail_lte_mobile          BOOLEAN          NOT NULL DEFAULT false,
    combined_max_threshold    TEXT             DEFAULT '',
    wired_max_threshold       TEXT             DEFAULT '',
    wireless_max_threshold    TEXT             DEFAULT '',
    satellite_max_threshold   TEXT             DEFAULT '',
    ingested_at               TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dataset_variant CHECK (
        dataset_variant IN (
            'current',
            'cib',
            'ubf_core',
            'ubf_rrs',
            'government_support',
            'private_expansions'
        )
    ),

    CONSTRAINT chk_combined_max_threshold CHECK (
        combined_max_threshold IN ('', '<5_1', '5_1', '10_2', '25_5', '50_10')
    ),

    CONSTRAINT chk_wired_max_threshold CHECK (
        wired_max_threshold IN ('', '<5_1', '5_1', '10_2', '25_5', '50_10')
    ),

    CONSTRAINT chk_wireless_max_threshold CHECK (
        wireless_max_threshold IN ('', '<5_1', '5_1', '10_2', '25_5', '50_10')
    ),

    CONSTRAINT chk_satellite_max_threshold CHECK (
        satellite_max_threshold IN ('', '<5_1', '5_1', '10_2', '25_5', '50_10')
    )
);

-- ============================================================
-- 4. hex_isp_coverage - ISP presence per hexagon
-- ============================================================

CREATE TABLE IF NOT EXISTS hex_isp_coverage (
    id                BIGSERIAL PRIMARY KEY,
    hexuid            TEXT      NOT NULL,
    provider_name     TEXT      NOT NULL,
    technology_en     TEXT      NOT NULL,
    technology_fr     TEXT      NOT NULL
);

-- ============================================================
-- 5. hex_demographics - Population/dwelling stats per hex
-- ============================================================

CREATE TABLE IF NOT EXISTS hex_demographics (
    hexuid                  TEXT    PRIMARY KEY,
    sum_pop_2021            TEXT,
    sum_urd_2021            TEXT,
    sum_td_2021             TEXT,
    avail_5_1_75pct_plus    BOOLEAN DEFAULT false,
    avail_50_10_gradient    TEXT
);

-- ============================================================
-- 6. community_placenames - Bilingual place names
-- ============================================================

CREATE TABLE IF NOT EXISTS community_placenames (
    pnuid                 INTEGER          PRIMARY KEY,
    name_en               TEXT             NOT NULL,
    name_fr               TEXT             NOT NULL,
    latitude              DOUBLE PRECISION NOT NULL,
    longitude             DOUBLE PRECISION NOT NULL,
    satellite_dependent   BOOLEAN          DEFAULT false,
    no_backbone_fibre     BOOLEAN          DEFAULT false,
    cti_backbone          BOOLEAN          DEFAULT false,
    geometry              GEOGRAPHY(Point, 4326) NOT NULL
);

-- ============================================================
-- 7. census_subdivisions - Municipality boundary polygons
-- ============================================================

CREATE TABLE IF NOT EXISTS census_subdivisions (
    csd_uid       TEXT             PRIMARY KEY,
    name_en       TEXT             NOT NULL,
    name_fr       TEXT             NOT NULL,
    province      TEXT             NOT NULL,
    geometry      GEOMETRY(MultiPolygon, 4326) NOT NULL
);

-- ============================================================
-- 8. addresses - Geocoded user lookups
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
    id                  BIGSERIAL        PRIMARY KEY,
    raw_input           TEXT             NOT NULL,
    normalized_address  TEXT,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    postal_code         TEXT,
    province            TEXT,
    city                TEXT,
    geometry            GEOGRAPHY(Point, 4326),
    geocode_provider    TEXT             NOT NULL,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. address_phh_matches - Links addresses to PHH points
-- ============================================================

CREATE TABLE IF NOT EXISTS address_phh_matches (
    id                  BIGSERIAL        PRIMARY KEY,
    address_id          BIGINT           NOT NULL REFERENCES addresses (id),
    phh_id              BIGINT           NOT NULL REFERENCES phh_points (phh_id),
    distance_meters     DOUBLE PRECISION NOT NULL,
    rank                SMALLINT         NOT NULL DEFAULT 1,
    confidence_score    NUMERIC(5,2),
    spatial_score       NUMERIC(5,2),
    concordance_score   NUMERIC(5,2),
    freshness_score     NUMERIC(5,2),
    discrepancy_score   NUMERIC(5,2),
    csd_match           TEXT,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. providers - Provider registry
-- ============================================================

CREATE TABLE IF NOT EXISTS providers (
    id            SERIAL       PRIMARY KEY,
    name          TEXT         NOT NULL UNIQUE,
    slug          TEXT         NOT NULL UNIQUE,
    website_url   TEXT,
    affiliate_status TEXT     DEFAULT 'none',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. provider_plans - ISP plan pricing
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_plans (
    id                BIGSERIAL        PRIMARY KEY,
    provider_id       INTEGER          NOT NULL REFERENCES providers (id),
    region_code       TEXT             NOT NULL,
    technology        TEXT             NOT NULL,
    plan_name         TEXT             NOT NULL,
    speed_down        NUMERIC(10,2)    NOT NULL,
    speed_up          NUMERIC(10,2)    NOT NULL,
    monthly_price     NUMERIC(10,2)    NOT NULL,
    promo_price       NUMERIC(10,2),
    promo_months      SMALLINT         DEFAULT 0,
    contract_months   SMALLINT         DEFAULT 0,
    data_cap_gb       INTEGER,
    install_fee       NUMERIC(10,2)    DEFAULT 0,
    source_url        TEXT,
    source            TEXT             NOT NULL DEFAULT 'manual',
    last_verified_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    stale_flag        BOOLEAN          NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. provider_plan_change_log
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_plan_change_log (
    id              BIGSERIAL   PRIMARY KEY,
    plan_id         BIGINT      NOT NULL REFERENCES provider_plans (id),
    field_changed   TEXT        NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    change_source   TEXT        NOT NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. pricing_page_monitors
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_page_monitors (
    id              SERIAL      PRIMARY KEY,
    provider_id     INTEGER     NOT NULL REFERENCES providers (id),
    url             TEXT        NOT NULL,
    last_hash       TEXT,
    last_checked_at TIMESTAMPTZ,
    alert_pending   BOOLEAN     NOT NULL DEFAULT false
);

-- ============================================================
-- 14. users
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL   PRIMARY KEY,
    email                 TEXT        NOT NULL UNIQUE,
    language_preference   CHAR(2)     NOT NULL DEFAULT 'en',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. saved_addresses
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_addresses (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users (id),
    address_id  BIGINT      NOT NULL REFERENCES addresses (id),
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, address_id)
);

-- ============================================================
-- 16. alerts
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
    id                BIGSERIAL   PRIMARY KEY,
    user_id           BIGINT      NOT NULL REFERENCES users (id),
    address_id        BIGINT      NOT NULL REFERENCES addresses (id),
    alert_type        TEXT        NOT NULL,
    active            BOOLEAN     NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_alert_type CHECK (
        alert_type IN ('availability_change', 'price_change', 'new_plan')
    )
);

-- ============================================================
-- 17. partner_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_accounts (
    id             SERIAL      PRIMARY KEY,
    company_name   TEXT        NOT NULL,
    contact_email  TEXT        NOT NULL,
    tier           TEXT        NOT NULL DEFAULT 'basic',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. api_keys
-- ============================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id                  SERIAL      PRIMARY KEY,
    partner_id          INTEGER     NOT NULL REFERENCES partner_accounts (id),
    key_hash            TEXT        NOT NULL UNIQUE,
    key_prefix          TEXT        NOT NULL,
    rate_limit_per_hour INTEGER     NOT NULL DEFAULT 1000,
    active              BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. discrepancy_reports
-- ============================================================

CREATE TABLE IF NOT EXISTS discrepancy_reports (
    id              BIGSERIAL   PRIMARY KEY,
    address_id      BIGINT      REFERENCES addresses (id),
    phh_id          BIGINT      REFERENCES phh_points (phh_id),
    reporter_email  TEXT,
    report_type     TEXT        NOT NULL,
    description     TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending',
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 20. provenance_events
-- ============================================================

CREATE TABLE IF NOT EXISTS provenance_events (
    id           BIGSERIAL   PRIMARY KEY,
    entity_type  TEXT        NOT NULL,
    entity_id    BIGINT      NOT NULL,
    source_name  TEXT        NOT NULL,
    source_url   TEXT,
    event_type   TEXT        NOT NULL,
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    actor       TEXT        NOT NULL,
    action      TEXT        NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Spatial indexes (GIST)
CREATE INDEX IF NOT EXISTS idx_phh_points_geometry
    ON phh_points USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_community_placenames_geometry
    ON community_placenames USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_census_subdivisions_geometry
    ON census_subdivisions USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_addresses_geometry
    ON addresses USING GIST (geometry);

-- B-tree indexes
CREATE INDEX IF NOT EXISTS idx_phh_coverage_snapshots_phh_variant
    ON phh_coverage_snapshots (phh_id, dataset_variant);

CREATE INDEX IF NOT EXISTS idx_hex_isp_coverage_hexuid
    ON hex_isp_coverage (hexuid);

CREATE INDEX IF NOT EXISTS idx_provider_plans_provider_tech_region
    ON provider_plans (provider_id, technology, region_code);

CREATE INDEX IF NOT EXISTS idx_address_phh_matches_address_id
    ON address_phh_matches (address_id);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id
    ON saved_addresses (user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_user_active
    ON alerts (user_id, active);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
    ON api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_discrepancy_reports_status
    ON discrepancy_reports (status);

CREATE INDEX IF NOT EXISTS idx_provenance_events_entity
    ON provenance_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at);

-- ============================================================
-- TRIGGER: auto-update updated_at on provider_plans
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provider_plans_updated_at ON provider_plans;

CREATE TRIGGER trg_provider_plans_updated_at
    BEFORE UPDATE ON provider_plans
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

COMMIT;
