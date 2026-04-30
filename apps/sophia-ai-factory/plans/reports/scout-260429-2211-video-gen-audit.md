# Video Gen End-to-End Audit

## Files Reviewed
- `src/app/api/videos/route.ts` (63 lines) — List/create endpoints
- `src/app/api/videos/[id]/route.ts` (46 lines) — Get by ID
- `src/app/api/heygen/create-video/route.ts` (86 lines) — HeyGen create
- `src/app/api/heygen/status/[id]/route.ts` (109 lines) — Status polling (GET)
- `src/app/api/heygen/avatars/route.ts` (19 lines) — Avatar list
- `src/app/api/heygen/voices/route.ts` (20 lines) — Voice list
- `src/app/api/scripts/generate/route.ts` (104 lines) — Script generation (LLM)
- `src/lib/heygen/heygen-client.ts` (225 lines) — HeyGen API wrapper
- `src/lib/services/factory.ts` (123 lines) — Service factory + BYOK resolution
- `src/lib/services/real/video-service.ts` (52 lines) — Real video service
- `src/app/api/cron/video-status-sync/route.ts` (150+ lines) — Async cron poll
- `src/app/api/webhooks/heygen/route.ts` (120 lines) — HeyGen webhook
- `src/lib/video/video-storage-service.ts` (77 lines) — R2 storage
- UI components: script-step, asset-picker, video-creator-wizard, render-status
- Tests: route.test.ts for videos/scripts, api-routes.test.ts for HeyGen
- DB migrations: 0024-videos.sql, 0030-videos-r2-key.sql

## Flow Diagram (ASCII)

```
User clicks "Generate Video" (UI)
    ↓
POST /api/scripts/generate (LLM)
    ├─ getCurrentUser() + getUserTier()
    ├─ selectModelForTier() → openrouter/anthropic routing
    ├─ resolveUserApiKey('openrouter', userId) — BYOK or env
    ├─ callWithCache() → LLM + usage tracking
    └─ Return: { requestId, content: {hook, body, cta}, metadata }
    ↓
User picks avatar/voice, clicks "Create Video"
    ↓
POST /api/heygen/create-video
    ├─ getCurrentUser()
    ├─ Validate: avatarId, voiceId, script, title
    ├─ ServiceFactory.getVideoService(userId)
    │   └─ resolveHeygenKey(userId) → BYOK user key or env HEYGEN_API_KEY
    ├─ HeyGenClient.createVideo()
    │   └─ POST https://api.heygen.com/v2/video/generate
    │   └─ trackUsage()
    ├─ db.insert({ heygen_job_id, status: 'processing' })
    └─ Return: { videoId: heygenJobId, status: 'processing' }
    ↓
Client polls status (5s interval) — render-status.tsx
    ↓
GET /api/heygen/status/{id}
    ├─ getCurrentUser()
    ├─ Verify ownership (heygen_job_id matches user_id)
    ├─ HeyGenClient.getVideoStatus() — sync call to API
    ├─ If terminal (completed|failed): db.update()
    └─ Return: { status, video_url, thumbnail_url, duration_sec, error }
    ↓
[Async fallback] Every 5 min cron runs:
    ↓
GET /api/cron/video-status-sync (verifyCronAuth)
    ├─ SELECT videos WHERE status='processing' LIMIT 50
    ├─ For each: HeyGenClient.getVideoStatus()
    ├─ If terminal: downloadAndStore() to R2
    ├─ db.update() with r2_key, r2_size_bytes
    ├─ If 24h timeout: mark failed
    └─ recordCronRun()
    ↓
[Alternative] HeyGen webhook arrives:
    ↓
POST /api/webhooks/heygen
    ├─ Verify HMAC-SHA256 signature
    ├─ Parse payload: { video_id, status, video_url, ... }
    ├─ Normalize status → (completed|failed|processing)
    ├─ db.update() videos table
    └─ Return: 200 always (prevent retry storms)
```

## ✅ What Works

1. **BYOK Resolution** — Per-user API keys resolved correctly
   - `ServiceFactory.resolveHeygenKey()` checks user key first (D1) → env fallback
   - LLM routing: selectModelForTier() picks openrouter or anthropic
   - Usage tracking hooks are present (heygen-client.ts:136-149)

2. **Script Generation** — Tier-gated & validated
   - GET /api/scripts/generate enforces tier >= BASIC (route.ts:34)
   - Zod validation on input (generateScriptSchema)
   - selectModelForTier() ensures ENTERPRISE → Sonnet, others → GPT-4o-mini
   - Server-resolved tier defense (line 58: effectiveTier, ignoring client)

