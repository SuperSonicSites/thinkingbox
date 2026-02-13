# Product Requirements Document (PRD)
## ISP-by-Address Canada — Autonomous Multi-Agent Build Spec

**Version:** 2.0
**Status:** Build-ready
**Scope:** End-to-end product spec enabling AI-agent swarm to build, launch, validate, and operate without human steering  
**Primary market:** Canada (EN/FR)  
**Currency:** CAD

---

## 1) Executive Summary

Build a bilingual (EN/FR) web platform that answers: **“What internet options are available at this exact Canadian address, and which plan is best for my needs?”** using PHH-derived availability thresholds, provider plan intelligence, and confidence/provenance controls.

This PRD defines product behavior, data contracts, architecture, agent responsibilities, quality gates, security/compliance, GTM instrumentation, and operational runbooks so a swarm of AI agents can execute autonomously.

---

## 2) Product Vision, Goals, and Non-Goals

### Vision
Become Canada’s most trusted address-level ISP comparison and availability intelligence product by maximizing **accuracy, freshness, and transparency**.

### Goals (12 months)
1. Deliver lookup result in <2 seconds p95 for cached addresses.
2. Achieve lookup accuracy trust score >= 90% in sampled validation checks.
3. Reach 100K monthly organic visits via programmatic SEO.
4. Convert >= 5% of lookup sessions to email capture or report share.
5. Acquire first 25 paying B2B partner/API accounts.

### Non-goals
- Not building ISP billing/payment.
- Not running installation logistics.
- Not becoming a generic review/forum site.
- Not replacing enterprise OSS/BSS telecom stacks.

---

## 3) Target Users and Personas

### Persona A — Household Mover (B2C)
- Needs fast, accurate options by exact address.
- Cares about price, upload speed, contract length, setup fees.

### Persona B — Realtor/Relocation Partner (B2B-lite)
- Needs quick answers for clients and reusable report links.
- Cares about reliability and speed of lookup.

### Persona C — ISP/Affiliate Growth Manager (B2B)
- Needs in-footprint, high-intent leads and API access.
- Cares about lead quality and attribution.

---

## 4) Core Jobs-to-be-Done

1. Determine likely internet availability at a specific address.
2. Compare plan options with normalized economics.
3. Understand confidence/uncertainty of result.
4. Save/watch addresses for changes.
5. Export/share results for household or partner workflows.

---

## 5) Functional Requirements (Full)

## 5.1 Public Website
1. Landing page with EN/FR locale switch.
2. Primary lookup form: street address, city, province, postal code.
3. Autocomplete + validation + geocoding.
4. Error and fallback handling (partial address / low confidence).

## 5.2 Lookup Results Experience
1. Availability summary card:
   - inferred threshold class (e.g., 25/5, 50/10+),
   - wired/wireless indicators,
   - LTE availability,
   - confidence score (0–100).
2. Provider plan comparison cards:
   - monthly cost, promo duration, install fees, contract term, caps.
3. Filter/sort:
   - min upload, no contract, max monthly budget, technology preference.
4. Provenance panel:
   - source labels, last updated timestamps, confidence explanations.
5. “Report discrepancy” action.

## 5.3 Accounts and Saved Objects
1. User authentication (email magic link + OAuth optional).
2. Save addresses.
3. Create watch alerts (availability change, price change, new plan).
4. Preferences management (language, notification channel).

## 5.4 Partner and API Features
1. Partner dashboard:
   - lookup volume, conversion events, lead export.
2. API endpoints:
   - address lookup,
   - threshold details,
   - plan listing,
   - change feed.
3. API keys and quota controls.

## 5.5 Admin + Ops Console
1. Source health dashboard.
2. Parser drift alerts.
3. Low-confidence queue with adjudication tooling.
4. Incident and rollback controls.
5. Content management for educational pages and legal notices.

---

## 6) Information Architecture (Site Map)

