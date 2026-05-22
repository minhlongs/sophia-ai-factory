# E2E Code Review — OpenClaw Video Creation & Distribution

Date: 2026-05-22
Reviewer: code-reviewer (staff engineer pass)
Scope: Sophia ↔ OpenClaw token + gateway + skill loader + `auto-video-mission` + render-byok + publish + telegram bridge + APIs.

---

## Top 3 Bugs to Debug NOW

1. **P0 — Plaintext OAuth tokens stored by `register-publishing-channel`**, but `publish-execute.ts:328` calls `decryptToken()`. Any publishing channel registered through the new OpenClaw REST surface (POST `/api/publish/channels`) → worker decrypt throws → job fails permanently. Migration mismatch between cycles.
2. **P0 — SSRF in `clone-voice.ts:83`** (`fetch(url)` on attacker-supplied audio URL, zero allowlist). Lets a logged-in caller probe CF Worker internals, AWS metadata IP, intranet — same class of risk that `publishExecute.assertSafeVideoUrl` was added to fix; not applied here.
3. **P1 — Auth surface inconsistency**: `/api/publish/schedule`, `/api/publish/status/[jobId]`, `/api/videos/generate`, `/api/videos/status/[jobId]` use `getCurrentUserFromHeaders` (cookie-only) while the rest of the OpenClaw plugin surface uses `getCurrentUserOrOpenclawBearer`. OpenClaw plugin cannot reach these endpoints via Bearer → contract gap vs `openclaw-bridge.ts` which exposes the same algorithms.

---

## Actual E2E Sequence (ASCII)

```
[ Browser session ]
        │ POST /api/openclaw/exchange  (cookie auth)
        ▼
  exchange/route.ts ── HMAC(BETTER_AUTH_SECRET) ──►  token = userId.exp.sig
                                                          │
                                                          ▼
                                  ┌── OpenClaw plugin (Bearer) ──┐
                                  │                              │
                ┌─────────────────┴──────────────────┐           │
                ▼                                     ▼           ▼
   /api/videos (Bearer OK)        /api/publish/schedule (Bearer ✗)
   /api/publish/quick-schedule    /api/videos/generate    (Bearer ✗)
   /api/publish/channels          /api/publish/status/[id] (Bearer ✗)
        │
        │  callRunAutoVideoMission OR direct API
        ▼
  auto-video-mission.ts
   ├─ insertMissionRow (engine_missions, status=running)
   ├─ generateSeoScript (BYOK OpenRouter)
   ├─ translateScript    (optional, BYOK)
   ├─ buildVideoDescription (affiliate enrich)
   ├─ submitByokVideo (HeyGen submit) ──► videos row status=processing
   │     └── on BYOK_REQUIRED: SOFT-SKIP, videoId fallback = missionId  ⚠
   └─ schedulePublish (optional)
         ├─ RBAC: video.user_id == userId
         ├─ RBAC: channel.user_id|tenant_id == userId
         └─ INSERT publishing_jobs (status=scheduled)
                  │
                  ▼
         inngest 'publish.scheduled'  ◄── NOT EMITTED by land/publish/schedule-video-publish.ts ⚠
         (only forest/publishing/schedule-publish.ts emits)
                  │
                  ▼
         publishExecute (CAS: scheduled→uploading)
           ├─ decryptToken(channel.access_token)   ⚠ fails if registered via OpenClaw REST
           ├─ assertSafeVideoUrl(R2_PUBLIC_HOSTNAME only)
           └─ provider.publish() → status=live | failed (retry 3×)
```

⚠ Marks the chokepoints.

---

## Findings

### P0 — Critical

