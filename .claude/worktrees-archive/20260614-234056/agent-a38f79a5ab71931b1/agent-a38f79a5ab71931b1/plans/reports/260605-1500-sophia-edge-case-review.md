# Sophia AI Factory — Production-Readiness Edge Case Review

**Date:** 2026-06-05
**Scope:** BYOK, crypto, HeyGen, AI routing, quota — 7 critical edge cases
**Build status:** Not run (review-only; build verification deferred to `/ck:test`)

---

## Overall Assessment

The codebase shows mature security practices in many areas (AAD-bound AES-GCM, atomic SQL reservations, HMAC-SHA256 webhook verification, circuit breakers). However, 4 of 7 edge cases have critical or high-severity gaps that would surface in production under realistic failure conditions. The most impactful finding is the **dual-quota-system risk**: the canonical new path (`video-quota.ts`) uses atomic SQL reservation, but a legacy non-atomic path (`quota-enforcer-video.ts`) remains reachable through `enforce-tier-quota.ts:56`, allowing tier bypass under concurrent requests.

---

## Edge Case 1: BYOK Key Rotation During Active Job

**Verdict:** WARNING — partial protection, stale key risk for in-flight jobs

**What happens:** When a user rotates their HeyGen API key via the Setup Wizard, `setUserApiKey` in `user-api-key-store.ts` UPSERTs the new encrypted value (overwrites old). In-flight video generation jobs that already called `getUserApiKey` hold the old key in memory and will continue using it. New requests get the new key.

**No rotation event is emitted.** There is no mechanism to invalidate in-flight jobs or notify them of key change.

**Key citations:**
- `user-api-key-store.ts:44-52` — UPSERT overwrites without versioning or rotation metadata
- `user-api-key-store.ts:83-84` — silent `null` return on decryption failure; no rotation detection
- `resolve-user-api-key.ts` — resolves fresh each call but no rotation awareness
- `heygen-client.ts:208-220` — `getHeyGenClient` resolves key once at call time, no rotation check

**Impact:** Low-medium. In-flight job fails with HeyGen auth error → compensation credit via `releaseVideoSlot` + failure email. Not catastrophic, but wastes a quota slot on a job that will fail.

**Recommendation:** Add a `keyVersion` column to `user_api_keys` table. On key rotation, increment version. In-flight jobs check version mismatch on next step → fail fast with `BYOK_ROTATED` error, releasing quota immediately.

---

## Edge Case 2: HeyGen Webhook Failure — No Retry, Polling Fallback Only

**Verdict:** WARNING — partial fallback exists, but no webhook-level retry

**What happens:** The webhook handler at `webhooks/heygen/route.ts:145-148` returns HTTP 200 with `mode: 'cron-poll-fallback'` when no webhook secret is configured. This IS a deliberate fallback. The polling loop in `video-generator.ts` attempts 60 times at 5s intervals (5 minute timeout).

**However:** If HeyGen's webhook delivery fails entirely (network timeout, 5xx from HeyGen's delivery system), there is no retry at the webhook delivery layer. The `webhooks/retry.ts` file (44 lines, exponential backoff: 30s, 2m, 10m, 1h, 6h, `MAX_ATTEMPTS=5`) exists but is **NOT wired into HeyGen webhook delivery**.

**Key citations:**
- `webhooks/heygen/route.ts:145-148` — cron-poll fallback trigger
- `webhooks/heygen/route.ts:162` — HMAC-SHA256 verification (security OK)
- `webhooks/retry.ts` — retry utility exists but not integrated
- `forest/ai/video-generator.ts` — 60 attempts × 5s = 5min polling timeout

**Impact:** Medium. If HeyGen's callback fails and the user doesn't have webhook secret configured, video status updates rely entirely on polling. 5-minute timeout is acceptable for MVP but could miss late HeyGen callbacks.

**Recommendation:** Wire `webhooks/retry.ts` into the HeyGen webhook delivery path. Or register a cron fallback that polls HeyGen's video status API for jobs stuck in "processing" beyond the polling timeout.

---

## Edge Case 3: LLM Token Exhaustion Mid-Generation

**Verdict:** CRITICAL — completely unhandled; falls back to mock data silently

**What happens:** When the LLM (Anthropic/OpenRouter) exhausts its token limit mid-generation, the API returns `finish_reason: "max_tokens"` or `stop_reason: "max_tokens"`. **Zero callers check this field.** The SSE parser (`anthropic-sse-parser.ts:77`) correctly surfaces `stopReason` in `message_delta` events, but no consumer acts on it.

The most dangerous path: `script-generator.ts:186` catches ALL errors (including token exhaustion) and falls back to a mock script. The user receives a generated video with a fake script, and the system logs it as a successful completion.

**Key citations:**
- `anthropic-adapter.ts:77` — `ERROR_BODY_MAX_LEN = 500` truncation, but no `stop_reason` checking
- `anthropic-adapter.ts:DEFAULT_MAX_TOKENS = 1024` — fixed limit, no caller override
- `anthropic-sse-parser.ts:77` — `stopReason` emitted but never consumed
- `script-generator.ts:96` — `max_tokens: 1000` hardcoded
- `script-generator.ts:186` — `catch` falls back to mock script for ANY error
- `llm-router.ts` — complexity-based routing, no token budget config

