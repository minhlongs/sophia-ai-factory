# Phase 01 — Bridge HeyGen→R2 + Canonical Video URL

## Context Links

- Wave 16 plan: `apps/sophia-ai-factory/plans/260509-0839-raas-dashboard-wave16/plan.md`
- Existing R2 mirror helper: `src/lib/video/video-storage-service.ts` (downloadAndStore — ALREADY mirrors HeyGen→R2 for the one-time-purchase path)
- Inngest video pipeline (FREE100): `src/forest/inngest/functions/video-generate.ts` (already produces R2 URLs via Cloudconvert mux step 6)
- HeyGen webhook completion: `src/lib/fulfillment/complete-video-from-webhook.ts:102` (already calls downloadAndStore + writes `videos.r2_key`)
- HeyGen mission handler: `src/forest/missions/handlers/video-create.ts` (does NOT mirror to R2 — gap)
- SSRF guard: `src/forest/inngest/functions/publish-execute.ts:49-60` (`assertSafeVideoUrl`, allowlists `R2_PUBLIC_HOSTNAME`)
- Schema: `src/seed/db/migrations/20260503_publishing.sql` + migration `0089-videos-drop-user-id-fk.sql` (videos table) + migration `0096-video-jobs-output-columns.sql` (engine_missions video columns) + migration `0031-video-pipeline-jobs.sql` (video_jobs)
- Wave 17 review surfaced gap: FREE100 AiPromptForm only writes to `engine_missions`, NOT `videos` table → user gallery never sees FREE100 videos → distribute panel can't load them.

## Overview

- **Priority:** P0
- **Status:** ✅ done
- **Effort:** 2-3 dev-days

Establish a single canonical R2-hosted video URL per user video, regardless of pipeline (HeyGen avatar-video, FREE100 Inngest video-generate, or future). This unblocks `assertSafeVideoUrl()` SSRF guard, which currently allowlists ONLY `R2_PUBLIC_HOSTNAME` and would reject HeyGen CDN URLs.

## Key Insights

1. **Three video pipelines exist and writes to different tables:**
   - HeyGen avatar-video webhook (paid bundle): writes `videos.video_url` (HeyGen URL) + `videos.r2_key` (mirrored). `complete-video-from-webhook.ts` already calls `downloadAndStore` → R2.
   - FREE100 AI prompt (Wave 16 phase 01): writes ONLY `engine_missions.output_video_url` (already an R2 URL from Cloudconvert mux). Does NOT insert into `videos` table — user gallery + distribute panel won't see these videos.
   - HeyGen mission handler (`forest/missions/handlers/video-create.ts`): writes `videos.heygen_video_id` but waits for HeyGen webhook to populate `video_url` + `r2_key`. Same path as #1 once webhook fires.

2. **`downloadAndStore` already exists and works** — see `lib/video/video-storage-service.ts`. Falls back to original URL when R2 binding unavailable. Bucket binding `VIDEO_BUCKET`. Key pattern: `videos/{userId}/{videoId}.mp4`.

3. **`assertSafeVideoUrl` allowlists `R2_PUBLIC_HOSTNAME`** — extending the allowlist to HeyGen domains is rejected (loosens SSRF guard, increases attack surface). Mirror-to-R2 is the canonical fix.

4. **For FREE100 path, video is ALREADY on R2** — `video-generate.ts` step 6 (`mux-audio-video`) writes `final.mp4` to R2 via Cloudconvert + `getVideoBucket().publicBaseUrl` produces the canonical URL. The gap is purely "engine_missions row not propagated to videos table".

## Recommended Approach: Option (a) — Mirror to R2 + propagate to videos table

Reasoning:
- Storage on Cloudflare R2 is cheap (~$0.015/GB/month, no egress fees).
- Keeps `assertSafeVideoUrl` strict (high security value).
- Reuses existing `downloadAndStore` helper (DRY).
- Single canonical "videos table is the source of truth" simplifies downstream code (gallery, distribute panel, ownership checks).