1. `/` Home
2. `/lookup` Address lookup
3. `/result/{lookup_id}` Result detail
4. `/compare/{city-or-cluster}` SEO comparison pages
5. `/coverage/{region}` Threshold/coverage pages
6. `/pricing` B2C/B2B pricing
7. `/partners` Partner program
8. `/api-docs` Developer docs
9. `/blog` Educational content
10. `/fr/*` French equivalents
11. `/account/*` User area
12. `/admin/*` Internal console

---

## 7) UX Requirements and States

### Critical states
- Address valid + high confidence.
- Address valid + medium confidence.
- Address low confidence (explicit uncertainty UI).
- No inferred service in class (graceful explanation).
- Data stale (timestamp warning).

### Accessibility
- WCAG 2.2 AA compliance.
- Keyboard-only navigation.
- Contrast and screen-reader labels.

### Localization
- EN/FR full parity for all core workflows.
- Field and metric text translated with glossary lock.

---

## 8) Data Requirements (PHH-Based)

## 8.1 Input datasets

### 8.1.1 ISED National Broadband Data (NBD) — Open Data
1. **PHH Speed Thresholds** (`NBD_PHH_Speeds/PHH_Speeds_Current-PHH_Vitesses_Actuelles_*.csv`)
   - ~16.6M rows nationally, split by province (ON=3.5M, QC=2.4M, etc.)
   - 15 boolean availability flags (combined/wired/wireless × 5 speed tiers)
   - 3 max threshold enums + 1 satellite max threshold enum
   - `Avail_LTE_Mobile_Dispo` boolean
   - Additional dataset variants: CIB, UBF Core, UBF RRS, Government Support, Private Expansions
2. **PHH Coordinate Points** (`PHH_ID_2021/PHH_2021_CSV/PHH-*.csv`)
   - `PHH_ID`, `Latitude`, `Longitude` — joins to speed thresholds
   - `HEXUID_IdUHEX` — joins to hex-level ISP/map data
   - `Pop2021`, `TDwell2021`, `URDwell2021` — demographic context
   - `DBUID_Ididu` — dissemination block (links to StatCan census geography)
3. **Hex-level ISP Names** (`Map_Data_CSV/ISP_Hex_FSI.csv`)
   - ~426K rows: ISP name + technology type per hex cell
   - Links to PHH via `HEXUID`
4. **Hex-level Demographics** (`Map_Data_CSV/Data_Hex_Données.csv`)
   - ~78K rows: population, dwellings, 50/10 coverage gradient per hex
5. **Community Placenames** (`Map_Data_CSV/Data_Com_Points_Col_Données.csv`)
   - Bilingual place names (`Name_en`, `Nom_fr`) with lat/lng
   - Satellite dependency and backbone infrastructure flags

### 8.1.2 StatCan Geographic Reference Data
6. **Census Subdivision Boundaries** (Digital Boundary Files, GeoPackage)
   - Municipality polygons for confidence concordance scoring (Section 9.4)
   - Used for programmatic SEO city/region pages
   - Province boundaries derivable from same layer

### 8.1.3 Geocoding Service (External API)
7. **Google Places API (New)** or Mapbox Search API
   - Address autocomplete (type-ahead for lookup form)
   - Forward geocoding (address → lat/lng for PHH spatial matching)
   - Bilingual address handling (EN/FR)
   - Session-based pricing: ~$17/1K sessions (Google), ~40% less (Mapbox)

### 8.1.4 Provider Plan Intelligence (Curated + Monitored)
8. **Provider plan/offer facts** — see Section 8.5 Plan Intelligence Pipeline

## 8.2 Required field mapping
Map and preserve these fields:
- `PHH_ID`
- boolean availability flags at `<5_1`, `5_1`, `10_2`, `25_5`, `50_10` for combined/wired/wireless
- `Avail_LTE_Mobile_Dispo`
- max threshold enums for combined/wired/wireless
- `Satellite_Max_Threshold` (discovered in actual data — enum, same domain as other thresholds)
- `Latitude`, `Longitude` (from PHH_2021 coordinate dataset, joined on `PHH_ID`)
- `HEXUID_IdUHEX` (hex linkage for ISP name resolution)

