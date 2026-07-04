---
phase: 7
title: "C2-Sentry Honeycomb"
status: completed
effort: "Small (1-2d)"
priority: P3
dependencies: []
track: C
---

# Phase 7: C2-Sentry Honeycomb

## Overview

Minor polish to existing Sentry and Honeycomb observability. Both are already production-grade. Source maps intentionally skipped per no-tech doctrine.

## Context

- Sentry: Full SDK (client + server), PII stripping, trace sampling, error filtering — production-grade
- Source maps: Not uploaded (requires SENTRY_AUTH_TOKEN — operator-side, optional per doctrine)
- Honeycomb: BYOK settings UI at `/dashboard/admin/byok-rotation/components/honeycomb-settings.tsx`
- Sentry cron monitoring: Already configured via `cron-check-in.ts` (`Sentry.captureCheckIn`) — the d1-backup route already uses `startCronCheckIn`/`finishCronCheckIn`/`failCronCheckIn`. Monitor slug: `cron-d1-backup`. No additional code changes needed.

## Implementation Steps

1. Sentry cron monitor configuration — already in place. `cron-check-in.ts` emits `in_progress → ok|error` lifecycle for `cron-d1-backup`. No changes needed.
2. Relocate Honeycomb settings from `byok-rotation/` directory to `/dashboard/admin/settings/observability`
3. Add connection test button to Honeycomb settings (validate key before saving)
4. Add Honeycomb dataset name configuration alongside API key

## Success Criteria

- [x] Sentry cron monitor configured for backup cron — ALREADY IN PLACE (cron-check-in.ts + d1-backup route)
- [x] Honeycomb settings in correct admin location — NEW page at `/dashboard/admin/settings/observability`
- [x] Connection test works for Honeycomb API key — new `/api/admin/honeycomb/test` endpoint
- [x] Honeycomb dataset name config — added input field alongside API key
- [x] All existing tests pass — 6772/6772 passing

## Files Changed

| File | Change |
|------|--------|
| `honeycomb-settings.tsx` | Added Test Connection button + Dataset name input |
| `api/admin/honeycomb/test/route.ts` | NEW — proxy endpoint for Honeycomb auth check |
| `settings/observability/page.tsx` | NEW — admin page re-exporting HoneycombSettings |
| `phase-07-c2-sentry-honeycomb.md` | Updated status to completed |