Rejected alternatives:
- **(b) Loosen allowlist to include HeyGen domains:** trades security for ~30 min effort. SSRF risk if HeyGen ever returns redirected/user-controlled URLs. NO.
- **(c) Presigned R2 URLs:** complicates URL lifecycle, requires signed URL refresh, cache-busting issues. Overkill — R2 public URLs already work.

## Requirements

### Functional

- HeyGen mission handler path produces a row in `videos` with `r2_key` populated within ~2 min of HeyGen webhook delivery (already works — verify only).
- FREE100 video-generate Inngest workflow produces a row in `videos` with `r2_key` populated when mission status transitions to `succeeded`.
- Distribute API (`/api/v1/videos/[id]/distribute`) and panel page (`/dashboard/videos/[id]/distribute`) successfully load FREE100 videos by `videos.id` and resolve a canonical R2 URL for `assertSafeVideoUrl`.
- `assertSafeVideoUrl` continues to reject any URL outside `R2_PUBLIC_HOSTNAME`.

### Non-functional

- Mirror operation timeout ≤ 30s (HeyGen videos typically <50MB).
- Mirror failure does NOT block video completion — fall back to HeyGen URL stored in `video_url` but mark `r2_key=NULL`. Distribute panel must hide button when `r2_key IS NULL`.
- Idempotent: re-running mirror for same video must not error or duplicate R2 objects (R2 PUT is overwrite-safe).

## Architecture

### Data flow (post-Wave 17)

```
FREE100 Inngest path:
  AiPromptForm → generateVideoAction → engine_missions(pending)
    → emitVideoGenerate → videoGenerate Inngest fn
    → step6 mux-audio-video → R2://video-jobs/{missionId}/final.mp4
    → step7 update-mission(engine_missions.output_video_url=R2_URL)
    [NEW] → step7b insert/update videos row
                (id, user_id, video_url=R2_URL, r2_key=video-jobs/{missionId}/final.mp4,
                 status='completed', heygen_job_id=NULL, source='ai-prompt')

HeyGen avatar-video path (paid bundle):
  fulfillment → createHeyGenVideo → videos(queued, heygen_job_id)
    → HeyGen webhook avatar_video.success
    → completeVideoFromWebhook → downloadAndStore → R2://videos/{userId}/{id}.mp4
    → UPDATE videos SET status='completed', video_url, r2_key
  (already works — verify only)

HeyGen mission handler:
  same as above (insert in handler, completion via webhook)
```

### Distribute resolution (used by phase 02)

```ts
// Pseudo-code for getCanonicalVideoUrl(videoId)
const row = await db.from('videos').select('video_url, r2_key').eq('id', videoId).single();
if (!row.r2_key) throw new Error('Video not yet mirrored to R2 — try again later');
const r2Host = process.env.R2_PUBLIC_HOSTNAME;
return `https://${r2Host}/${row.r2_key}`;
```

### Schema audit (mandatory before implementation)

```bash
# Verify videos table columns
npx wrangler d1 execute sophia-raas-db --command "PRAGMA table_info(videos);" --remote

# Verify expected columns exist:
#   id, user_id, heygen_job_id, title, status, video_url, thumbnail_url,
#   duration_sec, error, created_at, updated_at, r2_key, r2_size_bytes,
#   purchase_id, attempt_count, last_attempt_at, last_error, script,
#   locale, provider, access_revoked, is_onboarding

# Verify status CHECK constraint accepts the values we'll write
# (per migration 0089): 'queued','processing','completed','failed','failed_permanent'

# Verify there is NO UNIQUE constraint on heygen_job_id (or we'll need it nullable for FREE100)
npx wrangler d1 execute sophia-raas-db --command \
  "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='videos';" --remote
