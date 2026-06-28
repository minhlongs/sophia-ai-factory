# Phase 02 — Video Status Sync Cron

## Overview
Priority: P0. Ensure videos eventually reach terminal state (completed/failed) even if user closes browser.

## Files
- ADD: `src/app/api/cron/video-status-sync/route.ts`
- MODIFY: `wrangler.toml` (append `*/5 * * * *` cron pointing to /api/cron/video-status-sync)

## Steps
1. Use existing `verifyCronAuth()` helper for auth.
2. Use existing `recordCronRun()` from `@/lib/cron/run-tracker`.
3. Query D1: `SELECT id, user_id, heygen_job_id FROM videos WHERE status='processing' AND created_at > unixepoch()-86400 LIMIT 50`.
4. For each: call `getHeyGenClient()`. If null (no key) — skip + log.
5. For each pending: poll HeyGen status. If terminal → UPDATE row with `status, video_url, thumbnail_url, duration_sec, error, updated_at`.
6. If completed AND `R2_PUBLIC_BASE_URL` set: call `downloadAndStore` from Phase 01 to copy video to R2; persist `r2_key`.
7. If `created_at < unixepoch()-86400` (>24h pending) → mark `status='failed', error='timeout'`.
8. Return summary `{checked, terminal, failedTimeouts}`.

## Success Criteria
- Build passes
- Returns 200 with summary on cron call
- Skips gracefully when HEYGEN_API_KEY absent
- Idempotent — running twice in 5min doesn't duplicate work