3. **Video Creation** — Error handling + persistence
   - Zod validation on avatarId, voiceId, script, title (createVideoSchema)
   - MissingCredentialsError caught → 503 (route.ts:39-44)
   - DB INSERT failure surfaces to caller (route.ts:64-72: "not persisted" message)
   - requestId ephemeral — no DB bloat

4. **Status Polling** — Dual path (client + cron + webhook)
   - Client polls /api/heygen/status every 5s (render-status.tsx:12)
   - Cron hits /api/cron/video-status-sync every 5min (fallback)
   - HeyGen webhook POST /api/webhooks/heygen (immediate)
   - HMAC-SHA256 verification on webhook (route.ts:33-51)
   - Status normalization: 'success'→'completed', 'error'→'failed'

5. **Async Long-Running** — No 30s timeout issues
   - HeyGen job submitted immediately → returns job ID
   - Status polling async (client-side 5s, server-side 5min)
   - Webhook instant if configured (not blocking)
   - Video-status-sync cron processes in batches (50 per run)

6. **R2 Storage** — Failover + durable video URLs
   - downloadAndStore() copies HeyGen temp URLs to R2 (video-storage-service.ts)
   - Graceful fallback to HeyGen URL if R2 unavailable (line 42)
   - r2_key, r2_size_bytes persisted in videos table
   - R2_PUBLIC_BASE_URL composed on GET /api/videos (route.ts:48-54)

7. **UI/UX** — Loading states + error display
   - ScriptStep: loading spinner while LLM runs
   - AssetPicker: loading skeleton while fetching avatars/voices
   - RenderStatus: spinner (processing) → video (completed) → error card (failed)
   - Error messages surfaced to user (wizard.tsx:44, render-status.tsx:46, 67)

8. **TypeScript** — Zero `any` types, proper interfaces
   - HeyGenClient, HeyGenVideoStatus, VideoStatus all typed
   - Zod schemas for runtime validation
   - No `any` in heygen, videos, scripts API code

9. **Tests** — Basic coverage
   - route.test.ts for GET /api/videos (auth, pagination, errors)
   - route.test.ts for POST /api/scripts/generate (tier validation, script output)
   - api-routes.test.ts for HeyGen endpoints (create, status, avatars, voices)

## ❌ Bugs / Gaps (PRIORITIZED P0/P1/P2)

### P0: Blocks Go-Live

1. **NO TIER GATING ON VIDEO CREATION** (CRITICAL)
   - POST /api/heygen/create-video has NO tier check
   - FREE users can spam video jobs (costs money)
   - **FIX:** Add `getUserTier()` check before ServiceFactory.getVideoService()
   - File: src/app/api/heygen/create-video/route.ts:9-46
   - Reference: src/app/api/scripts/generate/route.ts:33-39 (correct pattern)

2. **NO QUOTA ENFORCEMENT** (CRITICAL)
   - No credit/usage limit check before creating video
   - User can request 1000 videos in parallel
   - **FIX:** Call quota API or usage-metering before HeyGen.createVideo()
   - File: src/app/api/heygen/create-video/route.ts

3. **MISSING WEBHOOK SIGNAL FLAG** (HIGH)
   - heygen-webhook/route.ts assumes HEYGEN_WEBHOOK_SECRET is set
   - No fallback to cron-only mode documented
   - **FIX:** Add feature flag or graceful missing-secret handling
   - File: src/app/api/webhooks/heygen/route.ts:63-66

4. **INCOMPLETE AVATARS/VOICES ROUTE SECURITY**
   - GET /api/heygen/avatars and /api/heygen/voices only check auth
   - Should also tier-gate or rate-limit (these hit HeyGen API)
   - **FIX:** Add tier check or cache + return max 10 avatars/voices
   - Files: src/app/api/heygen/avatars/route.ts, voices/route.ts

### P1: Pre-Go-Live Should Fix

5. **BILINGUAL MISSING IN ERROR RESPONSES**
   - API errors hardcoded in English (e.g., "Unauthorized", "Invalid request")
   - Should return i18n keys or bilingual messages
   - **FIX:** Use i18n error catalog or return error codes + client translates
   - Example: return `{ error: 'ERR_UNAUTHORIZED', i18n: 'common.unauthorized' }`

6. **NO RETRY LOGIC ON HEYGEN TIMEOUT**
   - HeyGenClient.request() throws on HTTP error, no retry
   - Network hiccup = immediate 500 to client
   - **FIX:** Implement exponential backoff in HeyGenClient.request()
   - File: src/lib/heygen/heygen-client.ts:56-72

