# ISP by Address Canada

A bilingual (EN/FR) web platform that answers: **"What internet options are available at this exact Canadian address?"**

Built on ISED National Broadband Data with ~16.6M pseudo-household data points covering every address in Canada.

**Live site:** [ispbyaddress.ca](https://ispbyaddress.ca)

## Tech Stack

- **Frontend:** Astro 5 + React 19 (islands architecture)
- **Styling:** Tailwind CSS 4
- **Database:** Postgres 16 + PostGIS 3.4
- **Deployment:** Cloudflare Pages
- **Geocoding:** Google Places API (New)
- **Language:** TypeScript (strict mode)

## Prerequisites

- Node.js 18+
- Docker (for local PostGIS)
- npm

## Local Development

```bash
# 1. Start PostGIS
cd docker && docker compose up db -d

# 2. Run database migrations
psql $DATABASE_URL -f scripts/migrate/001-initial-schema.sql

# 3. Ingest data (one-time, ~10-15 min for full national dataset)
cd app
npm run db:ingest:phh
npm run db:ingest:speeds
npm run db:ingest:hex
npm run db:ingest:boundaries

# 4. Seed mock plans
npm run db:seed:plans
npm run db:seed:addresses

# 5. Copy environment config
cp .env.example .env.local

# 6. Install dependencies and start dev server
npm install
npm run dev
# App runs at http://localhost:4321
```

## Environment Variables

See `app/.env.example` for all available configuration. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://ispuser:isppass@localhost:5432/ispdb` |
| `GEOCODE_PROVIDER` | `mock` or `google` | `mock` |
| `GOOGLE_PLACES_API_KEY` | Google Places API key | — |
| `MOCK_PLANS` | Use mock plan data | `true` |

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Astro type checking
npm run lint         # TypeScript type checking
npm test             # Run unit tests (Vitest)
npm run test:e2e     # Run e2e tests (Playwright)
```

## Data Sources

- **ISED National Broadband Data** — 16.6M pseudo-household coverage points (open data)
- **Hex ISP Coverage** — ISP presence per hexagonal grid cell
- **Census Subdivisions** — Municipality boundary polygons

Raw data CSV files are gitignored and loaded via ingestion scripts in `scripts/ingest/`.

## Project Structure

```
thinkingbox/
├── app/                  # Astro application
│   ├── src/
│   │   ├── components/   # UI components (React islands + Astro)
│   │   ├── layouts/      # Page layouts
│   │   ├── pages/        # Routes (EN at root, FR under /fr/)
│   │   ├── lib/          # Business logic (db, geo, confidence, plans)
│   │   ├── i18n/         # en.json, fr.json
│   │   └── types/        # Shared TypeScript types
│   └── tests/            # Unit, integration, and e2e tests
├── scripts/              # Database migrations, data ingestion, seeding
├── docker/               # Docker Compose for local PostGIS
├── mock/                 # Mock data for development
└── evals/                # Data quality and accuracy validation
```

## License

All rights reserved. Broadband data is used under the [Open Government Licence — Canada](https://open.canada.ca/en/open-government-licence-canada).
