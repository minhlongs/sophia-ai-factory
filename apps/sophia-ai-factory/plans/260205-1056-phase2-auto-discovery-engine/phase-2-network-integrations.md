# Phase 2: Data Ingestion Service
**Status:** Pending
**Priority:** High

## Overview
Build the backend services responsible for fetching data from external affiliate networks and populating the `affiliate_products` table. This involves handling different API paradigms (Feed vs API vs Iterator).

## Architecture
- **Service Layer:** `src/lib/services/ingestion/`
- **Adapters:** `src/lib/adapters/{clickbank,shareasale,amazon}.ts`
- **Execution:** Next.js API Route (Cron) or Supabase Edge Function.

## Implementation Steps

### 1. ClickBank Adapter
- **Source:** Marketplace Feed (Publicly available XML/JSON usually, or authenticated API).
- **Logic:**
    - Fetch the daily dump.
    - Parse XML/JSON.
    - Map fields to `affiliate_products`.
    - Upsert to DB (Conflict on `external_id` + `network_id`).
    - *Note: Optimize for memory usage if feed is large (stream processing).*

### 2. ShareASale Adapter
- **Source:** API (requires approval) or controlled scraping if API restricted.
- **Logic:**
    - Iterate through top categories.
    - Fetch top 500 merchants/products.
    - Map metrics (Power Rank).
    - Upsert.

### 3. Ingestion Orchestrator
- Create `src/lib/services/ingestion/orchestrator.ts`.
- Function `runIngestion(network: string)`.
- Handles logging to `ingestion_logs`.
- Error handling and retries.

### 4. Cron Job Setup
- Configure Vercel Cron or Supabase Pg_cron.
- Schedule nightly updates (e.g., 03:00 UTC).

## Todo List
- [ ] Implement `ClickBankAdapter`.
- [ ] Implement `ShareASaleAdapter`.
- [ ] Create generic `IngestionService`.
- [ ] Set up Cron route `/api/cron/ingest-products`.
- [ ] Test with mock data/sandbox feeds.

## Success Criteria
- [ ] Can successfully fetch and parse data from at least one network.
- [ ] Data persists to Supabase correctly.
- [ ] Updates modify existing records instead of creating duplicates.