| # | File:Line | Issue |
|---|-----------|-------|
| F1 | `src/land/publish/register-publishing-channel.ts:121-123, 154-156` | `access_token`, `refresh_token` inserted **plaintext** into `publishing_channels`. `publish-execute.ts:328, 457, 492` and `oauth-token-refresher.ts:167-168` call `decryptToken(channel.access_token)` → guaranteed decrypt failure on any channel registered via this code path. Fix: `await encryptToken(input.accessToken)` and `input.refreshToken ? await encryptToken(input.refreshToken) : null` in BOTH INSERT and UPDATE branches. Also leaks secrets if D1 exfiltrated. |
| F2 | `src/land/voice/clone-voice.ts:82-96` | `fetch(url)` on user-supplied `audioUrls` with **no host allowlist, no IP filter, no scheme check**. SSRF: attacker reads internal services (metadata IP `169.254.169.254`, `localhost`, R2 internal hostnames, CF service endpoints) and exfiltrates content via ElevenLabs upload. Same author added `assertSafeVideoUrl` in `publish-execute.ts:53-64` — apply identical guard here (env-driven allowlist of media hostnames; reject everything else). |
| F3 | `src/lib/openclaw/skill-loader.ts:62-65, 86-100` | Path traversal: `resolveSkillPath(name, base)` does raw `${base}/${name}/SKILL.md`. If `activateSkill` ever receives a name from request input (currently internal but the export is public via `src/lib/openclaw/index.ts:24`), `../../../etc/passwd` escapes. Add `if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(name)) throw` before resolution. Defense in depth even if today callers are internal. |

### P1 — High

| # | File:Line | Issue |
|---|-----------|-------|
| F4 | All four routes listed in "Top 3 #3" | Bearer/cookie split breaks plugin parity. Standardize on `getCurrentUserOrOpenclawBearer`. |
| F5 | `src/app/api/openclaw/exchange/route.ts:60-93` | No rate limit on token mint. Compromised session cookie → attacker mints unlimited 7-day tokens (line 31: `MAX_TTL_SECONDS = 7 * 24 * 3600`). Stateless verifier (`openclaw-token.ts:11-14`) explicitly states "Compromised tokens remain valid until expiry; rotate `BETTER_AUTH_SECRET` to invalidate all". Combined with no mint cap, this is an amplification primitive. Mitigations: (a) per-user mint quota in KV; (b) revocation table keyed by `jti` minted into the token; (c) cap default TTL to 24h not 7d. |
| F6 | `src/land/missions/auto-video-mission.ts:228` | `videoId: videoResult?.videoId ?? missionId` — falls back to **missionId** (a 32-hex string that is NOT a videos row id) when HeyGen is soft-skipped. `schedulePublish` then throws `VIDEO_NOT_FOUND`. Caught at lines 234-240 and logged warn, but mission still returns `status: 'succeeded'` with `publish: undefined`. Caller cannot distinguish "no publish requested" vs "publish silently failed". Fix: when `videoResult` is undefined AND `input.channelId` was provided, set `result.publish = { skipped: true, reason: 'NO_VIDEO' }` so the caller surfaces it. |
| F7 | `src/lib/publishing/scheduler.ts:53-58` + `src/land/publish/schedule-video-publish.ts:107-115` | Two implementations of "schedule publish" with subtly different contracts: forest one uses tenant_id+status='active' filter and emits Inngest `publish.scheduled` event; land one uses tenant_id|user_id OR fallback, does NOT emit Inngest event. The "land" path therefore **inserts a publishing_jobs row but never wakes the publishExecute worker** → job sits at `status='scheduled'` forever unless the worker polls (it doesn't — it's event-driven). Either: (a) add `inngest.send('publish.scheduled', ...)` to `schedule-video-publish.ts` after the insert, or (b) ensure a cron sweeper exists. Verify against current Inngest topology. |
| F8 | `src/tree/gateway/openclaw-gateway.ts:84-116` | `Promise.allSettled` over `publishWithRetry` for N channels with up to 3 sequential retries each, `maxDelayMs = 30000`. Worst case = 30s × 3 × N parallel = 90s of waiting *per channel sequentially in `selfHeal` at line 153-165*. `selfHeal` loops `for ... const result = await this.publishWithRetry(...)` (serial, not parallel) — N=10 failed channels worst-case = 900s, well past CF Worker 30s CPU budget. Either parallelize selfHeal (Promise.allSettled like `distribute`) or hand off retries to Inngest. |
| F9 | `src/lib/openclaw/skill-loader.ts:23-24` | `_cache` is a module-scope Map. In CF Workers an isolate can serve many tenants. The cache is keyed by `name` only — fine since skill content is global, but if `ctx` ever influences resolution it must be excluded from cache key (currently is). Acceptable today; flag for future. |

### P2 — Medium

