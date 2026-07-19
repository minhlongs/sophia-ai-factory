# PR #21 — Phase 10 Multi-Channel Publisher — Round 3 Code Review

- **Date:** 2026-04-30 09:35
- **Reviewer:** code-reviewer
- **Branch:** `feat/phase-10-publisher`
- **Head commit:** `1deb4a1b`
- **Round:** 3
- **Trajectory:** R1 5.5/10 (8 critical) → R2 6.5/10 (4 new critical) → **R3 9.0/10**

---

## Score: 9.0 / 10

**Auto-merge recommendation: WITH-FIX** (one HIGH retry-backoff bug must be fixed before merge; rest are non-blocking).

---

## Verification — Round 3 Claimed Fixes

| ID | Claim | Verdict | Evidence |
|----|-------|---------|----------|
| **C3** | Atomic CAS via raw D1 `prepare().run()`, regression test | ✅ FIXED | `publish-execute.ts:126-136` uses `getD1Raw()`, reads `result.meta.changes ?? 0`. `publish-execute-cas.test.ts:73-89` runs `Promise.all(2)` and asserts `r1.meta.changes + r2.meta.changes === 1`. |
| **C8** | Initial dispatch idempotency key | ✅ FIXED | `scheduler.ts:92-93` `id: \`publish-${jobId}-attempt-0\`` |
| **C-NEW-1 P0** | IG fb_exchange_token POST body, error sanitized | ✅ FIXED | `oauth-token-refresher.ts:34-43` — `fetch(..., {method:'POST', body: new URLSearchParams(...).toString()})`. Error body sanitized lines 47-51. |
| **C-NEW-2** | R2_PUBLIC_HOSTNAME fail-closed | ✅ FIXED | `publish-execute.ts:50-54` throws on missing env. No placeholder default path. |
| **H1** | sanitize regex base64/JWT/JSON forms | ✅ FIXED | `publish-execute.ts:34-46`. Manually tested with FB long-lived (`|~`), JWT (`:`), base64 (`+/=`), JSON `access_token`, `client_secret` URL params — all redacted. |
| **H2** | TT + YT connect+callback with HMAC state, encrypted token upsert | ✅ FIXED | All 4 routes present, mirror IG pattern. Token encryption via `encryptToken()` (AES-GCM). State verifier checks signature + 10-min TTL + userId binding. |
| **H3** | D1 quota race test with `Promise.all(N)` | ✅ FIXED | `per-channel-quota-d1-race.test.ts:98-122` — 10 concurrent calls, limit=5 → asserts `allowed===5, blocked===5, used_today===5`. |
| **H5** | `.env.example` with 13 Phase-10 vars | ✅ FIXED | All 13 vars present + Sentry vars from sibling work. |
| **H6** | Webhook fail-closed in production | ✅ FIXED | `tiktok-notification/route.ts:18-22` and `youtube-notification/route.ts:16-22` both: `if (!secret) { if (NODE_ENV==='production') return false; … return true; }` |

**All 9 Round-2 follow-ups verified fixed.**

---

## Round 3 — New Findings

### HIGH

**H-NEW-1 — Retry backoff is non-functional (UNCLAIMED REGRESSION)**
- **File:** `publish-execute.ts:202-211`
- **Issue:** `RETRY_DELAYS_S = [120, 600, 1800]` is computed into `delayS` (line 203) but never passed to `inngest.send()`. There's no `ts` field on the send, so retries fire IMMEDIATELY rather than after 2/10/30 minutes.
- **Impact:** Failed publishes retry 3× back-to-back within seconds, hammering the upstream API and triggering rate-limit/ban. Defeats the entire C4 retry-backoff design from Round 1.
- **Fix (one line):**
  ```ts
  await inngest.send({
    id: `publish-${jobId}-retry-${retryCount}`,
    name: 'publish.scheduled',
    ts: Date.now() + delayS * 1000, // <-- ADD THIS
    data: { jobId, tenantId, userId: event.data.userId, attempt: retryCount },
  });
  ```