## 8.3 Canonical derived fields
- `combined_class`, `wired_class`, `wireless_class`
- `class_confidence`
- `lte_mobile_available`
- `address_phh_distance_meters`
- `freshness_age_hours`

## 8.4 Data quality constraints
- Boolean domain: {0,1} only.
- Enum domain: `""|<5_1|5_1|10_2|25_5|50_10`.
- Reject/flag rows violating domain rules.
- Maintain row-level provenance metadata.
- Every PHH_ID in speed data must have a matching coordinate record; orphans flagged.
- Hex-level ISP records must resolve to a known provider in the provider registry.

## 8.5 Plan Intelligence Pipeline

ISP plan/pricing data does not exist as an open dataset. Plans are public marketing content published on ISP websites. This section defines a **multi-tier, legally compliant** data collection and maintenance strategy.

### Tier 1 — Manual Seed Curation (MVP, Day 1)
- Canada's residential market is dominated by ~15-20 providers covering 90%+ of households:
  Bell, Rogers, Telus, Videotron, SaskTel, Eastlink, Cogeco, Shaw/Freedom, TBayTel, Xplore, Teksavvy, Start.ca, VMedia, Distributel, etc.
- Each publishes 3-8 residential plans publicly → ~100-150 total plan rows.
- Manual entry into `provider_plans` table with `source_url` and `last_verified_at`.
- Fields: provider_name, region_code, technology, plan_name, speed_down, speed_up,
  monthly_price, promo_price, promo_months, contract_months, data_cap_gb, install_fee.
- Refresh cadence: manual review every 2 weeks at launch.

### Tier 2 — Change Detection Monitors (Week 2+)
- Lightweight page-change monitors on ISP public pricing URLs.
- **Not scraping content** — detecting that a page changed (hash/diff of rendered page).
- On change detection: flag provider for manual review, mark existing plans as `stale`.
- Implementation: Cloudflare Worker on a cron trigger, fetches pricing page, compares SHA-256 hash of content against stored hash, emits alert on mismatch.
- Respects `robots.txt` and standard rate limits (max 1 check per provider per 24 hours).

### Tier 3 — Affiliate & Partner Feeds (Month 2+)
- Enroll in ISP affiliate/referral programs (Bell, Rogers, Telus all have them).
- Affiliate programs provide structured plan feeds with accurate pricing.
- Aligns with Persona C — ISPs are incentivized to provide data when receiving qualified leads.
- Structured feed ingestion replaces manual curation for enrolled providers.

### Tier 4 — Community Corrections (Ongoing)
- "Report discrepancy" feature (Section 5.2.5) accepts plan/pricing corrections from users.
- Corrections enter moderation queue (Section 5.5.3) before updating `provider_plans`.
- Crowdsourced freshness signal supplements all other tiers.

### Plan-to-Location Join Logic
- User address → geocode → nearest PHH(s) → PHH.HEXUID → `ISP_Hex_FSI` (ISP name + technology at hex) → `provider_plans` (matching provider + technology + region).
- If no plan data exists for a detected ISP, show provider name and technology with **"Pricing Coming Soon"** label — never suppress a known-available provider.

### Mock Data Strategy (Pre-Launch / Local Dev)
- **PHH + coordinates:** Use real data (loaded into local PostGIS from downloaded CSVs). No mocking needed — this is open data.
- **ISP hex coverage:** Use real `ISP_Hex_FSI.csv` data. No mocking needed.
- **Census boundaries:** Use real StatCan boundary files. No mocking needed.
- **Provider plans:** Seed with `mock/provider_plans.json` containing ~50 realistic sample plans across 10 providers, marked `source: "mock"`. All plan comparison cards render with a "Sample Data" badge in dev mode.
- **Geocoding:** Mock geocoder returns deterministic lat/lng for a set of ~20 test addresses (Toronto, Montreal, Vancouver, rural ON, rural QC, etc.) without calling Google API. Falls through to real API only when `GEOCODE_PROVIDER=google` env var is set.
- **Result:** Full end-to-end lookup pipeline testable locally with real availability data and mock pricing. UI renders identically to production — only plan prices are synthetic.

---

