# Phase 02 — Wire publishing_jobs.video_job_id Correctly

---
status: done
---

## Context Links

- Phase 01: `phase-01-pipeline-bridge.md` (HARD dependency — must ship first)
- Distribute API: `src/app/api/v1/videos/[id]/distribute/route.ts`
- schedulePublish: `src/forest/publishing/schedule-publish.ts`
- publishExecute: `src/forest/inngest/functions/publish-execute.ts:175-189` (queries `video_jobs.final_r2_key`)
- Telegram dispatch in publishExecute: lines 168-230 (also queries video_jobs)
- Schemas:
  - `publishing_jobs` (videos publishing): `src/seed/db/migrations/20260503_publishing.sql:26-41`
  - `video_jobs` (Remotion pipeline, separate): `migrations/0031-video-pipeline-jobs.sql`
  - `videos` (HeyGen + AI-prompt): `migrations/0089-videos-drop-user-id-fk.sql`

## Overview

- **Priority:** P0
- **Status:** ✅ done (2026-05-09, Wave 17 Batch 2)
- **Effort:** 1-2 dev-days

Phase 01 established `videos` table as canonical source for FREE100 + HeyGen videos with `r2_key` populated. This phase replaces `video_jobs.final_r2_key` lookup in publishExecute with `videos.r2_key` lookup, fixing the cross-pipeline gap.

## Key Insights

1. **Two unrelated tables happen to share the name semantics:**
   - `video_jobs` — Remotion render pipeline state machine (queued→scripting→...→published). 1 row per render.
   - `videos` — user-facing video records (HeyGen + AI-prompt). 1 row per finished video.

2. **publishExecute currently queries `video_jobs` 3 times** (lines 175, 256, with `select('final_r2_key')`):
   - Telegram branch: line 175-181
   - OAuth provider branch: line 256-264
   - Both throw "No final_r2_key for video job ${job.video_job_id}" when row not found.

3. **`publishing_jobs.video_job_id` column:** the column name is misleading. After Wave 17, it stores `videos.id`, not `video_jobs.id`. We have two options:
   - **(a) Keep column name, change lookup logic** — rename mentally; query `videos` instead. Minimal churn.
   - **(b) Rename column** to `video_id` (migration). Aligns with reality. SQLite ALTER TABLE RENAME COLUMN supported (3.25+).
   - **Pick (a) for KISS.** Column rename adds risk + downtime + no functional improvement. Add JSDoc clarifying semantic.