```

If audit reveals NOT NULL on `heygen_job_id` → add migration `0100-videos-heygen-job-id-nullable.sql`. Migration 0089 confirms it is nullable; verify on remote D1 before assuming.

## Related Code Files

### Modify

- `src/forest/inngest/functions/video-generate.ts` — add step 7b: insert into `videos` after `engine_missions.output_video_url` written. Use `provider='ai-prompt'`, `r2_key=video-jobs/{missionId}/final.mp4`, `video_url=https://${R2_PUBLIC_HOSTNAME}/${r2Key}`, `heygen_job_id=NULL`.
- `src/forest/missions/handlers/video-create.ts` — verify videos row insert is unchanged; no code change expected.
- `src/seed/db/repositories/videos-repo.ts` — add `insertAiPromptVideo({userId, missionId, r2Key, videoUrl, title?})` helper.
- `src/app/api/videos/route.ts` — verify gallery picks up new rows (no code change expected; query is already `WHERE user_id=?`).
- `src/forest/publishing/schedule-publish.ts` — add JSDoc note that HeyGen→R2 bridge is now in place; remove "Wave 17 cross-pipeline gap" warning comment.

### Create

- `src/lib/video/get-canonical-video-url.ts` — `getCanonicalVideoUrl(videoId, userId): Promise<string>` that reads `videos` row, validates ownership, returns `R2_PUBLIC_HOSTNAME`-rooted URL or throws if `r2_key` null. <50 LOC.
- `src/lib/video/__tests__/get-canonical-video-url.test.ts` — unit tests: valid r2_key, missing row, foreign user, null r2_key.

### Delete

- None.

### Migrations

- Audit-then-decide. Most likely none needed — schema already supports the fields. If `heygen_job_id` is NOT NULL on remote (mismatch with 0089), add `migrations/0100-videos-heygen-job-id-nullable.sql`. Apply via `bash scripts/apply-migrations.sh`.

## Implementation Steps

1. **Schema audit (read-only):** run wrangler queries above. Document actual column types in `plans/260509-1956-wave17-unlock-harden-cleanup/reports/scout-260509-schema-audit.md`. Block implementation if mismatches found.
2. **Add `getCanonicalVideoUrl` helper.** Reads `videos` row by id + user_id, returns `https://${R2_PUBLIC_HOSTNAME}/${r2_key}` or throws `VideoNotMirroredError`.
3. **Add `insertAiPromptVideo` repo function** in `videos-repo.ts`. Uses `db.prepare().bind().run()` (raw D1) — same style as existing `findByHeygenJobId`. Returns `videoId`.
4. **Modify `video-generate.ts` step 7:** after `engine_missions` update, call `insertAiPromptVideo({userId: tenantId, missionId, r2Key: muxOutputKey, videoUrl: muxed.url})`. Wrap in try-catch — log error but don't fail the mission (videos row is downstream concern).
5. **Update render-progress component (optional, defer if scope tight):** when `status='succeeded'`, optionally redirect user to `/dashboard/videos/{newVideoId}` instead of inline player. Decide during implementation.
6. **Verify HeyGen webhook path** — read `complete-video-from-webhook.ts` to confirm R2 mirror is wired. Add integration test if missing. No code change expected.
7. **Run vitest suite:** `npm test`. All passing. Add tests for new helper + new step.
8. **Build:** `npm run build`. 0 TS errors. <10MB bundle.
9. **Deploy:** `npm run deploy:full`. Verify SHA match.
10. **Smoke test on production:** create FREE100 video → wait for mission `succeeded` → check `videos` row exists in D1 with `r2_key` populated → fetch `/api/videos` → confirm row appears.

## Todo List