## 9) Domain Logic and Decision Rules

1. If `Combined_Max_Threshold = 50_10`, classify as `50_10_plus`.
2. If wired unavailable but wireless available at target class, mark **wireless-dependent**.
3. Empty enum + all booleans false -> `unknown_or_unserved` (never present as definitive “no service” without explicit disclaimer).
4. Confidence scoring formula (v1):
   - 40% spatial match quality (distance from geocoded address to nearest PHH point),
   - 30% postal/municipality concordance (geocoded address falls within expected Census Subdivision polygon from StatCan DBF),
   - 20% source freshness (age of PHH coverage snapshot),
   - 10% discrepancy history (prior user-reported corrections for this PHH/hex).
5. Suppress “best plan” recommendation if confidence < configurable threshold.

---

## 10) Non-Functional Requirements (NFR)

### Performance
- p50 lookup response ~200ms (KV cached), p95 < 400ms (R2 fallback).
- p95 API response < 500ms for simple queries.
- Monthly infrastructure cost: ~$0 (within Cloudflare free tiers for R2/KV/D1).

### Reliability
- 99.5% monthly uptime for public lookup.
- Graceful degradation during source outages.

### Scalability
- Handle 5K lookup requests/hour at launch.
- Horizontal worker scaling for ingestion and parsing.

### Security
- Encryption in transit and at rest.
- Secret management and key rotation.
- Role-based access controls for admin/partner.

### Observability
- Structured logs with correlation IDs.
- Metrics, traces, and alerting SLOs.

---

## 11) System Architecture (Implementation Target)

### Architecture: Pre-computed R2/KV (Zero-Database Runtime)

The ISED broadband data updates **quarterly**. Rather than running PostGIS for runtime spatial queries (~$69/mo), all spatial lookups are pre-computed into static JSON files and served from Cloudflare R2 (object storage) + KV (edge cache). The deployed application has **zero database dependencies** for read operations, bringing infrastructure cost to ~$0/mo within free tiers.

#### Runtime lookup flow
```
User address → Geocode → lat/lng
  → Compute geohash_6 in JS (~1.2km cell)
  → Fetch 9 cells from R2/KV (center + 8 neighbors, parallel)
  → Haversine distance to all PHH points in cells (in-memory)
  → Nearest PHH has embedded coverage data + hexuid
  → Fetch ISP list from R2/KV by hexuid
  → Filter plans from cached plans.json
  → CSD from pre-computed cell metadata
  → Compute confidence → Return result
```

#### Pre-compute pipeline (runs locally with PostGIS, one-time per quarterly refresh)
```
PostGIS (local Docker) → geohash partitioning → cells/{hash}.json (~150K files, ~7.5GB)
                        → ISP grouping → isps/{hexuid}.json (~74K files, ~30MB)
                        → plan bundling → plans.json (1 file, ~500KB)
                        → Upload to R2 bucket
```

### Components
1. **Web frontend:** Astro 5 + React 19 islands. Deploys to Cloudflare Pages via `@astrojs/cloudflare`.
2. **API backend:** Astro server endpoints (`src/pages/api/v1/*`) running as Cloudflare Pages Functions.
3. **Data layer (reads):** Pre-computed JSON files on Cloudflare R2, with KV edge caching (cells: 1h TTL, ISPs: 6h, plans: 24h).
4. **Data layer (writes):** Cloudflare D1 (free SQLite) for discrepancy reports only.
5. **Pre-compute pipeline:** Local PostGIS + TypeScript scripts that generate all static data files. Runs once per quarterly ISED data release.
6. **Geocoding:** Google Places API (New) for address autocomplete + forward geocoding.
7. **Spatial matching:** Pure TypeScript geohash encoding + haversine distance (replaces PostGIS ST_DWithin).
8. **Monitoring:** Cloudflare Analytics Engine + Workers Logpush.

### Local development stack (zero cloud cost)
- Astro dev server: `npm run dev` (includes API routes)
- Geocoding: mock service returning deterministic results for test addresses
- Data: local filesystem fallback reads from `data/precomputed/`, or mock province profiles if no data
- No Cloudflare account, no database, no API keys required for local dev
- PostGIS (Docker) only needed when running the pre-compute pipeline

