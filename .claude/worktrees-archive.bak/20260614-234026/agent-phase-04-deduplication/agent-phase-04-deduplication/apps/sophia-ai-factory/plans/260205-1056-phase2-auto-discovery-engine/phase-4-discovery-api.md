# Phase 4: Discovery API & Edge Layer
**Status:** Pending
**Priority:** Medium

## Overview
Provide the API endpoints for the frontend to search and filter products. Since data is indexed, search is fast. However, affiliate links can die/change. We need a "Live Check" at the edge.

## Architecture
- **Search API:** `/api/discovery/search` (server-side, queries Supabase).
- **Validation:** Client-side check or Edge Middleware.

## Implementation Steps

### 1. Search API
- **Endpoint:** `GET /api/discovery/search`
- **Params:** `q`, `category`, `min_sps`, `min_commission`, `network`.
- **Logic:**
    - Text search on title/description (Postgres Full Text Search or ILIKE).
    - Filter by columns.
    - Sort by SPS desc.
    - Pagination.

### 2. Live Validator (Edge)
- **Problem:** Aggregated data might be 24h old. Links might be broken.
- **Solution:** When a user clicks "View" or when showing Top 10 lists:
    - Trigger `HEAD` request to the affiliate URL.
    - If 404, flag as `is_broken` in DB (async) and warn user.

### 3. Caching
- Cache search results for 5 minutes (stale-while-revalidate).

## Todo List
- [ ] Implement Search API route.
- [ ] Add indexes to DB for search performance.
- [ ] Implement `validateLink` utility.

## Success Criteria
- [ ] Search returns results < 200ms.
- [ ] Filters work accurately.