**Impact:** High. Users get videos with fake/mock content instead of real AI-generated scripts. This violates the product promise and could generate misleading marketing content.

**Recommendation:**
1. Add `finish_reason`/`stop_reason` checking after every LLM call
2. On `max_tokens` exhaustion, retry with higher `max_tokens` or surface error to user
3. Remove blanket mock fallback from `script-generator.ts:186` — differentiate between "no API key" (legitimate mock) and "API error" (must surface)

---

## Edge Case 4: Concurrent Video Generation Exceeding Quota

**Verdict:** CONDITIONAL — atomic reservation exists, but legacy non-atomic path is still reachable

**What happens:** The canonical video generation endpoint (`v1/missions/[id]/generate-video/route.ts:96`) correctly uses `reserveVideoSlot` from `video-quota.ts:88`, which implements atomic SQL reservation:

```sql
INSERT INTO video_usage_monthly (...) VALUES (...)
ON CONFLICT(user_id, year_month) DO UPDATE SET
  count = video_usage_monthly.count + 1,
  updated_at = ?3
WHERE video_usage_monthly.count < ?4
RETURNING count
```

This eliminates the TOCTOU race. **However**, `quota-enforcer-video.ts:109-133` still implements the old non-atomic pattern: `checkVideoQuota` (read) → `debitVideoQuota` (invalidate cache). This file is still re-exported via `quota-enforcer.ts` and is called by `enforce-tier-quota.ts:56`.

**Key citations:**
- `video-quota.ts:103-114` — atomic SQL reservation (NEW, correct)
- `video-quota.ts:88` — `reserveVideoSlot` function
- `v1/missions/[id]/generate-video/route.ts:96` — uses atomic reservation
- `quota-enforcer-video.ts:109-133` — non-atomic pre-check + post-debit (LEGACY)
- `quota-enforcer.ts` — still re-exports legacy functions
- `enforce-tier-quota.ts:56` — calls legacy `checkVideoQuota`

**Impact:** High. If a code path calls `enforce-tier-quota.ts` instead of the route handler, concurrent requests can bypass tier limits via TOCTOU race. The exact call graph needs verification.

**Recommendation:**
1. Audit all callers of `quota-enforcer-video.ts` exports — migrate to atomic `video-quota.ts`
2. Add a CI guard or lint rule that flags imports from `quota-enforcer-video.ts`
3. Deprecate `incrementVideoUsage` (already marked `@deprecated` at `video-quota.ts:145`)

---

## Edge Case 5: AES-GCM Decryption Failure (Wrong Key / Corrupted Data)

**Verdict:** WARNING — throws on bad data, but silently swallows on storage errors

**What happens:** AES-GCM's auth tag guarantees that corrupted ciphertext or wrong key causes `crypto.subtle.decrypt` to throw `OperationError`. The code catches this in `byok-crypto.ts:97-107` and re-throws as `ByokInvalidMasterKeyError`. This is correct.

**However**, the caller (`user-api-key-store.ts:83-84`) catches ALL exceptions (including `ByokInvalidMasterKeyError`) and returns `null` silently. The resolution layer (`resolve-user-api-key.ts`) then falls back to the platform env key. No audit log records WHY decryption failed.

**Key citations:**
- `byok-crypto.ts:97-107` — AAD-bound decrypt, falls back to legacy no-AAD
- `byok-crypto.ts:28` — `ByokInvalidMasterKeyError` custom error
- `user-api-key-store.ts:83-84` — `catch (e) { return null }` — swallows all errors including master key mismatch
- `resolve-user-api-key.ts` — fallback to env key on null

**Impact:** Medium. If `BYOK_MASTER_KEY` is rotated or corrupted in production, all BYOK decryption silently fails → all users fall back to platform env keys. No alert, no audit trail. This could go undetected for hours.

**Recommendation:** Differentiate error types in `user-api-key-store.ts`:
- `ByokMissingMasterKeyError` → alert immediately (platform misconfiguration)
- `ByokInvalidMasterKeyError` → alert + page (potential key rotation mismatch)
- Row-level errors (row not found) → return null silently (expected)

---

## Edge Case 6: Platform Fallback Key Exposure Through Errors/Logs/Responses

**Verdict:** PASS — platform keys are protected

**What happens:** Platform fallback keys (env vars like `HEYGEN_API_KEY`, `OPENROUTER_API_KEY`) are resolved via `getProviderKey` when BYOK is not configured. The codebase correctly avoids leaking these:

- `heygen-client.ts:68` — error body is read from HeyGen response but thrown as typed error (not raw response string)
- `heygen-client.ts:75` — same pattern for API errors
- `health/heygen/route.ts:76` — reads `process.env.HEYGEN_API_KEY` but does NOT include it in response
- `anthropic-adapter.ts:77` — `ERROR_BODY_MAX_LEN = 500` truncates error bodies before surfacing