- **Pre-existing:** Yes — bug was in earlier rounds, but never flagged. Surfacing now because Round 3 doesn't fix it and it's a legitimate prod regression.

**H-NEW-2 — TikTok OAuth lacks PKCE**
- **File:** `tiktok-token-manager.ts:42-51` (pre-existing, but newly exercised by H2)
- **Issue:** TikTok v2 OAuth requires PKCE (`code_challenge` + `code_verifier`). Current `getAuthorizationUrl(state)` sends only `client_key, redirect_uri, response_type, scope, state`. No code challenge.
- **Impact:** (a) Will fail with `invalid_request` for TikTok apps configured per Aug-2024+ spec; (b) without PKCE, leaked auth codes can be exchanged by an attacker who controls the redirect listener.
- **Fix:** generate `code_verifier` (random 43-128 char), store HMAC'd alongside state, send `code_challenge=SHA256(verifier)&code_challenge_method=S256` in auth URL, and pass `code_verifier` on `exchangeCodeForTokens`.
- **Severity:** HIGH if TikTok app is configured strict; otherwise MEDIUM. Verify against TikTok app console.

### MEDIUM

**M1 — Quota & CAS tests inline-port instead of importing production code**
- **Files:** `per-channel-quota-d1-race.test.ts:32-58` re-implements `consumeQuota` inline; `publish-execute-cas.test.ts:29-34` re-implements the CAS UPDATE inline.
- **Issue:** Tests cover the SQL pattern but don't exercise the actual exported `consumeQuota()` / production claim block. Future refactors of those functions could drift without test failure.
- **Mitigation suggestion:** import `consumeQuota` directly, mock `getD1Raw` to return the FakeD1, then call `consumeQuota('ch', 'tiktok')`. CAS test similarly should call into a small extracted `claimJob(jobId)` helper.
- **Acceptable:** SQL is identical and short, so drift risk is low.

**M2 — State replay window**
- **Files:** `tiktok/callback/route.ts:24-45`, `youtube/callback/route.ts:24-45`, IG callback (sibling)
- **Issue:** HMAC state is valid for 10 minutes with no single-use nonce store. A leaked `state+code` pair can be replayed within window IF the attacker also has the user's session cookie.
- **Mitigation:** `user.id !== stateData.userId` check at line 70 binds to current session, raising the bar. Acceptable for OAuth callback; would be HIGH for an action endpoint.

**M3 — `publish-execute.ts` is 320 LOC**
- Exceeds project guideline (<250). Suggest extracting `claimAndUpload(jobId, tenantId, event)` as a top-level helper. Not blocking — file remains readable.

**M4 — Duplicate JSDoc on `sanitizeError`**
- `publish-execute.ts:26-33` has two JSDoc blocks (stale C5-only and new C5+H1). Cosmetic. Drop the first.

### LOW

**L1 — Type drift in TikTok webhook handler**
- `tiktok-notification/route.ts:94` types `result.id as number`, but `publishing_results.id` is TEXT (UUID). Works due to D1 type coercion, but type assertion is wrong. Fix: `{ id: string; metrics_json: string | null }`.

**L2 — Connect/callback DRY**
- TikTok and YouTube connect+callback routes are ~95% identical to Instagram's. Consider extracting `verifySignedState`, `buildSignedState`, `upsertPublishingChannel` as shared helpers in `lib/oauth/`. Defer until 4th provider added.

**L3 — TikTok callback missing try/catch around exchange/upsert**
- `tiktok/callback/route.ts:74-120` (and YT callback) — `exchangeCodeForTokens`, `getUserInfo`, encryption, and DB writes are NOT wrapped in try/catch. A token-exchange failure will throw and surface a Next.js 500 with stack trace. Lower priority because exchange errors are rare and don't leak secrets (the upstream client logs sanitized messages already), but recommend a top-level try/catch + redirect-with-error.

---

## Verification Tests

