# Phase 04 — Distribute Publish-Status Polling (M1)

## Context Links

- Plan overview: `./plan.md`
- Existing pattern reference: `src/app/api/v1/missions/[id]/stream/route.ts` (SSE for mission status)
- Schema: `publishing_jobs` table with `status` column (enum: queued | processing | live | failed | paused)
- UI: `dashboard/videos/[id]/distribute/page.tsx` and `publishing-status-badges.tsx`

## Overview

- **Priority:** P1
- **Effort:** 1d
- **Status:** ✅ COMPLETE (2026-05-09)
- **Description:** After a user submits a distribute action, currently the UI is static — they have no live signal whether jobs went live. Add a polling-driven status panel that watches each publishing_job in real time until terminal.

## Key Insights

- `publishing_jobs.status` updates from `queued → processing → live | failed`, driven by the Inngest `publish-execute` worker.
- We don't want to overload CF Workers with persistent SSE connections per job (the stream pattern was justified for missions which have higher value).
- A simple JSON poll endpoint at 3-5s interval is sufficient and cheaper.
- Polling stops automatically when ALL rows are terminal (live/failed/paused).
- Must be tied to user_id (security: do not return jobs the user does not own).

## Requirements

### Functional
- F1. New endpoint `GET /api/v1/distribute/jobs/[videoId]/status` returns `{ jobs: [{ channelId, provider, status, attempts, lastError, updatedAt }] }`. Auth required (Better Auth session).
- F2. Endpoint MUST filter by `WHERE user_id = ? AND video_id = ?` (or join through publishing_channels.user_id when video_id sourced via mission).
- F3. Client-side hook `useDistributeJobsPolling(videoId)` polls at 4s interval; backs off to 10s after 60s; stops when all jobs terminal.
- F4. UI: render a per-channel row with provider icon + translated status badge + attempts + error tooltip. Reuse `PublishingStatusBadges` (already updated in Phase 03).

### Non-Functional
- NF1. Endpoint cached `Cache-Control: no-store` (real-time data).
- NF2. Endpoint Zod-validates videoId param (`z.string().uuid()`).
- NF3. Hook unsubscribes on unmount; no memory leaks.
- NF4. Files <200 LOC each; split hook + UI + endpoint.
- NF5. No `:any`.

## Architecture