| # | File:Line | Issue |
|---|-----------|-------|
| F10 | `src/seed/auth/openclaw-token.ts:85` | Secret resolution: `BETTER_AUTH_SECRET || JWT_SECRET`. If `JWT_SECRET` is rotated independently, token validity flips. Pick one canonical secret and remove the OR-fallback; if both exist and differ, fail closed. |
| F11 | `src/land/missions/auto-video-mission.ts:96` | `JSON.stringify({ ...params, userId: undefined })` — `userId: undefined` removed at serialize, OK. But params is whole input including possibly large `keywords`. Cap params size before persisting (engine_missions row bloat). |
| F12 | `src/land/missions/auto-video-mission.ts:147-241` | No mission-level idempotency. Two concurrent `/auto fashion 2026` from Telegram + dashboard = two missions, two HeyGen renders (BYOK quota burn), two publish jobs. Accept `idempotencyKey` from caller; INSERT ON CONFLICT short-circuit. |
| F13 | `src/tree/gateway/openclaw-gateway.ts:110` | `track(D1Events.AGENT_DISPATCH, 'system', ...)` — `'system'` is hardcoded as actor. Loses tenant attribution for analytics. Pass `content.tenantId` or `content.userId` if available on `CampaignOutput`. |
| F14 | `src/land/publish/schedule-video-publish.ts:53` | `MIN_LEAD_TIME_SEC = 0` allows scheduling at `nowSec` exactly. Cron pickup may miss until next tick, manifesting as "scheduled" rows that sit briefly. Documented in comment; OK. |
| F15 | `src/land/openclaw-telegram/openclaw-bridge.ts:115-145` | `callGetTier` issues 3 sequential D1 reads (`user_profiles`, `user`, `raas_licenses`). Edge function latency. Combine into one query with JOIN or run in `Promise.all`. |
| F16 | `src/land/openclaw-telegram/openclaw-bridge.ts:124-127` | `JSON.parse(profile.settings)` swallows errors silently. Log at debug level so corrupt rows surface. |
| F17 | `src/seed/auth/openclaw-token.ts:122-126` | D1 user lookup on every Bearer-authenticated request. No KV cache. For high-rate plugin polling (e.g. video status), this is a hot path. Add 60s KV cache keyed by `verified.userId`. |
| F18 | `src/lib/publishing/scheduler.ts:65` | Throws raw `Error` with channel ids — caller can't structurally distinguish "not owned" vs "deleted" vs "wrong status". Use typed error subclass. |

### P3 — Low

| # | File:Line | Issue |
|---|-----------|-------|
| F19 | `src/land/missions/auto-video-mission.ts:78-82` | UUID-ish via random bytes hex. Use `crypto.randomUUID()` for consistency with other modules (`render-byok-video.ts:47`). |
| F20 | `src/tree/gateway/openclaw-gateway.ts:38-40` | `setTimeout`-based sleep in retry. In CF Workers, holding a Promise for 30s consumes wall-clock; better to move retries to Inngest steps. Already noted F8. |
| F21 | `src/land/publish/schedule-video-publish.ts:115` | `owns = channel.user_id === input.userId || channel.tenant_id === input.userId`. Comment says "older D1 snapshots"; add migration note and TODO to converge on one column to avoid future drift. |

---

## Failure-Mode Red Team

| Scenario | Current Behavior | Verdict |
|---|---|---|
| OpenClaw skill timeout / 5xx | Not visible in this flow — skill-loader is fs-only, no HTTP. OK. | OK |
| Telegram bridge crash mid-publish | `callSchedulePublish` returns typed result; bridge catches `PublishConfigurationError`. publishing_jobs row already inserted by `schedulePublish` BEFORE error path → potential orphan row if Inngest dispatch fails. **F7 covers this.** | ⚠ |
| Schedule cron double-fire | `publishExecute` uses CAS on `status='scheduled'` (line 224-232, `meta.changes ?? 0`). Single-flight enforced. | OK |
| HeyGen quota exhaustion | `submitByokVideo` throws `HEYGEN_SUBMIT_FAILED`; mission marks failed; UX visible. | OK |
| Mission re-run after partial failure | No resume primitive. Re-run starts fresh, re-burns BYOK quota for script/translate. **F12 covers.** | ⚠ |
| Two workers pick same job | CAS-protected. | OK |
| Token leaked via log | `publish-execute.ts:43-50` redacts Bearer/access_token/refresh_token in error sanitizer. `openclaw-bridge.ts:533` logs only `Error.message`. **register-publishing-channel.ts:161-163 logs `{userId, provider}` only — OK.** But `schedule-video-publish.ts:144-148` logs `{userId, videoId, channelId}` — no token, OK. | OK |
| File-upload-policy at publish path | `src/seed/security/file-upload-policy.ts` exists but is NOT applied in `render-byok-video.ts`, `clone-voice.ts`, or video pipeline. **F2 covers SSRF; size/MIME enforcement also missing for HeyGen submit.** | ⚠ |

