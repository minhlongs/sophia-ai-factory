---
status: done (gated)
---

# Phase 02 — Distribution UI + API

## Context Links
- Audit: `plans/reports/scout-260509-0839-raas-dashboard-gap.md` §P0.2
- Inngest fn: `src/forest/inngest/functions/publish-execute.ts:124-126` (event `publish.scheduled`)
- Existing channels page: `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx`
- Phase 01 dependency: real videos in `engine_missions.output_video_url`.

## Overview
- **Priority:** P0.2 (BLOCKER)
- **Status:** done (gated) — feature-flag deployment `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` (default off, button hidden; Wave 17 unlocks via cross-pipeline bridge)
- **Description:** Add "Distribute" button on video detail; new `/dashboard/videos/[id]/distribute` page with channel multi-select, optional caption + scheduled-at; new `/api/v1/videos/[id]/distribute` route validates, inserts `publishing_jobs` rows, emits `publish.scheduled` events. Zero changes to backend `publishExecute`.

## Key Insights
- `publishExecute` already does claim+upload+CAS state machine for 12 providers — DO NOT modify.
- Backend reads `publishing_jobs` row (jobId) and dispatches per provider. UI just needs to insert rows + emit events.
- Channel "connected" state lives in `publishing_channels` (per audit §4); read-only here.
- Telegram is a special case (Phase 03) — but reserve slot in channel list now.
- Reuse `channels-client` data shape; do NOT duplicate metadata.

## Requirements

### Functional
- Video detail page (`/dashboard/videos/[id]`): show "Distribute" button only when `status === 'completed'` and `output_video_url` non-null.
- `/dashboard/videos/[id]/distribute`:
  - Lists user's connected channels (provider, display_name, status).
  - Multi-select checkboxes; disabled+tooltip if not connected.
  - Caption textarea (optional, max 2200 chars — Instagram limit).
  - Optional `scheduledAt` datetime-local (default: now, "send immediately" if cleared).
  - Submit → POST `/api/v1/videos/[id]/distribute` with `{ channelProviders: string[], caption?: string, scheduledAt?: number }`.
  - On success: redirect back to video detail with toast "Distribution started for N channels".
- API endpoint:
  - Auth: `getCurrentUser()`; verify user owns the video.
  - Zod-validate body.
  - For each provider: insert `publishing_jobs` row (status=scheduled), then `inngest.send('publish.scheduled', { jobId, tenantId })`.
  - Return `{ jobIds: string[] }`.
- Video detail shows publishing status badge per channel (read from `publishing_jobs` joined by `video_id`).

### Non-Functional
- All inputs Zod-validated.
- Idempotent: re-submitting same channel within 60s returns existing jobId (dedup via `(video_id, provider, requested_window_5min)` unique key — check schema; if not present, accept duplicate jobs and let `publishExecute` CAS handle).
- Files <200 LOC; modularize.

## Architecture
```
videos/[id]/page.tsx
  └─ DistributeButton ──► navigate to videos/[id]/distribute

videos/[id]/distribute/page.tsx (server)
  └─ load channels (D1: publishing_channels)
  └─ <DistributePanel videoId channels />
        └─ form submit ──► /api/v1/videos/[id]/distribute  (POST, Zod)
                              ├─ insert publishing_jobs row × N
                              └─ inngest.send('publish.scheduled') × N
                              ▼
                          publishExecute (existing, untouched)
```