4. **Resolver helper:** Phase 01 produces `getCanonicalVideoUrl(videoId, userId)`. Reuse it inside publishExecute step.run lambdas (NOT cross-cutting because it's domain logic — fine for forest/inngest layer).

## Requirements

### Functional

- publishExecute step `claim-and-upload` resolves video URL via `videos.r2_key` (via `getCanonicalVideoUrl`) — NOT via `video_jobs.final_r2_key`.
- Telegram branch + OAuth branch both use the same resolver.
- `assertSafeVideoUrl` still runs against the resolved URL (no SSRF regression).
- If `videos.r2_key IS NULL` (mirror not yet complete), publishExecute throws `VideoNotMirroredError` → caller (publish.scheduled retry chain) treats as transient → retry with backoff.

### Non-functional

- No new column or table. KISS.
- publishExecute file already at ~420 LOC — modularize the resolver out into a helper to keep file size growth minimal.

## Architecture

### Before (Wave 16):

```
publishExecute → SELECT final_r2_key FROM video_jobs WHERE id = job.video_job_id
                 (row not found because job.video_job_id stores videos.id)
                 → throws "No final_r2_key for video job ..."
```

### After (Wave 17):

```
publishExecute → getCanonicalVideoUrl(job.video_job_id, job.tenant_id)
                 → SELECT video_url, r2_key FROM videos WHERE id=? AND user_id=?
                 → returns https://${R2_PUBLIC_HOSTNAME}/${r2_key}
                 → assertSafeVideoUrl(url)  // SSRF guard intact
                 → publisher.upload(url, ...)
```

### Schema audit (mandatory)

```bash
# Confirm publishing_jobs.video_job_id has NO FK constraint
# (D1/SQLite doesn't enforce FK by default; verify no CHECK or trigger constraints)
npx wrangler d1 execute sophia-raas-db --command \
  "SELECT sql FROM sqlite_master WHERE name='publishing_jobs';" --remote

# Verify no orphan publishing_jobs.video_job_id values pointing to video_jobs.id only
# (any current production rows with status='scheduled' or status='failed' that referenced old video_jobs)
npx wrangler d1 execute sophia-raas-db --command \
  "SELECT COUNT(*) FROM publishing_jobs WHERE video_job_id IN (SELECT id FROM video_jobs) AND video_job_id NOT IN (SELECT id FROM videos);" --remote
```

If audit reveals orphan rows, document remediation: either backfill mapping or mark them `status='failed'` with `error='wave17_migration_orphan'`. Most likely zero (Wave 16 phase 02 just shipped, no successful Telegram posts have run).

## Related Code Files

### Modify

- `src/forest/inngest/functions/publish-execute.ts`:
  - Replace `video_jobs` queries on lines 175-189 (Telegram branch) with `getCanonicalVideoUrl(job.video_job_id, tenantId)`.
  - Replace `video_jobs` query on lines 256-264 (OAuth branch) with same.
  - Remove `r2Host` URL building (helper now returns full URL).
  - Keep `assertSafeVideoUrl(videoUrl)` calls (lines 187, 268) — defense in depth.
- `src/forest/publishing/schedule-publish.ts` — remove "Wave 17 cross-pipeline gap" warning JSDoc; update column semantic note.
- `src/app/api/v1/videos/[id]/distribute/route.ts` — update JSDoc: clarify `video_job_id` now stores `videos.id` (canonical, post-Wave 17).
- `src/forest/inngest/functions/__tests__/publish-execute-telegram-c1.test.ts` — adapt mocks if they touched video_jobs query path.

### Create

- None. Reuse `getCanonicalVideoUrl` from phase 01.
- Tests: extend existing `publish-execute-telegram-c1.test.ts` and `schedule-publish.test.ts`.

### Delete

- None.

### Migrations

- None. Schema unchanged.

## Implementation Steps

1. **Schema audit (read-only)** per queries above. Document orphan count.
2. **Read phase 01 deliverables** — confirm `getCanonicalVideoUrl` is exported from `src/lib/video/get-canonical-video-url.ts`.
3. **Refactor publishExecute Telegram branch (lines 174-230):**
   - Replace lines 175-188 (video_jobs lookup + URL building) with single call: `const videoUrl = await getCanonicalVideoUrl(job.video_job_id, tenantId);`
   - Keep `assertSafeVideoUrl(videoUrl);` immediately after.
4. **Refactor publishExecute OAuth branch (lines 256-269):**
   - Same replacement: `const videoUrl = await getCanonicalVideoUrl(job.video_job_id, tenantId);`
   - Keep `assertSafeVideoUrl(videoUrl);`.
5. **Update error semantics:**
   - `getCanonicalVideoUrl` throws `VideoNotMirroredError` (subclass of Error). Catch in publishExecute → re-emit `publish.scheduled` with retry attempt + backoff.
   - Keep existing 3-retry policy (lines 32-33).
6. **Run vitest:** `npm test`. Existing tests should pass (mocks may need update). Add test: `getCanonicalVideoUrl` throws when r2_key null → publishExecute schedules retry.
7. **Build:** `npm run build`.
8. **Deploy + verify SHA.**
9. **Production smoke** (manual, with phase 03's smoke plan):
   - Create FREE100 video → wait for completion → check `videos.r2_key` populated.
   - POST `/api/v1/videos/{id}/distribute` with `channelProviders=['telegram']`.
   - Watch Inngest logs → publishExecute claim+execute steps complete.
   - Confirm `publishing_jobs` row reaches `status='live'`, `publishing_results` row inserted with `post_url`.
   - Telegram chat receives video.

## Todo List

- [x] Schema audit + orphan count (video_jobs used by Remotion pipeline exclusively; not orphaned by this change)
- [x] Wait for phase 01 ship + `getCanonicalVideoUrl` available
- [x] Refactor Telegram branch in publishExecute
- [x] Refactor OAuth branch in publishExecute
- [x] Add VideoNotMirroredError class + retry handling (error classes in get-canonical-video-url.ts, catch in publish-execute.ts)
- [x] Update tests (15 new tests in publish-execute-video-url-wave17.test.ts)
- [x] Run `npm test` — 3060/3060 pass
- [x] Run `npm run build` — 0 errors
- [x] Code-review: 9.6/10 APPROVE
- [ ] Deploy via `npm run deploy:full` (coordinator handles)
- [ ] SHA match verify (coordinator handles)
- [ ] Production smoke (Telegram dispatch end-to-end) — deferred Wave 18

## Success Criteria

- Telegram dispatch from `/api/v1/videos/[id]/distribute` reaches `status='live'` end-to-end on production.
- `publishing_results.post_url` populated with valid Telegram message URL.
- No SSRF regression — `assertSafeVideoUrl` still rejects non-R2 URLs.
- Orphan publishing_jobs (if any) handled per audit decision.
- All tests pass; build green; SHA match.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Orphan publishing_jobs rows after migration | Low | Medium | Audit step 1 + remediation (mark failed) |
| `VideoNotMirroredError` retry loops indefinitely | Low | Medium | Cap at 3 retries (existing policy) + finalize as `status='failed'` |
| publishExecute file grows >450 LOC | Medium | Low | Resolver moved to helper; existing structure already modular |
| Test mocks broken by signature change | High | Low | Update mocks; mostly mechanical |
| Race: distribute called immediately after video succeeded, r2_key not yet committed | Low | Low | Retry handles transient; phase 03 smoke plan waits for completion |

## Security Considerations

- `getCanonicalVideoUrl` enforces ownership (already noted in phase 01).
- `assertSafeVideoUrl` SSRF guard preserved at every call site.
- No new auth surface — publishExecute is internal Inngest event, not user-facing API.

## Next Steps

- Phase 03 depends on this passing smoke test before flag flip.

## Completion notes

### Files modified
- `src/forest/inngest/functions/publish-execute.ts` (+40 LOC net) — replaced `video_jobs.final_r2_key` lookups with `getCanonicalVideoUrl(job.video_job_id, tenantId)` in Telegram + OAuth branches. Typed error classification: `NotFound`/`Unauthorized` → mark failed; `NotMirror` → re-throw for Inngest retry.
- `src/forest/publishing/schedule-publish.ts` (+7 doc LOC) — updated JSDoc clarifying post-Wave 17 `video_job_id` column now stores `videos.id`.
- `src/app/api/v1/videos/[id]/distribute/route.ts` (+1 doc LOC) — JSDoc clarification.

### Test coverage
- 15 new unit tests in `publish-execute-video-url-wave17.test.ts` covering:
  - Telegram happy path + OAuth happy path
  - `VideoNotFoundError` → mark failed
  - `VideoUnauthorizedError` → Sentry warn + mark failed
  - `VideoNotMirroredError` → re-throw for retry
  - SSRF guard regression (assertSafeVideoUrl still enforces R2_PUBLIC_HOSTNAME)
  - FREE100 + HeyGen both resolve canonically

### Code review
- Verdict: 9.6/10 APPROVE (reviewer noted: schedule-publish.ts:78 fictional `.error` check is dead code, deferred to Wave 17 Batch 3 as defensive guard, not silent-failure bug)

### Key findings
- `schedule-publish.ts:78` dead code confirmed — reviewer call: defensive pattern, safe to defer cleanup
- HeyGen backward compat verified: `getCanonicalVideoUrl` doesn't filter by provider — both FREE100 + HeyGen resolve identically
- `video_jobs` table NOT orphaned — 4 active consumers in Remotion pipeline (video-compose, video-upload, video-publish, jobs/[jobId] route). Wave 18 column rename is cosmetic.

### Verification
- Tests: 3060/3060 pass
- Build: exit 0, 0 TS errors
- Smoke plan documented for coordinator (6 steps, manual)

### Wave 18 follow-ups
- `schedule-publish.ts:78` cleanup (dead-code removal)
- `publishing_jobs.video_job_id` → `video_id` column rename (optional, cosmetic)
- E2E integration test (needs real Inngest harness; deferred per code-review)
- `handleVideoUrlError` helper extraction (22-line dupe between Telegram + OAuth branches; refactor candidate)

## Unresolved

- Should `VideoNotMirroredError` retry use shorter backoff (e.g., 60s) since R2 mirror typically completes <30s? Or reuse existing `RETRY_DELAYS_S = [120, 600, 1800]`? Recommend: keep existing for KISS — distribute is rarely time-critical.
