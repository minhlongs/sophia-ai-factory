---
title: "Phase 01 — Affiliate Data Engine"
description: "Scrape global SaaS affiliate directories, score programs by profitability, store in Supabase"
status: completed
priority: P1
effort: 4h
---

# Phase 01 — Affiliate Data Engine

**Goal:** Populate `affiliate_programs` table with scored, ranked programs ready for content generation.

## Context Links

- Migration pattern: `lib/supabase/migrations/008_referral_tables.sql`
- Existing affiliate data: `lib/affiliate/partner-links.ts`
- MCU billing: `lib/billing/mcu-pricing.ts`

## Key Insights

- PartnerStack and Impact have unofficial JSON APIs (reverse-engineered from their public directory pages)
- ShareASale requires scraping HTML — rate limit to 1 req/2s
- Score formula: `score = (commission_rate * 40) + (min(cookie_days, 90) / 90 * 30) + (reliability_score * 30)`
- Reliability derived from: payout_threshold < $100 = high, $100-500 = medium, >$500 = low
- Seed with existing PARTNER_LINKS data (HeyGen 30%, HubSpot 20%, Apollo 20%) to bootstrap

## Architecture

```
Cron trigger (daily)
  └─ program-scraper.ts
       ├─ fetchPartnerStack() → 200 programs
       ├─ fetchCJAffiliate()  → 150 programs
       └─ fetchManualList()   → PARTNER_LINKS seed
  └─ program-scorer.ts
       └─ scoreProgram(p) → 0–100
  └─ upsert → affiliate_programs (conflict on name+source)
```

## Related Code Files

**Create:**
- `lib/supabase/migrations/009_affiliate_engine.sql`
- `lib/affiliate/scraper/program-scraper.ts`
- `lib/affiliate/scraper/program-scorer.ts`
- `app/api/affiliate/scrape/route.ts`
- `app/api/affiliate/programs/route.ts`

**Modify:**
- `lib/billing/mcu-pricing.ts` — add `'affiliate:scrape': 5`

## Implementation Steps

1. **Write migration 009** — create all 4 tables with RLS + indexes
   - `affiliate_programs`, `affiliate_content`, `affiliate_clicks`, `affiliate_revenue`
   - RLS: programs are public read, content/clicks/revenue scoped to `org_id`

2. **Implement `program-scraper.ts`**
   - `scrapePartnerStack(): Promise<RawProgram[]>` — fetch `https://partnerstack.com/api/companies`
   - `scrapeManualSeed(): RawProgram[]` — map PARTNER_LINKS to RawProgram shape
   - Normalize to common `RawProgram` interface before scoring

3. **Implement `program-scorer.ts`**
   - `scoreProgram(p: RawProgram): number` — pure function, returns 0–100
   - Weights: commission 40%, cookie duration 30%, payout reliability 30%
   - Export `TOP_PROGRAMS_THRESHOLD = 60` constant

4. **API route `POST /api/affiliate/scrape`**
   - Auth: require org session + deduct 5 MCU via `usage-tracker.ts`
   - Trigger scrape → score → upsert pipeline
   - Return `{ inserted: N, updated: N, top_programs: Program[] }`

5. **API route `GET /api/affiliate/programs`**
   - Query params: `?niche=saas&min_score=60&limit=20`
   - Returns paginated, scored program list
   - Public read (no auth needed — used for program discovery UI)

## TODO Checklist

- [x] Write `009_affiliate_engine.sql` migration (4 tables + RLS)
- [x] Implement `program-scraper.ts` with PartnerStack + manual seed
- [x] Implement `program-scorer.ts` with weighted scoring
- [x] Add MCU cost `'affiliate:scrape': 5` to `mcu-pricing.ts`
- [x] Build `POST /api/affiliate/programs/scrape` route with MCU deduction
- [x] Build `GET /api/affiliate/programs` route with filters
- [x] Seed database with 31 programs (HeyGen, HubSpot, Apollo, Notion, Canva + 26 more)
- [x] Create `GET /api/affiliate/programs/[id]` route
- [x] Create `types/affiliate.ts` with all interfaces
- [ ] Test: verify top 10 programs score > 60 (requires DB)

## Success Criteria

- `affiliate_programs` table has >= 50 scored programs after first scrape
- Score distribution: >= 20% of programs score above 60 (actionable)
- API returns programs in < 200ms (indexed query)
- MCU deducted correctly on scrape trigger

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| PartnerStack API changes | Wrap in try/catch, fallback to manual seed |
| Rate limiting from directories | 1 req/2s delay, exponential backoff |
| Stale scores | Re-score on every scrape, update `last_scraped_at` |

## Next Steps

- Phase 02 consumes `affiliate_programs.score >= 60` for content generation
- Future: add CF Workers cron job for daily auto-scrape without user trigger