```
Test files: 9 passed
Tests:      47 passed (claim was 44 — actually 47, including 4 CAS + 4 D1 race + originals)
TSC:        new files compile clean. Pre-existing errors in payouts/inngest are NOT
            introduced by PR-21 (verified via `git log 1deb4a1b -- <file>` returning empty).
```

Sanitize regex tested manually with these payloads — all redacted:
```
Bearer eyJhbGciOiJIUzI1NiIs...sw5c              → Bearer [REDACTED]
Bearer EAABwzLix...|some_secret~thing            → Bearer [REDACTED]
Bearer ABC+DEF/GHI=JKL=                          → Bearer [REDACTED]
{"error":"bad","access_token":"abcdef123456"}    → {"error":"bad","access_token":"[REDACTED]"}
?fb_exchange_token=AAAA&client_secret=SHHH       → ?fb_exchange_token=[REDACTED]&client_secret=[REDACTED]
```

---

## Positive Observations

1. CAS pattern is clean and matches `acquireRefreshLock` exactly — easy to maintain.
2. Sanitize regex coverage is thorough (8 patterns, real-world tested).
3. R2_PUBLIC_HOSTNAME fail-closed is the right call — prior placeholder default was a registerable subdomain attack.
4. Webhook H6 fail-closed in production with dev override + warn logger is the right balance.
5. `better-sqlite3` is dev-dependency only — won't ship to Workers runtime.
6. Tests now use `Promise.all(N)` for true concurrency, not single-threaded mocks.
7. `.env.example` is force-added — won't be ignored by `.gitignore` `.env*` patterns.

---

## Auto-Merge Decision

**WITH-FIX** — block on **H-NEW-1** (one-line `ts:` field on retry `inngest.send`). All other findings are non-blocking; can land in follow-up PR.

**If H-NEW-1 fixed:** auto-merge eligible at 9.5/10.

### Recommended action sequence
1. Add `ts: Date.now() + delayS * 1000` to the retry `inngest.send` block (H-NEW-1) — single commit.
2. Re-run `npm test src/lib/publishing` — should remain 47/47.
3. Optional: add a unit test that mocks `inngest.send` and asserts `ts` is in the future by `delayS*1000 ± 100ms`.
4. Squash-merge.

### Follow-up PR (post-merge, non-blocking)
- H-NEW-2 PKCE for TikTok (requires checking app config)
- M1 import-real-function test refactor
- M3 split `publish-execute.ts` <250 LOC
- L1 type fix
- L3 try/catch around OAuth callback bodies

---

## Score Breakdown

| Area | Score | Notes |
|------|-------|-------|
| Atomicity & Concurrency | 9/10 | CAS correct, real concurrency tests, but inline-port not import |
| OAuth Security | 8/10 | Fail-closed env vars, HMAC state, BUT TikTok PKCE missing |
| Token Crypto | 10/10 | AES-GCM, encrypted at rest, error sanitization on refresh |
| Error Handling | 8/10 | Sanitize regex thorough, but retry backoff non-functional (H-NEW-1) |
| Tests | 9/10 | 47 pass, real concurrency, FakeD1 helper reusable |
| Code Quality | 8/10 | publish-execute.ts 320 LOC, duplicate JSDoc |
| Stack Conformance | 10/10 | 0 `:any`, 0 `console.*`, logger-utility used, getCurrentUserFromHeaders |

**Composite: 9.0 / 10**

---

## Unresolved Questions

1. Is the TikTok app configured with PKCE-required (post-2024-08)? If yes, H-NEW-2 must ship before connect flow is exposed to users. If no, defer.
2. Has the retry backoff been observed working in staging? If `delayS` was always ignored, did upstream rate limits hit during testing? (smoke check)
3. R2 public hostname must be set in CF Workers env — has Sophia's wrangler.toml (or CI secrets) been updated? `wrangler secret put R2_PUBLIC_HOSTNAME` required.
4. `OAUTH_TOKEN_ENC_KEY` and `OAUTH_STATE_SECRET` rotation policy — documented anywhere?
