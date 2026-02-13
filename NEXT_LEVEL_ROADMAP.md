# Next-Level Roadmap (Product-First)

This version reflects current priorities: **no API work for now**, stronger page quality, and features that directly improve consumer trust.

## Priority decisions applied

1. **No API scope right now** (defer partner/API work).
2. **Review schema markup for every page** (SEO + trust).
3. **Add a review system for each ISP** (social proof + quality signal).
4. Include additional high-impact improvements under “What else?”.

## P0 — Immediate priorities (next 2-4 weeks)

## 1) Trust & explainability in lookup results

**Deliverables**
- Add confidence explanation UI (distance, freshness, boundary match, discrepancy history).
- Add low-confidence messaging and uncertainty language.
- Display last data refresh date in results.

**Success metrics**
- Lower confusion in support/discrepancy submissions.
- Better completion rate after results page load.

## 2) Schema markup audit for every page

**Deliverables**
- Inventory all public pages (EN + FR) and map expected schema type per page.
- Validate and standardize JSON-LD implementation for key page classes:
  - Home: `WebSite` / `Organization`
  - Lookup/result pages: `Service` (+ where relevant `FAQPage`)
  - ISP profile pages (when present): `LocalBusiness` or `Service`
  - Blog/content pages: `Article` / `BreadcrumbList`
- Add a release checklist item: schema validation before deploy.

**Success metrics**
- 100% page coverage with valid schema.
- Improved rich-result eligibility and CTR over time.

## 3) Quality gates that protect shipping confidence

**Deliverables**
- CI checks for typecheck, unit tests, and EN/FR parity checks.
- Golden address drift checks for lookup stability.
- Production guardrail to prevent mock plan data leakage.

**Success metrics**
- Every merge has an explicit quality signal.
- Regressions detected pre-release.

## P1 — Product expansion priorities (weeks 4-8)

## 4) ISP review system (per-provider)

**MVP scope**
- Add review summary block on each ISP card/profile:
  - Average rating
  - Number of reviews
  - Recent review highlights
- Allow authenticated/verified submissions with simple dimensions:
  - Speed reliability
  - Price fairness
  - Customer support
  - Installation experience
- Add moderation workflow (flag, hide, resolve).

**Abuse controls**
- Rate limiting and duplicate detection.
- Basic fraud signals (burst patterns, repeated text, suspicious accounts).

**Success metrics**
- Review coverage across top ISPs.
- Increased user confidence/engagement on provider selection.

## 5) Improve perceived speed on lookup flow

**Deliverables**
- Loading skeletons for lookup/result/provider cards.
- Progressive states (address resolved → availability → plans).
- Cache warm strategy for high-volume areas.

**Success metrics**
- Lower abandonment during loading.
- Better perceived responsiveness.

## 6) Data freshness and discrepancy loop

**Deliverables**
- Clear stale-plan indicator and freshness labels.
- Quarterly refresh checklist with owner + deadlines.
- Better discrepancy categorization and triage status tracking.

**Success metrics**
- Faster stale-data resolution.
- Improved confidence calibration over time.


## 7) Rebuild “X vs X ISP” pages (design + depth)

**Problem today**
- Current comparison pages are too shallow and visually weak for a trust-driven consumer decision.

**Design requirements**
- Strong visual hierarchy (clear winner categories, neutral defaults, no dark-pattern emphasis).
- Side-by-side scorecards with consistent spacing/typography and fast mobile scanability.
- Sticky comparison summary (price, speed tiers, rating, contract flexibility, support).

**Content depth requirements**
- Comparison sections must include:
  - Real plan lineup snapshots (entry/mid/premium tiers)
  - Total-cost framing (promo period vs post-promo where available)
  - Technology + availability caveats by region
  - Installation/fees/equipment policy summary
  - Who each ISP is best for (persona-based guidance)
- Include reviewer sentiment synthesis and top pros/cons extracted from verified reviews.

**Ratings & review integration**
- Show per-provider rating modules sourced from the ISP review system:
  - Overall score + review count
  - Subscores: reliability, value, support, install
  - “Confidence in rating” label when review sample size is low
- Show distribution (e.g., 5★ to 1★ bars) and recent review excerpts.

**Quality bar**
- Every “A vs B” page must beat a minimum completeness checklist before publish.
- EN/FR parity on all key comparison blocks.
- Add schema markup on compare pages (`ItemList`, `FAQPage`, `BreadcrumbList` where appropriate).

**Success metrics**
- Increased compare-page dwell time and CTR to provider actions.
- Higher conversion from compare pages to lookup/provider click-through.
- Fewer bounce events on “X vs X” entries.

## What else? (high-impact opportunities)

- **Dedicated ISP profile pages** with transparent pros/cons, technologies, and coverage notes.
- **Compare mode upgrades** (shortlist, side-by-side plan comparisons, save/share).
- **Neighborhood insights** (common technologies, median speeds, confidence map overlays).
- **French parity hardening** (not just translation: locale-specific UX QA each release).
- **A11y audit pass** (keyboard flows, contrast, labels, announcements).
- **Analytics dashboard** for user journey: lookup start → result shown → provider click.
- **Content strategy** around “how to choose internet in [province/city]” tied to lookup entry points.

## Suggested rollout

### Sprint 1-2
- P0 trust/explainability updates.
- Full schema markup inventory + fixes on highest-traffic pages.
- CI quality gates + mock-data production guardrail.

### Sprint 3-4
- Complete schema coverage on all remaining pages.
- ISP review system MVP launch.
- Rebuild top-traffic “X vs X” ISP pages with ratings-integrated scorecards.
- Lookup speed perception improvements.

### Sprint 5+
- Review moderation hardening + anti-abuse improvements.
- Compare/profile feature expansion and ongoing optimization.

## Definition of “next level”

You are at the next level when:
1. Users understand why a result is shown and trust it.
2. Every major page has valid schema markup and release-time validation.
3. Users can evaluate ISPs with credible reviews, not just raw plan data.
4. “X vs X” pages become a best-in-class decision surface, not thin SEO pages.
5. Releases are protected by reliable quality gates.