### Service boundaries
- `lookup-service`
- `availability-service`
- `plan-service`
- `alert-service`
- `partner-service`
- `admin-ops-service`

---

## 12) Multi-Agent Build Plan (Autonomous)

### Agent roles
1. **Product Agent** — decomposes PRD into backlog and acceptance criteria.
2. **UX Agent** — generates wireframes, copy, and interaction specs.
3. **Data Ingestion Agent** — builds data connectors/parsers.
4. **Data Quality Agent** — validation rules, anomaly detection, scorecards.
5. **Backend Agent** — API/services/business logic.
6. **Frontend Agent** — responsive UI and localization.
7. **QA Agent** — tests (unit/integration/e2e/perf).
8. **Security Agent** — auth, secrets, abuse prevention.
9. **DevOps Agent** — CI/CD, infra, deployments, rollback.
10. **Growth Agent** — SEO templates, analytics, experiment setup.
11. **Compliance Agent** — PIPEDA/TOS checks and policy artifacts.

### Orchestration protocol
- Sprint loop: Plan -> Build -> Test -> Deploy -> Observe -> Improve.
- Every agent emits machine-readable outputs (JSON contracts).
- Block release if any critical gate fails (security, accuracy, or legal).

---

## 13) API Requirements (v1)

### Endpoints
1. `POST /v1/lookup`
   - Input: address payload.
   - Output: normalized address, confidence, threshold classes, top plans.
2. `GET /v1/address/{id}/availability`
3. `GET /v1/address/{id}/plans`
4. `GET /v1/changes?since=...`
5. `POST /v1/discrepancy`
6. `GET /v1/health`

### API SLAs
- Rate limits by tier.
- Idempotency keys for write endpoints.
- Standard error envelope.

---

## 14) Data Schema

### Pre-computed data (R2 — read-only, rebuilt quarterly)

#### `cells/{geohash6}.json` (~150K files, ~50KB avg)
Each file contains all PHH points in a ~1.2km x 0.6km geohash cell:
- `csd` — Census Subdivision: `{ uid, en, fr }`
- `points[]` — PHH points: `{ id, lat, lng, hex, prov, cov: { c, w, x, s, lte, at } }`
  - Coverage compact: `c`=combined, `w`=wired, `x`=wireless, `s`=satellite max thresholds
  - `lte` = LTE mobile availability, `at` = ingested timestamp

#### `isps/{hexuid}.json` (~74K files, ~400B avg)
ISP entries per hex cell: `[{ name, tech_en, tech_fr }]`

#### `plans.json` (1 file, ~500KB)
All provider plans bundled: `{ plans: [{ provider_name, region_code, technology, plan_name, speed_down, speed_up, monthly_price, ... }] }`

### D1 database (SQLite — write operations only)

Table: `discrepancy_reports`
- `id`, `phh_id`, `reporter_email`, `report_type`, `description`, `latitude`, `longitude`, `status`, `created_at`

### PostGIS schema (local pre-compute pipeline only, not deployed)

Tables used by the pre-compute pipeline (see `scripts/migrate/001-initial-schema.sql`):
- `phh_points` (PHH_ID, lat, lng, geometry, hexuid, dbuid, pop, dwellings)
- `phh_coverage_snapshots` (PHH_ID, dataset_variant, all boolean flags, all enum thresholds, lte flag, ingested_at)
- `hex_isp_coverage` (hexuid, provider_name, technology_en, technology_fr)
- `census_subdivisions` (csd_uid, name_en, name_fr, province, geometry)
- `providers` (provider registry: id, name, affiliate_status, website_url)
- `provider_plans` (provider_id, region_code, technology, plan_name, speed_down, speed_up, monthly_price, etc.)

Indices:
- GIST spatial index on `phh_points` geometry and on `census_subdivisions` geometry
- B-tree index on `hex_isp_coverage(hexuid)` for join from PHH to ISP names
- B-tree index on `provider_plans(provider_id, technology, region_code)` for plan lookup