- [ ] Schema audit on remote D1 + report
- [ ] Add `getCanonicalVideoUrl` helper + tests
- [ ] Add `insertAiPromptVideo` to videos-repo + tests
- [ ] Modify `video-generate.ts` step 7
- [ ] Update JSDoc in `schedule-publish.ts` removing cross-pipeline warning
- [ ] Verify HeyGen webhook path still mirrors to R2 (read-only audit)
- [ ] Run `npm test` — all green
- [ ] Run `npm run build` — 0 errors
- [ ] Deploy via `npm run deploy:full`
- [ ] SHA match verify (`/api/version`)
- [ ] Production smoke: create FREE100 video → confirm row in `videos` table with r2_key

## Success Criteria

- Production FREE100 video creation produces a row in `videos` with `r2_key` populated.
- `getCanonicalVideoUrl(videoId)` returns `https://${R2_PUBLIC_HOSTNAME}/...` URL that passes `assertSafeVideoUrl`.
- HeyGen webhook path unchanged + still mirrors to R2.
- All vitest + Playwright tests pass.
- Build green; SHA match verified.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `videos.heygen_job_id` NOT NULL on remote | Medium | High (blocks FREE100 insert) | Schema audit step 1 + migration 0100 if needed |
| video-generate Inngest step 7b throws → mission marked failed | Low | High (regression) | try-catch around insert, log+continue; videos row is downstream |
| R2 mirror exceeds 30s timeout for large HeyGen video | Low | Medium (mark r2_key=NULL fallback) | Existing path already handles this; verify still in place |
| Race: distribute panel queries video before `r2_key` populated | Medium | Low | Phase 02 disable button when `r2_key IS NULL` |
| Bundle size grows >10MB | Low | Medium | Reuse helpers; no new deps |

## Security Considerations

- `assertSafeVideoUrl` allowlist remains strict — `R2_PUBLIC_HOSTNAME` only. NO loosening.
- `getCanonicalVideoUrl` enforces ownership check (`videos.user_id = current_user.id`) before returning URL.
- R2 bucket policy unchanged — public read is acceptable for video objects (already in production).
- No new secrets / env vars introduced.

## Next Steps

- Phase 02 depends on this: distribute panel + publishExecute lookup will use `getCanonicalVideoUrl` instead of `video_jobs.final_r2_key`.
- Phase 03 depends transitively (cannot flip flag until 01 + 02 ship).

## Completion Notes (2026-05-09)

**Status:** ✅ Complete. All implementation steps executed; 3045/3045 tests pass.

**Files Created:**
- `src/lib/video/get-canonical-video-url.ts` (108 LOC) — canonical R2 URL resolver with ownership check
- `src/lib/video/__tests__/get-canonical-video-url.test.ts` (5 tests)

**Files Modified:**
- `src/seed/db/repositories/videos-repo.ts` — added `insertAiPromptVideo({userId, missionId, r2Key, videoUrl, videoTitle?})` helper (32 LOC in step 7b)
- `src/forest/inngest/functions/video-generate.ts` — step 7b inserts `videos` row after engine_missions update (idempotent; uses missionId as deterministic videoId)
- Comments updated in `schedule-publish.ts` removing cross-pipeline gap warning

**Schema Audit:**
- Remote D1 confirmed: `videos.heygen_job_id` is nullable (migration 0089 applied correctly)
- No additional migrations needed
- All expected columns present

**Critical Fixes Applied:**
- C1 (deterministic videoId): missionId used as videos.id to avoid collision with HeyGen flows and ensure idempotency
- C2 (error handling): try-catch wraps insertAiPromptVideo; real D1 throws caught (replaced fictional `result.error` check from stub)
- Ownership validation in getCanonicalVideoUrl

**Tests:**
- +8 new tests (pipeline-bridge + canonical-video-url coverage)
- All 3045 tests pass (was 3018 Wave 16 baseline, net +27)

**Unresolved**
- Does the existing video gallery `/api/videos` need a UI tweak to show `provider='ai-prompt'` videos differently from HeyGen avatar videos? (Ask UX during implementation. Default: no — same card.)
- Should mission `succeeded` redirect user to `/dashboard/videos/{newId}` automatically? (UX decision; defer to step 5 during implementation.)