---

## Test Coverage Map

| Step | Tests Present | Gap |
|---|---|---|
| Token mint/verify | `seed/auth/__tests__` exists (not opened) | Verify rate-limit case (F5) once added |
| Gateway distribute/selfHeal | `openclaw-gateway.test.ts` | Missing: serial selfHeal timeout (F8) |
| Skill loader | (no test seen in scope) | Add path traversal rejection (F3) |
| auto-video-mission | `auto-video-mission.test.ts` | Missing: BYOK soft-skip + `channelId` set → publish=undefined contract (F6) |
| render-byok-video | `render-byok-video.test.ts` | Missing: HeyGen 5xx + persist-row failure unwind |
| schedule-video-publish | `schedule-video-publish.test.ts` | Missing: Inngest event NOT emitted assertion (F7) |
| register-publishing-channel | `register-publishing-channel.test.ts` | **CRITICAL gap: no encrypt round-trip test → F1 slipped through.** Add: `expect(stored.access_token).not.toBe(plaintext)`. |
| openclaw-bridge | `openclaw-bridge.test.ts` | Acceptable surface coverage |
| Voice clone | (not seen in scope) | Missing: SSRF rejection cases (F2) |

---

## Positive Observations

- HMAC token verifier uses constant-time string compare (`openclaw-token.ts:69-76`). Good.
- `publishExecute` SSRF guard + Bearer redaction sanitizer is solid prior-art.
- `runAutoVideoMission` graceful soft-skip for HeyGen BYOK_REQUIRED preserves user flow.
- Worker CAS on `publishing_jobs` claim is the right primitive for at-least-once dispatch.
- Zod schemas on every public API; no `: any`, no `console.*`, no `@ts-ignore` in scope.
- Errors typed via subclasses (`PublishConfigurationError`, `AutoVideoMissionError`, etc.) with discriminated `code`.

---

## Recommended Actions (priority order)

1. **(F1) Encrypt tokens in `register-publishing-channel.ts` — TODAY**, add migration to backfill any plaintext rows.
2. **(F2) Add `assertSafeAudioUrl` allowlist guard in `clone-voice.ts:82`** mirroring publishExecute.
3. **(F7) Emit `inngest.send('publish.scheduled', ...)` from `land/publish/schedule-video-publish.ts`** after insert — otherwise jobs are orphaned.
4. **(F4) Switch `/api/publish/schedule`, `/api/publish/status/[id]`, `/api/videos/generate`, `/api/videos/status/[id]` to `getCurrentUserOrOpenclawBearer`.**
5. **(F3) Validate skill name regex before path resolution.**
6. **(F5) Add KV-backed rate limit (e.g. 10/hour/user) on `/api/openclaw/exchange` + cap default TTL to 24h.**
7. **(F6) Return `publish.skipped` shape from `auto-video-mission` when video render was soft-skipped but channelId requested.**
8. **(F8) Parallelize `OpenClawGateway.selfHeal` or move retries to Inngest.**

---

## Unresolved Questions

1. Is `engine_missions` table schema confirmed to have `id, user_id, command, params, status, result, error, completed_at, updated_at` columns? (not verified in this review).
2. Is `videos.r2_key` populated synchronously by HeyGen webhook or asynchronously? If async, `publishExecute → getCanonicalVideoUrl` will race against schedule.
3. `oauth-token-refresher.refreshChannelToken` is called by publishExecute when expiry is within 1h — does it re-encrypt before persisting? (F1 fix must verify this path doesn't double-encrypt.)
4. Telegram bridge's `callRunAutoVideoMission` does not enforce per-user concurrency limit — does the underlying Telegram handler enforce one-mission-at-a-time? (likely; not verified here.)
5. Is `/api/v1/videos/[id]/distribute` (spotted via grep) the canonical multi-channel dispatch endpoint, or legacy? Not in original scope.
6. `R2_PUBLIC_HOSTNAME` env present in prod? `publishExecute:54` defaults to `pub-placeholder.r2.dev` — if env unset, SSRF guard whitelists a placeholder.