---

## 15) Analytics, Events, and Experimentation

### Required events
- `lookup_started`
- `lookup_completed`
- `result_shared`
- `alert_created`
- `discrepancy_submitted`
- `pricing_cta_clicked`
- `partner_demo_requested`

### Core dashboards
- Funnel: lookup -> engagement -> conversion.
- Accuracy dashboard by region.
- Freshness dashboard by source/provider.
- Revenue dashboard by segment/tier.

### Experimentation
- A/B tests on LP headlines, trust modules, CTA placement.

---

## 16) SEO/Programmatic Content Requirements

1. Programmatic templates for city/postal/region pages.
2. EN/FR equivalent pages with canonical/hreflang.
3. Structured data markup where applicable.
4. Auto-generated internal linking maps.
5. Content quality guardrails (no thin/duplicate spam pages).
6. **Phased Rollout Strategy (Domain Aging):**
   - **Phase 1 (Launch):** Brand Home + Top 20 Major Cities (High quality, human-reviewed).
   - **Phase 2 (+30 Days):** Expand to Province/Region coverage pages.
   - **Phase 3 (+60 Days):** Enable programmatic sitemaps for Postal Forward Sortation Areas (FSA).
   - **Phase 4 (+90 Days):** Drip-feed long-tail street/neighborhood pages via dynamic rendering (no massive sitemap dump).

---

## 17) Security, Privacy, and Compliance

### Compliance baseline
- PIPEDA-aligned privacy program.
- Data minimization and retention policies.
- DSR (data subject request) workflows for account-linked address data.

### Data rights controls
- Source registry with license/TOS status per connector.
- “Blocklisted source” mechanism enforced at crawler level.
- Field-level provenance and timestamp transparency.

### Abuse prevention
- Bot/rate controls for public lookup and API.
- Fraud detection for partner lead abuse.

---

## 18) QA and Test Strategy (Autonomous)

### Test layers
1. Unit tests for parsing and normalization.
2. Contract tests for API schemas.
3. Integration tests for ingestion pipelines.
4. E2E tests for core user flows (lookup, save, alert, partner export).
5. Performance/load tests for lookup and API.
6. Regression tests for localization and accessibility.

### Required acceptance thresholds
- Unit test coverage >= 85% in core logic modules.
- 0 P1 defects at release.
- Lookup accuracy audit >= target for pilot geography.

### Eval framework (automated quality gates)

#### Data ingestion evals
- **Row count validation:** ingested PHH row count per province matches expected totals (ON=3,467,338, QC=2,360,553, national=16,614,053).
- **Domain validation:** 100% of boolean fields are `{0,1}`, 100% of enum fields match `{""|"<5_1"|"5_1"|"10_2"|"25_5"|"50_10"}`.
- **Join integrity:** every `PHH_ID` in speed data has a matching coordinate record; zero orphans.
- **Hex coverage:** every `HEXUID` in PHH coordinates resolves to at least one ISP in `ISP_Hex_FSI`.

#### Lookup accuracy evals
- **Golden set:** 50 manually verified addresses (mix of urban, suburban, rural, northern) with known ISP availability.
- **Spatial match eval:** for each golden address, assert nearest PHH is within expected distance threshold (urban <100m, rural <500m).
- **Confidence calibration:** confidence scores for golden set addresses fall within expected bands.
- **Classification eval:** combined/wired/wireless class matches expected for golden set.

#### API contract evals
- **Schema validation:** every API endpoint response validates against OpenAPI spec.
- **Response time:** p95 < 5s for uncached lookup, p95 < 2.5s for cached.
- **Error handling:** invalid addresses return structured error envelope, not 500.

#### UI/UX evals
- **Bilingual parity:** every EN page has a FR equivalent with identical data (automated crawler check).
- **Accessibility:** axe-core automated scan passes WCAG 2.2 AA on all page templates.
- **State coverage:** all 5 critical states (Section 7) render correctly with test fixtures.

