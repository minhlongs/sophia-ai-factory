# Phase 1: Core Data Infrastructure
**Status:** Pending
**Priority:** High

## Overview
Design and deploy the PostgreSQL schema required to store aggregated affiliate data. This unifies disparate data structures from ClickBank, ShareASale, and Amazon into a single "Sophia Product" model.

## Requirements
1.  **Unified Schema:** A `products` table that can hold data from any network.
2.  **Normalization Fields:** Columns for calculated metrics (`sps_score`, `normalized_gravity`).
3.  **Ingestion Tracking:** A mechanism to track when a product was last updated to purge stale data.
4.  **Type Safety:** TypeScript definitions for the DB schema.

## Architecture - Database Schema

### `affiliate_networks`
- `id`: uuid
- `slug`: string (clickbank, shareasale, amazon)
- `name`: string
- `config`: jsonb (api endpoints, rate limits)

### `affiliate_products`
- `id`: uuid
- `network_id`: fk -> affiliate_networks.id
- `external_id`: string (The network's unique ID for the product)
- `title`: string
- `description`: text
- `category`: string (Normalized category)
- `url`: string (Affiliate link template)
- `image_url`: string
- `price`: decimal
- `commission_rate`: decimal (0.0 to 1.0)
- `currency`: string
- **Metrics (Raw)**
    - `raw_gravity`: decimal (ClickBank)
    - `raw_power_rank`: decimal (ShareASale)
    - `raw_sales_rank`: decimal (Amazon)
- **Metrics (Normalized)**
    - `sps_score`: decimal (Sophia Potential Score 0-100)
    - `normalized_popularity`: decimal
    - `normalized_commission`: decimal
- `last_updated_at`: timestamp
- `is_active`: boolean

### `ingestion_logs`
- `id`: uuid
- `network`: string
- `items_processed`: int
- `items_updated`: int
- `status`: string (success, failed)
- `created_at`: timestamp

## Implementation Steps
1.  [ ] Create SQL migration file `supabase/migrations/YYYYMMDDHHMMSS_add_affiliate_schema.sql`.
2.  [ ] Define tables, indexes (on `sps_score`, `category`, `title`), and RLS policies.
3.  [ ] Run migration locally/remote.
4.  [ ] Generate TypeScript types (`supabase gen types`).
5.  [ ] Create `src/types/affiliate.ts` for frontend/app-layer types.

## Success Criteria
- [ ] Database tables created successfully.
- [ ] RLS enabled (Public Read, Service Role Write).
- [ ] Types generated and exported.
