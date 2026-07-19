---
title: "Phase 1: Core Data Infrastructure"
description: "Establishing the unshakeable foundation for data storage and taxonomy."
status: completed
priority: P1
effort: 1 week
tags: [phase1, infrastructure, supabase, schema]
created: 2026-02-05
---

# Phase 1: Core Data Infrastructure (始計 - Initial Calculations)

**Goal:** Design a robust database schema that normalizes disparate affiliate networks (ClickBank, ShareASale, Amazon) into a unified "Sophia Index".

**Context:**
- **Binh-Pháp Principle:** "The general who wins a battle makes many calculations in his temple ere the battle is fought."
- **Focus:** Schema Design, Taxonomy, Supabase Configuration.

## Key Insights (from Research)
- **Unified Taxonomy:** We need a "Rosetta Stone" to map `Health & Fitness` (ClickBank) and `Supplements` (ShareASale) to a single internal ID.
- **SPS Readiness:** Schema must store raw metrics (Gravity, EPC) AND calculated scores (SPS).
- **Hybrid Storage:** Store persistent data in Postgres, transient search data in high-performance index if needed (Postgres FTS is sufficient for MVP).

## Requirements

### Functional
1.  **Unified Product Table:** Store products from any source with normalized fields.
2.  **Source Tracking:** Track origin (CB, SAS, AMZ) and raw external IDs.
3.  **History Tracking:** Store daily snapshots of key metrics (Gravity/Rank) to calculate velocity.

### Non-Functional
1.  **Type Safety:** 100% generated TypeScript types from Supabase.
2.  **Performance:** Indexes on `sps_score`, `category_id`, and `updated_at`.

## Architecture: Schema Design

```sql
-- Core Product Table
table products (
  id uuid primary key default gen_random_uuid(),
  external_id text, -- e.g., 'PROD123'
  network_id text, -- 'clickbank', 'shareasale'
  title text,
  description text,
  affiliate_link text,
  thumbnail_url text,

  -- Metrics (Normalized)
  price_usd decimal,
  commission_rate decimal, -- 0.75 = 75%
  avg_earnings_usd decimal, -- Normalized Commission

  -- Raw Data (JSONB for flexibility)
  raw_metrics jsonb, -- { "gravity": 45.2, "epc": 12.5 }

  -- Intelligence
  sps_score decimal, -- 0-100 Sophia Potential Score
  is_hidden_gem boolean,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Metric History (For Velocity Calculation)
table metric_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  recorded_at timestamptz default now(),
  metric_type text, -- 'gravity', 'rank', 'epc'
  value decimal
);
```

## Implementation Steps

1.  **Supabase Setup:**
    - Initialize new migration.
    - Create `products`, `metric_history`, `categories` tables.
    - Enable RLS (Public Read-only, Admin Write).

2.  **Taxonomy Map:**
    - Create `categories` table (id, name, slug, parent_id).
    - Seed with "Top 10" profitable niches (Health, Wealth, Relationships, Tech, etc.).

3.  **Type Generation:**
    - Configure `supabase gen types` pipeline.
    - Create Zod schemas for runtime validation.

## Resource Allocation
- **Backend (80%):** Schema SQL, Types, RLS policies.
- **Frontend (20%):** Mock data generation for UI testing.

## Victory Metrics
- **Schema Validation:** 0 schema changes required during Ingestion Phase.
- **Type Safety:** 100% strong typing for all DB operations.

## Risk Assessment
- **Risk:** "JSONB Lazy Loading" (dumping everything in JSONB).
- **Mitigation:** Extract critical query fields (SPS, Price) to top-level columns for indexing.