#### Plan data evals
- **Freshness:** no `provider_plans` row has `last_verified_at` older than 30 days in production.
- **Coverage:** every ISP appearing in `ISP_Hex_FSI` for top-10 provinces has at least one plan row OR displays "Pricing Coming Soon".
- **Mock detection:** zero mock-sourced plans (`source: "mock"`) reach production environment.

---

## 19) Delivery Plan (Milestones)

### Milestone 0 (Days 1–3)
- Data contracts finalized.
- Base schema and ingestion prototype.
- Lookup prototype with PHH matching.

### Milestone 1 (Week 1)
- MVP public lookup + comparison cards.
- Core analytics and discrepancy workflow.

### Milestone 2 (Week 2)
- Accounts, saved addresses, alerting.
- Partner dashboard v0 and API beta.

### Milestone 3 (Weeks 3–4)
- **Phase 1 SEO:** Launch Brand Home + Top 20 City pages.
- Accuracy hardening and confidence calibration.
- Production launch runbook.

---

## 20) Definition of Done (DoD)

A release is complete only when all are true:
1. All critical user stories pass acceptance tests.
2. Security and compliance gates pass.
3. Accuracy and freshness KPIs meet minimum thresholds.
4. Observability dashboards and incident alerts are live.
5. Rollback and disaster-recovery procedures validated.

---

## 21) User Stories and Acceptance Criteria (Selected)

### Story 1: Address lookup
- **As** a mover, **I want** to enter my address and see likely ISP options, **so that** I can choose before move-in.
- **Acceptance criteria**:
  - Given valid address, return result in <= 5s uncached.
  - Show confidence score and last-updated timestamp.
  - Show at least one explanatory message for uncertainty states.

### Story 2: Save and alert
- **As** a user, **I want** alerts when options/prices change.
- **Acceptance criteria**:
  - Can save address and configure alert type.
  - Alert delivered and logged with provenance.

### Story 3: Partner API
- **As** a partner, **I want** API lookups for client addresses.
- **Acceptance criteria**:
  - Authenticated API access via key.
  - Rate limit and usage metrics visible.

---

## 22) Runbooks (Zero-Human-Steering Operations)

### Ingestion failure runbook
1. Detect connector failure via health check.
2. Retry with exponential backoff.
3. Switch to fallback source profile if configured.
4. Trigger incident alert and downgrade freshness badges.

### Accuracy degradation runbook
1. Eval agent detects discrepancy spike above threshold.
2. Auto-revert to previous model/parser version.
3. Raise low-confidence banner in impacted regions.
4. Reprocess backlog after fix.

### Plan data staleness runbook
1. Pricing page monitor detects hash change for a provider URL.
2. Mark all plans for that provider as `stale_flag = true`.
3. Results UI shows "pricing may have changed — last verified {date}" badge.
4. Alert enters admin review queue for manual re-curation.
5. On update: clear stale flag, log change in `provider_plan_change_log`.

### Security incident runbook
1. Rotate keys/secrets.
2. Isolate affected services.
3. Enable stricter rate limits.
4. Generate incident timeline and remediation task list.

---

## 23) Risk Register

1. **Data rights conflicts** on non-open sources.
2. **Address-level mismatch** causing trust loss.
3. **SEO commoditization** for generic comparison content.
4. **Rapid plan churn** causing stale outputs.
5. **Partner concentration** affecting revenue stability.

Mitigations are mandatory backlog items tied to each risk.

---

## 24) Launch Checklist

- [ ] Legal/TOS registry completed and approved.
- [ ] Privacy policy + terms published (EN/FR).
- [ ] Monitoring and alerts configured.
- [ ] Accuracy benchmark report generated.
- [ ] Incident response drills executed.
- [ ] Pilot partners onboarded.
- [ ] SEO indexability and hreflang validated.

---

## 25) Post-Launch 30/60/90 Plan

### Day 30 (Phase 2)
- Stabilize ingestion/parsers, reduce discrepancy rate.
- **SEO:** Expand to Province/Region coverage pages.

### Day 60 (Phase 3)
- Improve confidence calibration and plan freshness SLA.
- **SEO:** Enable FSA-level sitemaps (careful ramp-up).

