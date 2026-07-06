# Phase 03 — Deploy OTEL to Staging + Verify Honeycomb

**Priority:** P0 | **Effort:** 1h | **Status:** ✅ complete | **Depends on:** Phase 02

## Overview
Deployed OTEL instrumentation to staging, verified Honeycomb traces flowing. No crash in wrangler tail.

## Implementation Steps
- [x] Add `HONEYCOMB_API_KEY` to wrangler secrets
- [x] `npm run deploy:full` exits 0
- [x] `/api/version` shortSha matches local
- [x] Traces visible in Honeycomb (api.*, inngest.*, fetch spans)
- [x] HTTP 200 on production URL

## Success Criteria
- [x] `npm run deploy:full` exits 0
- [x] `/api/version` shortSha matches local
- [x] Traces visible in Honeycomb UI (spans + metrics)
- [x] No crash in wrangler tail logs
- [x] HTTP 200 on production URL
