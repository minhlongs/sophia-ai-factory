# Video-Gen Flow Audit — debugger-260519-2300-video-gen-flow.md

**Production SHA verified:** `c50716d2` ✓ (`/api/version` matches)
**Auth smoke:** `GET /api/videos` → 401 ✓ | `POST /api/videos/generate` → 401 ✓
**D1 state:** 1 row `status=completed` in `videos` table (no orphaned processing rows)

---

## Critical (must-fix before go-live)

### C-1 — Inngest pipeline will fail on ALL prod video requests: WAN_API_KEY + FISH_SPEECH_API_KEY missing

**File:** `src/forest/inngest/functions/video-generate.ts:36-43`
**Prod secrets list (wrangler secret list):** `WAN_API_KEY` ABSENT, `FISH_SPEECH_API_KEY` ABSENT, `CLOUDCONVERT_API_KEY` ABSENT

**Repro:**
1. User submits video generation form → server action emits `video/generate.requested`
2. Inngest picks up event; step `generate-tts` calls `getFishSpeechClient()` → throws `[videoGenerate] FISH_SPEECH_API_KEY not configured`
3. Inngest retries 2× (retries: 2), then exhausts. `engine_missions` row stays `status=pending` forever.
4. SSE stream shows spinner until timeout (5 min). User sees stuck progress with no error.

**Severity:** ALL video generations fail silently on prod. Zero videos can be created.

**Fix:**
```bash
wrangler secret put WAN_API_KEY --name sophia-ai-factory
wrangler secret put FISH_SPEECH_API_KEY --name sophia-ai-factory
wrangler secret put CLOUDCONVERT_API_KEY --name sophia-ai-factory
```
Note: Without CLOUDCONVERT_API_KEY, step 6 (mux) falls through to a stub mp4 (not a crash), so the minimum viable fix for a partial go-live is WAN_API_KEY + FISH_SPEECH_API_KEY. Stub mux will produce a silent video. Add CLOUDCONVERT_API_KEY for real audio-merged output.

---

### C-2 — R2 URL rewrite dead: `r2_key` not fetched in `GET /api/videos` select

**File:** `src/app/api/videos/route.ts:34-53`

```ts
// Line 34-38: select excludes r2_key
.select("id, title, status, video_url, thumbnail_url, duration_sec, heygen_job_id, created_at")

// Line 50: v.r2_key is always undefined
if (r2Base && v.r2_key) {
  return { ...v, video_url: `${r2Base}/${v.r2_key}` };  // NEVER reached
}
```

**Repro:** Videos stored to R2 (post-cron sync or post-Inngest) will always return stale HeyGen CDN URL in the list endpoint. HeyGen CDN URLs expire — completed videos become unwatchable via the gallery.

**Fix:** Add `r2_key` to the select list:
```ts
.select("id, title, status, video_url, thumbnail_url, duration_sec, heygen_job_id, created_at, r2_key")
```
Also confirm `R2_PUBLIC_BASE_URL` secret is set — currently absent from prod secrets. Without it the rewrite still won't fire even after the select fix.

---

## High (should-fix)

### H-1 — SSE stream closes (5 min) before Inngest pipeline can complete (6+ min)

**File:** `src/app/api/v1/missions/[id]/stream/route.ts:31`
**File:** `src/forest/inngest/functions/video-generate.ts:31-32`

```ts
// SSE hard close
const MAX_DURATION_MS = 5 * 60 * 1000;  // 300s

// Inngest poll: 18 polls × 20s = 360s minimum for Wan job alone
const POLL_INTERVAL_MS = 20_000;
const POLL_MAX_ATTEMPTS = 18;  // 360s = 6 min
// Plus: TTS step, download, Cloudconvert mux (each 5-30s)
// Total pipeline: realistically 7-10 min for slow Wan jobs
```

**Repro:** Slow Wan job → SSE closes at 5 min → browser shows `timeout` event → user retries → duplicate mission created (quota leaked +1, no compensation). Mission eventually succeeds but user never sees it.

**Fix:** Increase `MAX_DURATION_MS` to `10 * 60 * 1000` (10 min) OR implement browser-side reconnect with `Last-Event-ID` fallback (already supported by the stream route — client reconnects after timeout). Add UI guidance: "This may take 5-10 minutes, you can close this tab and check your gallery later."

---

### H-2 — `POST /api/v1/missions/[id]/generate-video` bypasses quota enforcement

**File:** `src/app/api/v1/missions/[id]/generate-video/route.ts:44-109`

No call to `reserveVideoSlot()` or `checkVideoQuota()`. Authenticated user can call this endpoint directly N times, submitting unlimited Inngest events.

**Repro:** Authenticated user sends 100 POST requests → 100 `video/generate.requested` events queued → 100 Wan jobs submitted → cost blowout.

**Fix:** Add quota reservation before the `inngest.send()` call, same pattern as `generateVideoAction`:
```ts
const tier = await getUserTier(userId);
const reservation = await reserveVideoSlot(userId, tier);
if (!reservation.reserved) {
  return NextResponse.json({ error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' }, { status: 429 });
}
```

---

## Medium (post-launch OK)

- **M-1** `VideoGallery` type declares `status: "processing" | "completed" | "failed"` but DB has `'queued'` and `'failed_permanent'` too. Both render yellow badge labeled with raw status string (`failed_permanent` visible to end users). Fix: extend the union + map `failed_permanent` → user-friendly label, `queued` → "queued" badge. File: `src/app/[locale]/dashboard/videos/components/video-gallery.tsx:13`

