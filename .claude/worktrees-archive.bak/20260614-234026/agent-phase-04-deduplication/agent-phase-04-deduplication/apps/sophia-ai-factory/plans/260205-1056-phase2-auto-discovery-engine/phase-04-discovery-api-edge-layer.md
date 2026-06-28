---
title: "Phase 4: Discovery API & Edge Layer"
description: "Exposing the intelligence via high-performance Edge APIs."
status: completed
priority: P2
effort: 1 week
tags: [phase4, api, edge, security]
created: 2026-02-05
---

# Phase 4: Discovery API & Edge Layer (軍形 - Military Disposition)

**Goal:** Provide instant, secure access to the "Top 50" data via Supabase Edge Functions, implementing validity checks on the fly.

**Context:**
- **Binh-Pháp Principle:** "The good fighters of old first put themselves beyond the possibility of defeat, and then waited for an opportunity of defeating the enemy."
- **Focus:** Performance, Security (RLS), Link Validation.

## Key Insights
- **Read-Heavy:** Users will view the list 100x more than the list updates.
- **Link Rot:** Affiliate offers die. We need a "Last Mile" check (Head Request) to ensure we don't send traffic to 404s.

## Requirements

### Functional
1.  **Search API:** `GET /api/discovery/search?q=golf&min_sps=70`.
2.  **Top 50 API:** `GET /api/discovery/top-50`.
3.  **Link Validator:** Check link health on client request (optimistic UI or SWR).

### Non-Functional
1.  **Latency:** Search results < 200ms.
2.  **Security:** Rate limit API calls (Prevent scraping our index).

## Architecture: API Layer

- **Supabase Auto-Generated API:** Use standard PostgREST for basic queries (filtered by RLS).
- **Edge Function `validate-link`:**
    - Receives `target_url`.
    - Performs `fetch(url, { method: 'HEAD' })`.
    - Returns status (200, 404, 301).

## Implementation Steps

1.  **Postgres Functions (RPC):**
    - Create `get_top_products(limit, offset, category)` RPC for complex sorting logic if standard query is too slow.

2.  **Edge Function `validate-link`:**
    - Deploy Deno/Node edge function.
    - Add caching headers (Cache result for 1 hour).

3.  **Security Policies:**
    - RLS: Public can read `title`, `score`. Only Authenticated (Option B) can see `affiliate_link`.

## Resource Allocation
- **Backend (70%):** Edge functions, RPCs, RLS.
- **Frontend (30%):** API client integration (TanStack Query).

## Victory Metrics
- **API Response:** < 100ms for Top 50 fetch.
- **Link Check:** Validates link in < 500ms.

## Risk Assessment
- **Risk:** Scrapers stealing our curated list.
- **Mitigation:** RLS limits non-paid users to "Blurry" view or limited fields. Rate limiting via Supabase/Cloudflare.