### Day 90 (Phase 4)
- **SEO:** Full long-tail address page drip-feed via dynamic rendering.
- Publish benchmark trust report for differentiation.

---

## 26) Autonomous Agent Output Contracts (Machine-Readable)

Each agent must emit:
- `artifact_manifest.json` (files, checksums, versions)
- `decision_log.json` (key decisions + rationale)
- `qa_report.json` (test pass/fail + metrics)
- `risk_report.json` (new/changed risks)
- `handoff.json` (next-agent instructions)

Deployment gate requires all JSON artifacts valid against schema.

---

## 27) Final Acceptance Gate for Fully Autonomous Build

Website is considered autonomously build-complete when:
1. PRD sections implemented and traceable to backlog.
2. CI/CD fully automated with policy checks.
3. Product serves real lookups with confidence/provenance.
4. Monitoring confirms SLO conformance for 7 consecutive days.
5. No human intervention needed for normal ingestion, serving, and alerting operations.

---

## Appendix A — PHH Dictionary Interpretation Rules

1. Boolean values are strict 0/1.
2. Enum domain is fixed and bilingual labels map to canonical code values.
3. `50_10` means threshold reached, not hard cap.
4. Empty enum means unknown/not established at threshold taxonomy.
5. PHH entries represent representative points; address-level inference must communicate uncertainty.

## Appendix B — Required API Keys and Secrets

### Required for local development
| Key | Purpose | How to get | Cost |
|---|---|---|---|
| None required | Mock geocoder + mock data fallback = full local dev with zero API keys or databases | — | Free |
| `DATABASE_URL` (optional) | Local PostGIS for pre-compute pipeline only | Docker compose auto-generates | Free |

### Required for production deployment
| Key | Env var | Purpose | How to get | Cost |
|---|---|---|---|---|
| Cloudflare API Token | `CLOUDFLARE_API_TOKEN` | Pages/Workers deployment, R2, KV, D1 | Cloudflare dashboard → API Tokens | Free tier available |
| Cloudflare Account ID | `CLOUDFLARE_ACCOUNT_ID` | Resource scoping | Cloudflare dashboard | Free |
| Google Places API Key | `GOOGLE_PLACES_API_KEY` | Address autocomplete + geocoding | Google Cloud Console → APIs & Services | $200/mo free credit, then ~$17/1K sessions |
| R2 bucket | `DATA_BUCKET` | Pre-computed cell, ISP, and plan data | `wrangler r2 bucket create` | 10GB free |
| KV namespace | `LOOKUP_CACHE` | Edge caching for R2 data | `wrangler kv namespace create` | Free tier available |
| D1 database | `DISCREPANCY_DB` | Discrepancy report storage | `wrangler d1 create` | Free tier (5GB) |

**No Postgres/PostGIS in production.** The deployed application has zero database dependencies for read operations. PostGIS is only used locally for the quarterly pre-compute pipeline.

### Required for pre-compute pipeline (local only)
| Key | Env var | Purpose | How to get | Cost |
|---|---|---|---|---|
| PostGIS connection | `DATABASE_URL` | Source data for pre-computation | Docker compose | Free |
| R2 credentials | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Upload pre-computed data | Cloudflare dashboard → R2 API Tokens | Free |

### Optional / Phase 2+
| Key | Env var | Purpose | When needed |
|---|---|---|---|
| Resend API Key | `RESEND_API_KEY` | Magic link auth + alert emails | Section 5.3 (accounts/alerts) |
| ISP affiliate keys | `AFFILIATE_*` | Structured plan feeds | Section 8.5 Tier 3 |
| Sentry DSN | `SENTRY_DSN` | Error tracking | Production launch |

### Environment file template
The project includes `.env.example` with all variables. For local dev, no configuration is needed — the app runs with mock data. Copy `.env.example` to `.env.local` and fill production values when deploying.

## Appendix C — Governance Policy

- Ranking transparency policy (objective sort + clearly labeled sponsored content).
- Correction policy SLA for discrepancy submissions.
- Data retention windows by data class.
- Quarterly compliance and source-rights audits.