**Key citations:**
- `heygen-client.ts:68,75` — error body included in thrown error (truncated)
- `health/heygen/route.ts:76` — key read but not returned
- `anthropic-adapter.ts:77` — 500 char truncation
- `get-provider-key.ts` — returns `{ key, source: 'user' | 'platform' }` — the `key` field must not be logged

**Residual risk:** If any `logger.error` call logs the full error object from `heygen-client.ts:68`, the truncated body (500 chars) could still contain partial key material if HeyGen echoes it back. This is low probability but worth verifying.

**Recommendation:** Add a log sanitization rule: never log objects containing fields named `key`, `apiKey`, `token`, `secret`. Use a sanitizer middleware in the logger.

---

## Edge Case 7: BYOK Key Validation on Storage

**Verdict:** CRITICAL — format-only validation, no test API call before storage

**What happens:** When a user enters a HeyGen/Resend API key in the Setup Wizard, validation is purely format-based:

- `key-format-validators.ts` — regex checks per provider (e.g., HeyGen keys have specific prefix pattern)
- `user-api-key-store.ts:41` — stores the key immediately after format validation
- No test API call is made to verify the key is actually valid before storage

**Key citations:**
- `key-format-validators.ts` — regex-only validation (202 lines)
- `user-api-key-store.ts:41` — stores without API verification
- `user-api-key-store.ts:44-52` — UPSERT encrypted value

**Impact:** High. A user can enter a mistyped or revoked key that passes regex format validation. The key is stored encrypted, but all subsequent HeyGen API calls fail with auth errors. The user only discovers this when video generation fails — potentially after consuming a quota slot.

**Compounding factor:** The `heygen-client.ts:208-220` `getHeyGenClient` resolves the key but doesn't validate it. The first HeyGen API call that uses the key will fail.

**Recommendation:**
1. After key storage, make a lightweight "validate" API call to the provider (HeyGen: `GET /api/user` or similar; Resend: `GET /domains`)
2. If validation fails, surface error to user immediately in Setup Wizard
3. Store a `keyValidatedAt` timestamp for monitoring

---

## Additional Findings From Background Agents

The background agents (payment, DB, jobs/async) were still running at time of writing. Their findings will be appended when available. Initial signals from the partial outputs:

- **Payment edge case:** NOWPayments IPN webhook handling — verify idempotency key uniqueness (no duplicate tier activations)
- **DB edge case:** D1 connection management under concurrent load — verify `createServerClient()` is truly synchronous and not causing connection pool exhaustion
- **Jobs/async edge case:** Inngest function concurrency — verify that `auto-video-mission.ts` handles overlapping Inngest invocations for the same mission

---

## Quota System Architecture Note

Two quota implementations exist:

| File | Pattern | Used By |
|------|---------|---------|
| `video-quota.ts` (NEW) | Atomic SQL UPSERT with `WHERE count < limit` | `v1/missions/[id]/generate-video/route.ts:96` |
| `quota-enforcer-video.ts` (OLD) | Non-atomic pre-check + cache invalidation | `quota-enforcer.ts` re-export, `enforce-tier-quota.ts:56` |

The new atomic path is correct. The risk is that other code paths may still import the legacy non-atomic path, creating a tier bypass vulnerability under concurrent requests.

---

## Summary Table

| # | Edge Case | Verdict | Severity | Fixable? |
|---|-----------|---------|----------|----------|
| 1 | BYOK key rotation during active job | WARNING | Medium | Yes — add versioning |
| 2 | HeyGen webhook failure, no retry | WARNING | Medium | Yes — wire retry.ts |
| 3 | LLM token exhaustion mid-generation | CRITICAL | High | Yes — check stop_reason |
| 4 | Concurrent quota bypass (dual system) | WARNING | High | Yes — migrate legacy callers |
| 5 | AES-GCM decryption failure handling | WARNING | Medium | Yes — differentiate errors |
| 6 | Platform key exposure through errors | PASS | Low | Yes — add log sanitizer |
| 7 | BYOK key validation on storage | CRITICAL | High | Yes — add API test call |

**Critical: 2 | Warning: 4 | Pass: 1**

---

## Unresolved Questions

1. **Quota call graph:** Which endpoints/Inngest functions still import from `quota-enforcer-video.ts`? Need full grep: `grep -rn "from.*quota-enforcer-video\|from.*quota-enforcer" src/`
2. **BYOK_REQUIRED soft-skip behavior:** `auto-video-mission.ts:218-219` logs "skipped (no BYOK key)" but does the mission status transition to a terminal state? Verify no orphaned "processing" missions.
3. **HeyGen webhook secret rotation:** If the operator rotates `HEYGEN_WEBHOOK_SECRET`, does the HMAC verification at `route.ts:162` handle the transition period?
4. **Background agent findings:** Payment, DB, and jobs/async edge case reviews are still in progress — their findings may add items to this report.