- **M-2** BASIC tier quota error message: `"Video quota exceeded (0/0 used this month)"` is confusing — implies they had credits and spent them. BASIC has `limit=0` by design. Fix: special-case BASIC in the action to return `"Video generation requires a paid plan. Please upgrade."` with code `UPGRADE_REQUIRED`. File: `src/app/actions/video-generate-action.ts:64-70`

- **M-3** `recordCost()` in the Inngest pipeline writes to `video_jobs` and `video_cost_log` tables (Phase 06 old schema), but passes `missionId` (which lives in `engine_missions`) as `jobId`. The UPDATE on `video_jobs` silently no-ops (no matching row). Cost tracking is dead for the AI-prompt pipeline. Non-fatal — no financial error — but operator has zero cost visibility. Fix: either write to `engine_missions.cost_usd` directly, or create a cost ledger table keyed to `missionId`. File: `src/lib/video/cost-ledger.ts:30-56`

- **M-4** Legacy webhook path (`src/app/api/webhooks/heygen/route.ts:180-202`): the flat-structure event handler does `db.update(...).eq('heygen_job_id', heygenJobId)` without a status guard. A duplicate webhook delivery can re-write a `completed` row with potentially null `video_url` (if HeyGen sends a partial payload). F4 path (`completeVideoFromWebhook`) has proper idempotency; legacy path does not. Fix: add `.in('status', ['processing', 'queued'])` to the WHERE clause.

- **M-5** `R2_PUBLIC_BASE_URL` not set as a prod secret. Without it, videos list and video-generate pipeline both fall back to HeyGen CDN URLs (volatile, expiring). Not a crash but degrades durability. Must be set for R2 to serve as durable storage. See wrangler.toml comment line 94.

---

## Verified GOOD (do not break)

1. **Webhook signature verification** is correct HMAC-SHA256 with constant-time comparison (`verifyHeyGenSignature`). Per-customer BYOK secret resolution with platform fallback. No-secret path returns 200 + cron-poll-fallback mode (suppresses HeyGen retry storm correctly).

2. **Quota reservation is atomic.** `reserveVideoSlot()` uses a single SQL UPSERT with `WHERE count < limit` predicate — no TOCTOU race. `releaseVideoSlot()` on DB error path correctly decrements. File: `src/forest/quota/video-quota.ts:88-122`.

3. **Auth isolation on all video routes.** `GET /api/videos` scopes by `user_id`. `GET /api/videos/[id]` checks `data.user_id !== user.id` → 403. SSE stream scopes engine_missions by both `id` AND `user_id`. No cross-tenant data leak paths found.

4. **Cron-race safe.** `video-status-sync` cron only polls `WHERE status = 'processing'`; once webhook transitions to `completed`, cron never touches that row. `TERMINAL` set includes `failed_permanent` so cron-sync won't re-poll already-terminal rows.

5. **Webhook replay protection via CAS.** `completeVideoFromWebhook` and `failVideoFromWebhook` both guard on current status before mutating. `markPermanentFailureCAS` uses `WHERE status = 'queued' AND attempt_count >= N` — concurrent webhook + cron can't double-email or double-compensate.

---

## Score: 54/100

| Subsystem | Score | Notes |
|---|---:|---|
| Auth/isolation | 9/10 | All routes properly scoped |
| Quota enforcement | 5/10 | H-2: API route bypasses quota |
| HeyGen webhook | 8/10 | Signature good; legacy path lacks idempotency |
| Cron sync | 8/10 | Correct, no race |
| R2 storage | 2/10 | URL rewrite dead (C-2), R2_PUBLIC_BASE_URL missing |
| Inngest pipeline | 1/10 | C-1: zero keys → 100% fail rate |
| SSE/UI progress | 6/10 | H-1: timeout before pipeline finishes |
| Cost tracking | 2/10 | M-3: writes wrong table |
| Gallery/UX | 6/10 | M-1, M-2: type gaps + bad error message |
| DB schema | 9/10 | Good migration history, no FK traps |

**Verdict: NO-GO.** Two critical blockers prevent go-live:
- **C-1**: 100% of video generations fail — API keys not provisioned in prod
- **C-2**: R2 URL rewrite silent dead-letter + `R2_PUBLIC_BASE_URL` unset — videos revert to expiring HeyGen URLs after cron/Inngest stores to R2

Fix C-1 + C-2 first, then H-2 (quota bypass). H-1 is a UX degradation, not a data-corruption risk — can ship with guidance text.

---

## Unresolved Questions

1. Is the `sophia-videos` R2 bucket already created in Cloudflare? (`wrangler r2 bucket list` to confirm). Wrangler.toml declares `bucket_name = "sophia-videos"` but if not yet created, R2 writes in `video-status-sync` + Inngest will throw `NoSuchBucket`.
2. What are the actual WAN_API_KEY / FISH_SPEECH_API_KEY providers? The code references `WanVideoClient` and `FishSpeechClient` — are these APIs live and funded?
3. The `style` field (`cinematic`/`casual`/`educational`) is stored in `engine_missions.params` JSON but the Inngest function ignores it. Intentional? If style should affect Wan prompt, add extraction in step 1.
4. `CLOUDCONVERT_API_KEY` absent → stub mp4 only. Is stub output acceptable for MVP go-live (user gets video file with voiceover but no visual), or must real mux work for launch?
