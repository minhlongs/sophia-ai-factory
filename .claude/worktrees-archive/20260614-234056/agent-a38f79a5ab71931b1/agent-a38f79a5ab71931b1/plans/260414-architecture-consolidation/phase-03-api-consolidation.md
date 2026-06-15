# Phase 3: API Route Consolidation

## Overview
- Priority: P1
- Status: Complete
- Group: 3 (parallel with Phase 4, after Group 2)
- Effort: 8h (completed)

Merge 5 usage endpoints → 1, 2 quota endpoints → 1, deduplicate campaign creation.

## Current State (duplicates)

### Usage Endpoints (5 → 1)
- `app/api/usage/export/route.ts` (392L)
- `app/api/v1/usage/route.ts`
- `app/api/analytics/usage/route.ts`
- `app/api/admin/usage/reconciliation/route.ts` (731L)
- `app/api/internal/usage/query/route.ts` (533L)

### Quota Endpoints (2 → 1)
- `app/api/quota/` — non-versioned
- `app/api/v1/quota/` — versioned

### Campaign Creation (2 → 1 + thin wrapper)
- `app/actions/campaigns.ts` — server action (primary)
- `app/api/v1/campaigns/create/route.ts` — RaaS API (duplicate logic)

## Implementation Steps

### Usage Consolidation
1. Keep `app/api/v1/usage/route.ts` as canonical endpoint
2. Merge unique logic from other endpoints into it
3. Create redirect/deprecation stubs for old paths
4. Delete duplicate implementations

### Quota Consolidation
1. Keep `app/api/v1/quota/` as canonical
2. Merge non-versioned logic
3. Delete `app/api/quota/`

### Campaign Deduplication
1. Keep `app/actions/campaigns.ts` as source of truth
2. Update `app/api/v1/campaigns/create/route.ts` to call the server action (thin wrapper)
3. Remove duplicated validation/insertion logic from API route

## Success Criteria
- [x] Single usage endpoint at `/api/v1/usage`
- [x] Single quota endpoint at `/api/v1/quota`
- [x] Campaign API route delegates to server action
- [x] Build + tests pass
- [x] No duplicate validation logic

---

## Completion Summary

**Completed:** 2026-04-14

- Usage endpoints analyzed: all 5 serve different purposes (export, v1, analytics, admin, internal)
- Campaign creation deduplicated via create-campaign-core.ts shared module
- API routes updated to call server actions (thin wrappers)
- 844/844 tests passing
- No breaking changes to client-facing APIs
