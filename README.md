# ISP by Address Canada

A bilingual (EN/FR) web platform that answers: **"What internet options are available at this exact Canadian address?"**

Built on ISED National Broadband Data with ~16.6M pseudo-household data points covering every address in Canada.

**Live site:** [ispbyaddress.ca](https://ispbyaddress.ca)

## Tech Stack

- **Frontend:** Astro 5 + React 19 (islands architecture)
- **Styling:** Tailwind CSS 4
- **Data layer:** Pre-computed geohash cells on Cloudflare R2 + KV edge cache
- **Writes:** Cloudflare D1 (SQLite) for discrepancy reports
- **Deployment:** Cloudflare Pages
- **Geocoding:** Google Places API (New)
- **Language:** TypeScript (strict mode)

## Architecture

The underlying ISED broadband data only updates **quarterly**. Instead of running a Postgres + PostGIS database ($69/mo) for runtime spatial queries, all lookups are pre-computed at build time:

```
User address → Geocode → lat/lng
  → Compute geohash_6 (~1.2km cell)
  → Fetch 9 cells from R2/KV (center + 8 neighbors)
  → Haversine distance to all PHH points in cells
  → Nearest PHH has embedded coverage + hexuid
  → Fetch ISP list from R2/KV by hexuid
  → Filter plans from cached plans.json
  → Compute confidence → Return result
```

**Result:** ~$0/mo infrastructure (within Cloudflare free tiers), ~200ms p50 latency for cached lookups.

### Pre-compute pipeline

PostGIS is used **locally** as a one-time build step per quarterly data refresh:

1. `npm run precompute:cells` — Groups 16.6M PHH points into ~150K geohash cell files
2. `npm run precompute:isps` — Groups ISP coverage by hexuid (~74K files)
3. `npm run precompute:plans` — Bundles all provider plans into a single JSON file
4. `npm run precompute:upload` — Uploads to Cloudflare R2

## Prerequisites

- Node.js 18+
- npm
- Docker (only needed for pre-compute pipeline, not for dev server)

## Local Development

```bash
# 1. Install dependencies
cd app && npm install

# 2. Copy environment config
cp .env.example .env.local

# 3. Start dev server
npm run dev
# App runs at http://localhost:4321
```

The dev server runs without any database or cloud services. When R2/KV bindings are unavailable, it falls back to:
- **Local filesystem** for pre-computed data (if `data/precomputed/` exists)
- **Mock provider profiles** by province (if no data at all)
- **Mock geocoder** for deterministic test addresses

### Pre-compute pipeline (quarterly refresh)

```bash
# 1. Start PostGIS
cd docker && docker compose up db -d

# 2. Run database migrations
psql $DATABASE_URL -f scripts/migrate/001-initial-schema.sql

# 3. Ingest data (~10-15 min for full national dataset)
cd app
npm run db:ingest:phh
npm run db:ingest:speeds
npm run db:ingest:hex
npm run db:ingest:boundaries

# 4. Seed mock plans
npm run db:seed:plans

# 5. Pre-compute cell/ISP/plan files
npm run precompute

# 6. Upload to R2
npm run precompute:upload
```

## Environment Variables

See `app/.env.example` for all available configuration. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GEOCODE_PROVIDER` | `mock` or `google` | `mock` |
| `GOOGLE_PLACES_API_KEY` | Google Places API key | — |
| `MOCK_PLANS` | Use mock plan data | `true` |
| `PRECOMPUTED_DATA_PATH` | Local path to pre-computed data | `data/precomputed` |

### Cloudflare bindings (production)

| Binding | Type | Purpose |
|---------|------|---------|
| `DATA_BUCKET` | R2 | Pre-computed cell, ISP, and plan data |
| `LOOKUP_CACHE` | KV | Edge cache for hot lookup results |
| `DISCREPANCY_DB` | D1 | Discrepancy report storage |

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build
npm run check            # Astro type checking
npm run lint             # TypeScript type checking
npm test                 # Run unit tests (Vitest)
npm run test:e2e         # Run e2e tests (Playwright)
npm run precompute       # Pre-compute all data files (requires PostGIS)
npm run precompute:upload # Upload pre-computed data to R2
npm run d1:migrate       # Run D1 migrations
```

## Data Sources

- **ISED National Broadband Data** — 16.6M pseudo-household coverage points (open data)
- **Hex ISP Coverage** — ISP presence per hexagonal grid cell
- **Census Subdivisions** — Municipality boundary polygons

Raw data CSV files are gitignored and loaded via ingestion scripts in `scripts/ingest/`. Pre-computed output files live in `data/precomputed/` (also gitignored).

## Project Structure

```
thinkingbox/
├── app/                      # Astro application
│   ├── src/
│   │   ├── components/       # UI components (React islands + Astro)
│   │   ├── layouts/          # Page layouts
│   │   ├── pages/            # Routes (EN at root, FR under /fr/)
│   │   │   └── api/v1/       # Server endpoints (Cloudflare Workers)
│   │   ├── lib/
│   │   │   ├── data/         # R2/KV client, PHH matcher, D1 client
│   │   │   ├── geo/          # Geocoding, geohash, haversine
│   │   │   ├── confidence/   # Confidence scoring algorithm
│   │   │   ├── plans/        # Plan resolution, availability derivation
│   │   │   └── api/          # Shared API utilities, mock lookup
│   │   ├── i18n/             # en.json, fr.json
│   │   └── types/            # Shared TypeScript types
│   └── tests/                # Unit, integration, and e2e tests
├── scripts/
│   ├── precompute/           # Pre-compute pipeline (cells, ISPs, plans, upload)
│   ├── migrate/              # PostGIS migrations (for pre-compute only)
│   ├── migrate-d1/           # D1 (SQLite) migrations
│   ├── ingest/               # CSV → PostGIS ingestion (for pre-compute)
│   └── seed/                 # Mock data seeding
├── docker/                   # Docker Compose for local PostGIS
├── mock/                     # Mock data for development
└── evals/                    # Data quality and accuracy validation
```

## Next-Level Plan

See [NEXT_LEVEL_ROADMAP.md](./NEXT_LEVEL_ROADMAP.md) for a prioritized execution plan focused on trust, schema markup coverage, ISP reviews, stronger “X vs X” comparison pages, reliability, and UX speed perception.

## License

All rights reserved. Broadband data is used under the [Open Government Licence — Canada](https://open.canada.ca/en/open-government-licence-canada).