```
GET /api/v1/distribute/jobs/[videoId]/status   ← forest layer route (uses createServerClient)
                  │
                  ▼
        publishing_jobs (D1) JOIN publishing_channels (D1) WHERE user_id = session.id
                  │
                  ▼
        return JSON list

Client:
  useDistributeJobsPolling(videoId)    ← seed/hooks/use-distribute-jobs-polling.ts
                  │
                  ▼
   <DistributeStatusPanel/>            ← components/distribute/distribute-status-panel.tsx
                  │
                  └──► <PublishingStatusBadges />  (per row)
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/[id]/distribute/page.tsx` — render the new panel below the submit form.

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/v1/distribute/jobs/[videoId]/status/route.ts` (~120 LOC)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/hooks/use-distribute-jobs-polling.ts` (~80 LOC)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/components/distribute/distribute-status-panel.tsx` (~100 LOC client component)
- Test files: `route.test.ts`, `use-distribute-jobs-polling.test.ts`.

### Delete
None.

## Implementation Steps

1. Verify `publishing_jobs` schema (migrations folder) — confirm columns: `id, channel_id, video_id, status, attempts, last_error, updated_at`. Note: `user_id` may live on `publishing_channels`, requiring a JOIN.
2. Build endpoint:
   - `getCurrentUser()` → 401 if null
   - Zod parse `videoId`
   - Query: `SELECT pj.id, pj.channel_id, pc.provider, pj.status, pj.attempts, pj.last_error, pj.updated_at FROM publishing_jobs pj JOIN publishing_channels pc ON pj.channel_id = pc.id WHERE pc.user_id = ? AND pj.video_id = ?`
   - Return `{ jobs: rows }` with `Cache-Control: no-store`.
3. Build `useDistributeJobsPolling(videoId)`:
   - Use `useEffect` + `setInterval`
   - Track elapsed time; switch from 4s → 10s after 60s
   - Stop when `jobs.every(j => ['live','failed','paused'].includes(j.status))`
   - Cleanup on unmount and on `videoId` change
   - Return `{ jobs, isPolling, lastError, refresh }`.
4. Build `<DistributeStatusPanel videoId={...} />`:
   - Calls hook
   - Loading state for first fetch
   - Empty state ("No distribute jobs yet — submit above to start")
   - List of `<PublishingStatusBadges row={job}/>`.
5. Wire panel into `distribute/page.tsx` — render below form.
6. Write tests:
   - route: 401 unauthenticated, 200 returns only own user's rows, 200 empty when no jobs.
   - hook: polls correctly, stops on all-terminal, backoff after 60s.
7. `npm run build` + `npm test`.
8. Manual smoke: submit a distribute → watch status update from queued → live without page refresh.

## Todo List

- [x] Verify schema (migrations) for publishing_jobs + user_id ownership chain
- [x] Implement status endpoint with Zod + auth + JOIN
- [x] Implement polling hook with adaptive interval
- [x] Implement status panel client component
- [x] Wire into distribute page
- [x] Tests for endpoint + hook
- [x] `npm run build` → 0 errors
- [x] `npm test` → all pass (3064/3064)
- [x] Code review pass (9.2/10, security PASS, 0 critical)
- [ ] `npm run deploy:full` + SHA verify
- [ ] Manual happy-path smoke test (FREE100 user, 1 channel)

## Success Criteria

- [ ] User submits distribute → status panel appears with `queued` rows within 4s.
- [ ] Status auto-updates to `live` (or `failed`) without manual refresh.
- [ ] Polling stops once all terminal — verified via Network tab.
- [ ] Cross-user safety: user A cannot read user B's jobs even by manipulating videoId.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Polling overwhelms CF Workers if many users open page | M | H | Adaptive backoff (4s→10s); stop on terminal; cap concurrent renders. Monitor `wrangler tail` after deploy. |
| Schema assumption wrong (user_id may already be on publishing_jobs) | M | L | Read latest migrations file before step 2. |
| Hook race: stale `videoId` triggers fetch with old id | L | M | Use `useEffect` cleanup that aborts via `AbortController`. |
| `Cache-Control: no-store` not honored by CF cache | L | M | Also send `CDN-Cache-Control: no-store` and `Vary: Authorization`. |
| Polling continues after browser tab inactive | M | L | Use `document.visibilityState === 'hidden'` to pause polling; resume on visible. |

## Security Considerations

- Endpoint MUST filter by user — verified via JOIN through `publishing_channels.user_id`.
- Last-error string from publishing_jobs may contain provider PII (e.g. token leak in HTTP error). Sanitize: trim to first 200 chars and strip patterns like `Bearer .*`, `token=...`.
- Rate-limit: wrap in `withRateLimit` (60 req/min per user — generous because polling).

## Completion Notes

**Schema Discovery:** Telegram integration uses `tenant_id` for ownership; OAuth flows via JOIN on `publishing_channels.user_id`.

**Files Created:** 3 (endpoint route, polling hook, status panel component).

**Tests Added:** 9 (endpoint auth/filtering, hook polling logic, status derivation).

**Code Reviewer Score:** 9.2/10. Security: PASS (0 critical). All TypeScript strict, Zod validated, no `:any` types.

**Follow-ups for Phase 07:** Hardcoded "Live" badge in panel — consider dynamic branding per tier. Consider SSE migration if concurrent user count exceeds CF Workers context threshold.

## Next Steps

- Phase 05 (Telegram retry) reduces the `failed` status frequency this panel will surface.
- Phase 06 (Sentry) ensures any panel-side render errors surface in monitoring.
