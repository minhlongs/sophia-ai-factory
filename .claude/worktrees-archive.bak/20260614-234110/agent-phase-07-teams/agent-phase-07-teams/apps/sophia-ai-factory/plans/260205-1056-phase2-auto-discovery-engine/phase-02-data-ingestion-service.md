---
title: "Phase 2: Data Ingestion Service"
description: "Building the adapters to fetch and normalize data from affiliate networks."
status: completed
priority: P1
effort: 1.5 weeks
tags: [phase2, ingestion, adapters, cron]
created: 2026-02-05
---

# Phase 2: Data Ingestion Service (作戰 - Waging War)

**Goal:** Build resilient "Adapters" that fetch data from ClickBank and ShareASale, normalize it, and populate the Sophia Index.

**Context:**
- **Binh-Pháp Principle:** "In war, then, let your great object be victory, not lengthy campaigns."
- **Focus:** Efficiency, Rate Limiting, Error Handling.

## Key Insights
- **ClickBank:** Provides a massive daily dump (Marketplace Feed). Best to download/parse once/day.
- **ShareASale:** Restrictive API. Use "Iterator Pattern" - fetch top 500 per category, not everything.
- **Amazon:** **Strictly On-Demand** or targeted specific keyword search. Do NOT crawl.

## Requirements

### Functional
1.  **Adapter Interface:** Common `IngestionAdapter` interface for all networks.
2.  **Normalization:** Convert "Gravity" (CB) and "Power Rank" (SAS) into common scale.
3.  **Cron Jobs:** Scheduled tasks via GitHub Actions or Supabase Edge Functions (pg_cron).

### Non-Functional
1.  **Resilience:** Retry logic with exponential backoff.
2.  **Logging:** Detailed ingestion logs (items fetched, skipped, failed).

## Architecture: Adapter Pattern

```typescript
interface IngestionAdapter {
  networkName: string;
  fetchProducts(): Promise<RawProduct[]>;
  normalize(raw: RawProduct): NormalizedProduct;
}

// ClickBank Strategy:
// 1. GET https://.../marketplace_feed_v2.json.zip
// 2. Unzip & Parse Stream (using SAX-like parser if huge)
// 3. Upsert to DB

// ShareASale Strategy:
// 1. For each Category in [Health, Wealth, Tech]:
// 2. GET /merchantSearch?category=X&limit=500
// 3. Upsert to DB
```

## Implementation Steps

1.  **Base Adapter:**
    - Create abstract class/interface.
    - Implement error handling wrapper.

2.  **ClickBank Adapter:**
    - Implement Feed downloader.
    - Implement JSON parser.
    - Map Category ID -> Internal Category ID.

3.  **ShareASale Adapter:**
    - Implement API client (Authentication w/ Token).
    - Implement category iterator.

4.  **Ingestion Runner:**
    - Create `ingest.ts` script.
    - Configure `pg_cron` or GitHub Action to run nightly.

## Resource Allocation
- **Backend (90%):** Adapter logic, API clients, Parsing.
- **Frontend (10%):** Admin view to trigger manual ingestion and view logs.

## Victory Metrics
- **Ingestion Speed:** Process ClickBank Feed (< 50MB) in < 2 minutes.
- **Data Integrity:** < 1% error rate on parsing.
- **Freshness:** Data is never > 24 hours old.

## Risk Assessment
- **Risk:** API Rate Limit bans.
- **Mitigation:** Strict local throttling (Bottleneck library). Respect `Retry-After` headers.
