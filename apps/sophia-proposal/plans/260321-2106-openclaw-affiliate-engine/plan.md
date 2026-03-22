---
title: "OpenClaw Affiliate SaaS Engine"
description: "AI-powered affiliate marketing machine: scrape programs → score → generate content → publish → track revenue"
status: pending
priority: P1
effort: 12h
branch: master
tags: [affiliate, heygen, scraping, content-gen, mcu]
created: 2026-03-21
---

# OpenClaw Affiliate SaaS Engine

AI pipeline: scrape global SaaS affiliate programs → score profitability → auto-generate HeyGen videos + blog posts → publish → track commissions. Users pay MCU credits to run the engine.

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Affiliate Data Engine](./phase-01-affiliate-data-engine.md) | pending | 4h |
| 2 | [AI Content Pipeline](./phase-02-ai-content-pipeline.md) | pending | 5h |
| 3 | Publishing & Distribution | pending | 2h |
| 4 | Analytics & Monetization | pending | 1h |

## DB Schema (migration 009)

```sql
-- affiliate_programs: scraped program catalog
create table affiliate_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,                  -- 'partnerstack' | 'impact' | 'sharesale' | 'cj' | 'manual'
  signup_url text not null,
  commission_rate numeric not null,      -- 0.0–1.0
  commission_type text not null,         -- 'recurring' | 'one_time' | 'tiered'
  cookie_days integer,
  payout_threshold numeric,
  niche text not null,                   -- 'saas' | 'marketing' | 'dev-tools' | etc.
  score numeric not null default 0,      -- composite: rate × cookie × reliability
  last_scraped_at timestamptz,
  is_active boolean default true,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- affiliate_content: generated blogs, videos, social posts
create table affiliate_content (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  program_id uuid not null references affiliate_programs(id),
  content_type text not null,            -- 'blog' | 'video' | 'social'
  title text not null,
  body text,
  heygen_video_id text,                  -- for video type
  publish_url text,
  status text not null default 'draft',  -- 'draft' | 'generating' | 'published' | 'failed'
  mcu_cost integer not null,
  created_at timestamptz default now()
);

-- affiliate_clicks: UTM click tracking per content
create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references affiliate_content(id),
  program_id uuid not null references affiliate_programs(id),
  org_id uuid not null references organizations(id),
  utm_source text,
  utm_medium text,
  referrer text,
  ip_hash text,
  clicked_at timestamptz default now()
);

-- affiliate_revenue: commission revenue per org per program
create table affiliate_revenue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  program_id uuid not null references affiliate_programs(id),
  amount_usd numeric not null,
  platform_fee_usd numeric not null,    -- 5% of amount
  net_usd numeric not null,
  status text not null default 'pending', -- 'pending' | 'confirmed' | 'paid'
  period date not null,
  created_at timestamptz default now()
);
```

## MCU Pricing Table

| Action | MCU Cost |
|--------|----------|
| Scrape + score 100 programs | 5 |
| Generate blog post (AI) | 50 |
| Generate video review (HeyGen) | 200 |
| Generate social post bundle | 10 |
| Run full program analysis | 20 |

## API Routes

```
POST /api/affiliate/scrape          → trigger scrape job
GET  /api/affiliate/programs        → list scored programs
POST /api/affiliate/content/generate → generate content for a program
GET  /api/affiliate/content         → list user's content
POST /api/affiliate/clicks/track    → record click event
GET  /api/affiliate/revenue         → revenue dashboard data
```

## Files to Create

```
lib/supabase/migrations/009_affiliate_engine.sql
lib/affiliate/scraper/program-scraper.ts        ← fetch + parse directories
lib/affiliate/scraper/program-scorer.ts          ← scoring algorithm
lib/affiliate/content/blog-generator.ts          ← AI blog post
lib/affiliate/content/video-generator.ts         ← HeyGen integration
lib/affiliate/content/social-generator.ts        ← social post copy
app/api/affiliate/scrape/route.ts
app/api/affiliate/programs/route.ts
app/api/affiliate/content/generate/route.ts
app/api/affiliate/clicks/track/route.ts
app/api/affiliate/revenue/route.ts
```

## Files to Modify

```
lib/affiliate/partner-links.ts     → extend PartnerLink with program_id FK
lib/billing/mcu-pricing.ts         → add affiliate MCU_COSTS entries
```

## Key Dependencies

- Phase 1 → Phase 2 (need `affiliate_programs` populated before content gen)
- HeyGen API key (`HEYGEN_API_KEY`) must be set for video generation
- Supabase service role key for click tracking (public inserts)
- OpenAI/Anthropic key for blog + social copy generation

## Unresolved Questions

- Which affiliate directories expose public APIs vs. require HTML scraping?
- Rate limiting strategy for scraping (CF Workers cron vs. Next.js cron handler)?
- Where does user publish blog? Need CMS integration target (Ghost, WordPress, custom subdomain)?
- YouTube upload API requires OAuth per user — out of Phase 2 scope?
