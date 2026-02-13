# CLAUDE.md — ISP-by-Address Canada

## What is this project?
A bilingual (EN/FR) web platform that answers: "What internet options are available at this exact Canadian address?" Built on ISED National Broadband Data (PHH points) with ~16.6M rows of availability data covering every pseudo-household in Canada.

## Skills
- **Frontend Design** (`.claude/skills/front-end-design/SKILL.md`): Use this skill when building any UI component, page, or layout. All frontend work must follow its guidelines — distinctive typography, bold aesthetic direction, no generic AI aesthetics. This is a Canadian consumer product competing for trust; it must look like a real product, not a template.

## Tech stack (locked decisions)
- **Frontend:** Astro 5 + React 19 (islands architecture). No other frameworks.
- **Styling:** Tailwind CSS 4. No component libraries unless explicitly approved.
- **API:** Astro server endpoints in `src/pages/api/v1/`. These deploy as Cloudflare Pages Functions.
- **Data layer (reads):** Pre-computed JSON files on Cloudflare R2 + KV edge cache. No runtime database for reads.
- **Data layer (writes):** Cloudflare D1 (free SQLite) for discrepancy reports only.
- **Pre-compute pipeline:** Local PostGIS (Docker) generates static geohash cell files quarterly. Not deployed.
- **Spatial matching:** Pure TypeScript geohash encoding + haversine distance (replaces PostGIS ST_DWithin).
- **Object storage:** Cloudflare R2 for pre-computed cell/ISP/plan data.
- **Cache:** Cloudflare KV for edge caching R2 data (cells: 1h, ISPs: 6h, plans: 24h TTL).
- **Geocoding:** Mock geocoder for dev (`GEOCODE_PROVIDER=mock`), Google Places API (New) for production.
- **Language:** TypeScript everywhere. Strict mode. No `any` types.
- **Package manager:** npm (not yarn, not pnpm, not bun).
- **Testing:** Vitest for unit/integration, Playwright for e2e.
- **Deployment target:** Cloudflare Pages via `@astrojs/cloudflare` adapter.

## Project structure
```
thinkingbox/
├── PRD.md                    # Source of truth for product requirements
├── CLAUDE.md                 # This file — build conventions
├── app/                      # Astro application
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   ├── .env.example          # All env vars documented here
│   ├── public/               # Static assets
│   └── src/
│       ├── components/
│       │   ├── lookup/       # Address autocomplete, lookup form
│       │   ├── results/      # Result cards, comparison, filters
│       │   ├── common/       # Header, footer, locale switcher, nav
│       │   └── ui/           # Buttons, badges, inputs, cards (generic)
│       ├── layouts/          # BaseLayout.astro, SEOLayout.astro
│       ├── pages/
│       │   ├── index.astro
│       │   ├── lookup.astro
│       │   ├── pricing.astro
│       │   ├── partners.astro
│       │   ├── api-docs.astro
│       │   ├── result/[id].astro
│       │   ├── compare/[city].astro
│       │   ├── coverage/[region].astro
│       │   ├── blog/
│       │   ├── account/
│       │   ├── admin/
│       │   ├── fr/           # French equivalents mirror EN structure
│       │   └── api/v1/       # Server endpoints (Cloudflare Workers)
│       │       ├── lookup.ts
│       │       ├── address/[id]/availability.ts
│       │       ├── address/[id]/plans.ts
│       │       ├── changes.ts
│       │       ├── discrepancy.ts
│       │       └── health.ts
│       ├── lib/
│       │   ├── data/         # R2/KV client, PHH matcher, D1 client, types
│       │   ├── geo/          # Geocoding (mock + Google), geohash, haversine
│       │   ├── confidence/   # Confidence scoring algorithm
│       │   ├── plans/        # Plan resolution, availability derivation
│       │   └── api/          # Shared API utilities, error envelope, mock lookup
│       ├── i18n/             # en.json, fr.json — all UI strings
│       ├── styles/           # Global styles, Tailwind config
│       └── types/            # Shared TypeScript types
├── app/tests/
│   ├── unit/                 # Vitest unit tests
│   ├── integration/          # Vitest integration tests (needs DB)
│   ├── e2e/                  # Playwright browser tests
│   └── fixtures/             # Test data snapshots
├── scripts/
│   ├── precompute/           # Pre-compute pipeline (cells, ISPs, plans, upload)
│   ├── migrate/              # PostGIS migrations (for pre-compute pipeline)
│   ├── migrate-d1/           # D1 (SQLite) migrations for write operations
│   ├── ingest/               # Scripts to load CSVs into PostGIS
│   └── seed/                 # Seed scripts for mock/test data
├── docker/
│   └── docker-compose.yml    # PostGIS + optional Redis
├── mock/
│   ├── provider_plans.json   # ~20 mock plans for dev
│   └── test_addresses.json   # 20 test addresses across Canada
├── evals/
│   ├── data-quality/         # Domain validation, join integrity
│   ├── lookup-accuracy/      # Golden set address tests
│   ├── api-contracts/        # OpenAPI schema validation
│   └── ui-parity/            # EN/FR parity, accessibility
└── [data folders]            # Gitignored — raw CSVs from ISED/StatCan
```