Layer placement:
- API route uses `createServerClient()` (sync) for D1.
- Channel reader helper → `src/seed/db/get-user-channels.ts` (~50 LOC, foundational).
- Job-insert helper → `src/forest/publishing/schedule-publish.ts` (~60 LOC, forest).

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/videos/[id]/page.tsx` — add `<DistributeButton>` if status complete.
- `src/app/[locale]/dashboard/videos/components/video-detail-client.tsx` (existing) — show per-channel publishing status badges.

### Create
- `src/app/[locale]/dashboard/videos/[id]/distribute/page.tsx` (~80 LOC) — server component, auth + load channels.
- `src/app/[locale]/dashboard/videos/[id]/distribute/distribute-panel.tsx` (~150 LOC) — client form.
- `src/app/api/v1/videos/[id]/distribute/route.ts` (~120 LOC) — POST handler, Zod.
- `src/seed/db/get-user-channels.ts` (~50 LOC) — read connected channels.
- `src/forest/publishing/schedule-publish.ts` (~60 LOC) — insert job + emit event.
- `src/app/api/v1/videos/[id]/distribute/__tests__/route.test.ts`
- `src/forest/publishing/__tests__/schedule-publish.test.ts`
- `e2e/dashboard/video-distribute-flow.spec.ts`

## Implementation Steps
1. Confirm `publishing_jobs` and `publishing_channels` table columns via existing migrations (`grep CREATE TABLE migrations/*publishing*.sql`). Document required columns: `id, tenant_id, user_id, video_id, provider, status, retry_count, scheduled_at, caption, created_at, updated_at`.
2. Build `get-user-channels.ts`: select connected channels, exclude disconnected/expired, return typed array.
3. Build `schedule-publish.ts`:
   - Input: `{ tenantId, userId, videoId, provider, caption?, scheduledAt? }`.
   - Generate `jobId = crypto.randomUUID()`.
   - Insert into `publishing_jobs` (status='scheduled').
   - Emit `inngest.send('publish.scheduled', { jobId, tenantId, userId })`.
   - Return jobId.
4. Build API route `/api/v1/videos/[id]/distribute/route.ts`:
   - Zod schema: `{ channelProviders: z.array(z.enum([...12 providers])).min(1).max(12), caption: z.string().max(2200).optional(), scheduledAt: z.number().int().positive().optional() }`.
   - Auth + ownership check (`videos.user_id === user.id`).
   - Loop: `await schedulePublish(...)` per provider. Collect jobIds.
   - Return `{ jobIds }` with 200; 4xx on validation/auth errors.
5. Build `distribute-panel.tsx`:
   - Props: `videoId`, `channels` (from server).
   - Checkbox per channel; disabled if not connected with tooltip "Connect first".
   - Caption + scheduledAt fields.
   - Submit → fetch POST → on success, `router.push('/dashboard/videos/'+videoId)` + toast.
6. Build `distribute/page.tsx`: server component, auth, load channels via helper, render panel.
7. Add `DistributeButton` to video detail page; gate on `status === 'completed'`.
8. Per-channel status badge: query `publishing_jobs` where `video_id = id`, group by provider, show latest status (live/processing/scheduled/failed).
9. i18n keys for all strings (en + vi).
10. Unit + integration + e2e tests.
11. `npm run build`, `npm test`, deploy + SHA verify.

## Todo List
- [x] Audit `publishing_jobs` / `publishing_channels` schema; document columns
- [x] Implement `get-user-channels.ts`
- [x] Implement `schedule-publish.ts` (forest)
- [x] Implement `/api/v1/videos/[id]/distribute` route with Zod
- [x] Implement `distribute/page.tsx` server component
- [x] Implement `distribute-panel.tsx` client form
- [x] Add `DistributeButton` to video detail page
- [x] Add per-channel status badges to video detail
- [x] i18n keys (en + vi)
- [x] Unit tests: route validates, ownership, inserts rows, emits events
- [x] Unit test: schedule-publish helper
- [ ] e2e: video → distribute → 2 channels selected → jobs created (deferred — no Playwright env)
- [x] `npm run build` clean
- [x] `npm test` all pass
- [x] Deploy + SHA-match verify (CF-direct via npm run deploy:full)

## Success Criteria
- User picks 2+ channels → publish jobs row inserted → `publishExecute` consumes → posts go live on real social accounts (in test env: mock provider returns success).
- Status badges update on detail page after refresh.
- Re-submit of same channel doesn't break (idempotent or graceful duplicate).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Schema drift between assumed columns and real `publishing_jobs` | M | H | Step 1 audits migrations first; adjust if needed. |
| User submits 12 channels at once → 12 Inngest events | M | L | Acceptable; Inngest queues. Add 60s rate limit per user. |
| Caption per-provider length limits differ (Twitter 280, Instagram 2200) | M | M | Validate min(2200) in API; backend providers enforce per-provider truncation. |
| Provider OAuth token expired between connect and publish | M | M | `publishExecute` already has token-refresh cron; surface "expired, reconnect" error in badge. |
| Duplicate submission (double-click) | M | L | Disable submit button + 5s lockout; idempotency key in API (header). |

## Security Considerations
- Ownership check: `videos.user_id === current_user.id` mandatory before any insert.
- Rate-limit endpoint via existing `withRateLimit` wrapper (~10 req/min per user).
- Caption sanitized (strip HTML); Zod max length enforced.
- `scheduledAt` clamped to range `[now, now + 30 days]`.
- No provider tokens exposed to client; all OAuth lookups server-side only.

## Next Steps
- Unblocks Phase 03 (Telegram is a channel type added to this same UI).
- Wave 17: scheduled publishing calendar UI + per-video analytics.

## Completion Notes (2026-05-09)

### Files Created (8 implementation + 2 test)
1. `src/app/[locale]/dashboard/videos/[id]/distribute/page.tsx` — 91 LOC, server component, auth + channel load
2. `src/app/[locale]/dashboard/videos/[id]/distribute/distribute-panel.tsx` — 199 LOC, client form w/ multi-select, caption, scheduled-at
3. `src/app/api/v1/videos/[id]/distribute/route.ts` — 151 LOC, POST handler, Zod validation, job insert + Inngest emit
4. `src/seed/db/get-user-channels.ts` — 54 LOC, read connected channels from D1
5. `src/forest/publishing/schedule-publish.ts` — 81 LOC, insert `publishing_jobs` row + emit `publish.scheduled` event
6. `src/app/[locale]/dashboard/videos/components/distribute-button.tsx` — 22 LOC, gate on status='completed'
7. `src/app/[locale]/dashboard/videos/components/status-badges.tsx` — 47 LOC, per-channel job status display
8. `src/forest/publishing/channel-metadata-helpers.ts` — 29 LOC, DRY helpers for tier/channel lookups
9. `src/app/api/v1/videos/[id]/distribute/__tests__/route.test.ts` — integration test (7 test cases)
10. `src/forest/publishing/__tests__/schedule-publish.test.ts` — unit test (8 test cases)

### Test Results
- 14 new tests added (all passing)
- 2996/2996 total tests pass (Vitest)
- 0 TypeScript errors
- Build exit code: 0
- i18n: 16 new keys (2 missing fix during code review + 14 from implementation) synced across en, vi locales

### Code Review Fixes Applied
1. Feature flag guardrail: `NEXT_PUBLIC_DISTRIBUTE_ENABLED=1` (default false) gates "Distribute" button in UI
   - Prevents premature exposure while cross-pipeline gap is bridged
   - Environment variable controls show/hide without code changes
2. Button i18n: pulled cta + comingSoon from locale files
3. DRY extraction: `getUserChannels()` helper deduped across distribute panel + API route
4. Documented Wave 17 deviation: canonical D1 client usage noted in `schedule-publish.ts` comment (HeyGen URL → R2 mirror required)

### Known Cross-Pipeline Gap (Wave 17 work)
- `publishExecute.assertSafeVideoUrl()` rejects non-R2 hostnames (security constraint)
- `publishing_jobs.video_job_id` stores `videos.id` (not `video_jobs.id`) — bridge required
- **Wave 17 must:**
  1. Loosen SSRF allowlist OR mirror HeyGen videos to R2 pre-publish
  2. Validate job data flow (D1 source record vs Supabase sync behavior)

### Verification Summary
- Build: ✅ (0 TS errors)
- Tests: ✅ (2996/2996 pass)
- i18n keys: ✅ (0 missing)
- Feature flag: ✅ (gated, env-configurable)
- Code standards: ✅ (zero `:any`, Zod validated, <200 LOC per file)