7. **MISSING VALIDATION ON TITLE LENGTH**
   - POST /api/heygen/create-video accepts any title length
   - HeyGen API might reject 10KB title
   - **FIX:** Add max 200 char constraint in createVideoSchema
   - File: src/lib/schemas (where createVideoSchema is defined)

8. **WEBHOOK SIGNATURE NOT CONSTANT-TIME VERIFIED**
   - HMAC verification uses loop + mismatch counter (good)
   - BUT: Length check first (line 46) leaks info via timing
   - **FIX:** Compare fixed-length signatures without early return
   - File: src/app/api/webhooks/heygen/route.ts:46

9. **MISSING STATUS CODE ON CRON FAILURE**
   - video-status-sync returns 200 even if ALL polls fail (summary.errors > 0)
   - Monitoring can't distinguish success from partial failure
   - **FIX:** Return 206 (Partial Content) or log to observability
   - File: src/app/api/cron/video-status-sync/route.ts (~160)

### P2: Nice-to-Have / After GA

10. **NO RATE LIMITING ON POLLING** (MEDIUM)
    - Client polls /api/heygen/status every 5s (can hammer API)
    - Should add client-side jitter + server-side rate limit
    - **FIX:** Implement rate-limiting-middleware on GET /api/heygen/status/[id]
    - Reference: src/lib/security/rate-limiting-middleware.ts

11. **NO USAGE TRACKING ON FAILED VIDEOS** (MEDIUM)
    - If HeyGen.createVideo() throws, usage not tracked
    - User gets 503 but no debit logged
    - **FIX:** trackUsage() with creditsUsed=0 on error path
    - File: src/lib/heygen/heygen-client.ts:152-167 (already done, but verify edge cases)

12. **MISSING CLEANUP FOR ORPHANED JOBS** (LOW)
    - If user deletes account, videos table keeps heygen_job_id
    - Orphaned cron polls continue forever
    - **FIX:** Add cascade delete on users or mark videos status='orphaned'

13. **NO BILINGUAL SUPPORT IN UI MESSAGES** (LOW)
    - render-status.tsx hardcodes `t()` calls (good i18n pattern)
    - But ensure all keys exist in both VI + EN translations

14. **MISSING OPENAPI / SPEC** (LOW)
    - No OpenAPI spec for video endpoints
    - Makes it hard for clients to validate requests

## Recommendations

### IMMEDIATE (Before Ship)
1. **Add tier gate to POST /api/heygen/create-video** (P0)
   ```typescript
   const tier = await getUserTier(user.id);
   if (TIER_RANK[tier] < TIER_RANK.PREMIUM) {
     return NextResponse.json({ error: 'Insufficient tier' }, { status: 402 });
   }
   ```
   Ref: src/app/api/scripts/generate/route.ts:33-39

2. **Add quota check before createVideo()** (P0)
   - Call quota API from src/lib/quota/index.ts
   - Deduct 1 credit for video generation
   - Return 402 if insufficient

3. **Fix signature verification timing leak** (P1)
   - Always compare full length, don't short-circuit on len mismatch
   - Ref: src/app/api/webhooks/heygen/route.ts:46

4. **Add retry logic to HeyGenClient.request()** (P1)
   - Exponential backoff (100ms → 200ms → 400ms, max 3 retries)
   - Only on transient errors (timeout, 429, 5xx)
   - Hard fail on 4xx (auth, validation)

### NICE-TO-HAVE (Post-GA)
5. Rate-limit polling: add to render-status.tsx (client-side jitter)
6. Webhook feature flag: handle missing HEYGEN_WEBHOOK_SECRET gracefully
7. Bilingual error responses: define error code → i18n key mapping

## Open Questions

1. **Should avatar/voice caching be per-user or global?**
   - Currently hits HeyGen API on every request
   - Proposal: Cache 5 min in memory, invalidate on user webhook

2. **What happens if HeyGen job ID collides?**
   - heygen_job_id is their UUID, shouldn't collide
   - But: What if user creates same video twice? heygen_job_id uniqueness enforced?

3. **Who owns video storage lifecycle?**
   - R2 copy happens in cron (video-status-sync)
   - But HeyGen temp URLs expire after ~48h
   - Race condition if cron delayed > 48h?
   - **FIX:** Add attempt_download_count, mark as failed if no R2 copy after 36h

4. **Is getHeyGenClient(userId) thread-safe under high load?**
   - Async getUserApiKey() called each time
   - No connection pooling / client singleton
   - If 1000 concurrent requests, each hits D1 independently
   - Proposal: Cache client per userId for 30s

5. **Bilingual video scripts?**
   - Script generator accepts topic + audience in UI language
   - But LLM receives English system prompt
   - Should script be bilingual (VI + EN narration)?