## Data architecture — the core mental model

### The lookup chain (this is the whole product)
```
User types address
  → Geocode to lat/lng (mock or Google Places API)
  → Compute geohash_6 in JS (~1.2km cell)
  → Fetch 9 cells from R2/KV (center + 8 neighbors, parallel)
  → Haversine distance to all PHH points in cells (in-memory)
  → Nearest PHH has embedded coverage data + hexuid
  → Fetch ISP list from R2/KV by hexuid
  → Filter plans from cached plans.json
  → CSD from pre-computed cell metadata
  → Compute confidence score
  → Return result
```

### Pre-compute pipeline (runs locally with PostGIS, once per quarterly data refresh)
```
PostGIS data → geohash partitioning → cells/{hash}.json (~150K files)
             → ISP grouping by hex → isps/{hexuid}.json (~74K files)
             → plan bundling → plans.json (1 file)
             → Upload to Cloudflare R2
```

### Key data files (already downloaded, gitignored)
- `NBD_PHH_Speeds/PHH_Speeds_Current-PHH_Vitesses_Actuelles_*.csv` — 16.6M rows, speed thresholds
- `PHH_ID_2021/PHH_2021_CSV/PHH-*.csv` — coordinates for each PHH_ID
- `Map_Data_CSV/ISP_Hex_FSI.csv` — 426K rows, ISP name + technology per hex
- `Map_Data_CSV/Data_Hex_Données.csv` — hex demographics
- `Map_Data_CSV/Data_Com_Points_Col_Données.csv` — bilingual community placenames
- Census Subdivision boundaries — municipality polygons (GeoPackage or SHP)

### PHH field reference
- 15 boolean flags: `Combined_lt5_1`, `Wired_lt5_1`, `Wireless_lt5_1`, ... through `_50_10` (0/1 only)
- 4 enum thresholds: `Combined_Max_Threshold`, `Wired_Max_Threshold`, `Wireless_Max_Threshold`, `Satellite_Max_Threshold`
- Enum domain: `"" | "<5_1" | "5_1" | "10_2" | "25_5" | "50_10"`
- `Avail_LTE_Mobile_Dispo` (boolean)
- `50_10` means "at least 50/10" — it does NOT mean capped at 50/10

### Confidence scoring formula
- 40% — spatial match quality (distance from geocoded address to nearest PHH)
- 30% — postal/municipality concordance (address falls within expected CSD polygon)
- 20% — source freshness (age of PHH coverage snapshot)
- 10% — discrepancy history (prior user corrections for this PHH/hex)

## Coding conventions

### General
- TypeScript strict mode. No `any`. Use explicit types.
- Prefer `const` over `let`. Never use `var`.
- Use named exports, not default exports.
- Functions: use descriptive verb-noun names (`findNearestPHH`, `computeConfidence`, `resolveISPPlans`).
- Keep files under 300 lines. Split when approaching that.
- No barrel exports (index.ts re-exporting everything). Import directly from the file.

### Astro pages
- `.astro` files for pages and layouts. Minimal JS in frontmatter.
- Interactive components are React `.tsx` islands with `client:load` or `client:visible`.
- Static/content pages remain pure Astro (zero JS shipped to client).

### API endpoints
- All API routes return JSON with standard envelope: `{ data, error, meta }`.
- Error shape: `{ error: { code: string, message: string, details?: unknown } }`.
- Use Zod for request validation at API boundaries.
- Every endpoint logs with a correlation ID.

### Data layer
- All data reads go through `src/lib/data/r2-client.ts` (DataClient interface).
- Production: KV-first with R2 fallback. Dev: local filesystem or mock data.
- Write operations (discrepancy reports) use D1 via `src/lib/data/d1-client.ts`.
- Spatial matching uses `src/lib/data/phh-matcher.ts` (haversine distance, not PostGIS).
- PostGIS is only used in `scripts/precompute/` for the quarterly pre-compute pipeline.
- Migration files: `scripts/migrate/` for PostGIS, `scripts/migrate-d1/` for D1.

### i18n
- All user-facing strings live in `src/i18n/en.json` and `src/i18n/fr.json`.
- Never hardcode English (or French) strings in components.
- Key naming: `section.subsection.element` (e.g., `lookup.form.placeholder`, `results.card.confidence`).
- Speed tier labels map: `"50_10"` → EN: "50/10 Mbps+" / FR: "50/10 Mbit/s+".

### Testing
- Unit tests: file named `*.test.ts` next to the source file OR in `tests/unit/`.
- Integration tests (needing DB): in `tests/integration/`. These run against Docker PostGIS.
- E2E tests: in `tests/e2e/`. Use Playwright.
- Test command: `npm test` (unit), `npm run test:integration`, `npm run test:e2e`.
- Eval scripts: in `evals/`. These are standalone validation scripts, not part of the test suite.

## Mock data rules
- When `MOCK_PLANS=true` (default in dev), load plans from `mock/provider_plans.json`.
- When `GEOCODE_PROVIDER=mock` (default in dev), use `mock/test_addresses.json` for deterministic geocoding.
- PHH data, hex ISP data, and boundary data are REAL open data — always use real files, never mock these.
- Mock plans display a "Sample Data" badge in the UI. This badge must not appear in production.
- Mock plans have `"source": "mock"`. The eval framework checks that zero mock-sourced plans exist in production.

## Provider plan display rules
- If an ISP is detected at a location but has no plan data: show the provider card with name + technology + **"Pricing Coming Soon"** label. Never hide a known-available provider.
- If plan data exists but is stale (`stale_flag = true`): show plans with **"Pricing may have changed — last verified {date}"** badge.
- Never show a "best plan" recommendation if confidence score < 60 (configurable threshold).

## What NOT to do
- Do NOT scrape ISP websites. Plan data is manually curated or from affiliate feeds.
- Do NOT add PostGIS or any runtime database dependency. The deployed app is database-free for reads.
- Do NOT install component libraries (Material UI, Chakra, shadcn, etc.) without explicit approval.
- Do NOT commit data CSV files to git. They are gitignored and loaded via ingestion scripts.
- Do NOT commit `.env.local` or any file with real API keys.
- Do NOT use `ST_Distance` for nearest-neighbor queries. Use `ST_DWithin` to leverage spatial indexes.
- Do NOT present "no service available" as a definitive statement. Always frame as "unknown or unserved" with an uncertainty disclaimer.
- Do NOT suppress satellite availability. Always show `Satellite_Max_Threshold` as a fallback option.

## Local development quickstart
```bash
# 1. Install and start (no database needed!)
cd app && npm install && npm run dev
# App runs at http://localhost:4321
# API routes at http://localhost:4321/api/v1/*
# Uses mock geocoder + mock province profiles when no pre-computed data exists
```

### Pre-compute pipeline (quarterly, requires PostGIS)
```bash
# 1. Start PostGIS
cd docker && docker compose up db -d

# 2. Run migrations + ingest data
psql $DATABASE_URL -f scripts/migrate/001-initial-schema.sql
cd app && npm run db:ingest:phh && npm run db:ingest:speeds && npm run db:ingest:hex && npm run db:ingest:boundaries

# 3. Seed plans + pre-compute
npm run db:seed:plans && npm run precompute

# 4. Upload to R2 (production)
npm run precompute:upload
```

## Build order (milestone sequence)
1. **Pre-compute pipeline** — geohash cells, ISP files, plans bundle from PostGIS
2. **Core lookup logic** — geocode → geohash → fetch cells → haversine match → availability → ISP resolution
3. **Confidence scoring** — spatial + concordance + freshness + discrepancy
4. **API endpoints** — /v1/lookup, /v1/address/{id}/availability, /v1/health
5. **Frontend: lookup page** — address form, autocomplete, submit
6. **Frontend: result page** — availability card, provider cards, confidence, provenance
7. **i18n** — EN/FR string extraction and routing
8. **Mock plan display** — "Pricing Coming Soon" cards
9. **Evals** — data quality, lookup accuracy golden set, API contracts
10. **SEO pages** — programmatic city/region templates
11. **Accounts + alerts** — auth, saved addresses, watch alerts (Phase 2)
12. **Partner/admin** — dashboard, API keys, admin console (Phase 2)

## Accessibility requirements
- WCAG 2.2 AA compliance on all pages.
- Every interactive element keyboard-navigable.
- All images have alt text. All form inputs have labels.
- Color contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text.
- Screen reader: confidence scores announced as "Confidence: 85 out of 100".
- Language attribute: `<html lang="en">` / `<html lang="fr">` set correctly per page.
