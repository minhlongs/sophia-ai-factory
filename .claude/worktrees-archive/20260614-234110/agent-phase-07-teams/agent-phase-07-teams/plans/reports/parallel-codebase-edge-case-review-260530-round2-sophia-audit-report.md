# Edge Case Verification Report — Sophia AI Factory (Round 2)

> Parallel codebase review: 6 code-reviewer agents × 26 edge cases
> Date: 2026-05-30 | Branch: main | Focus: Telegram, Missions, OAuth, Quota, Video, Publishing

---

## Summary

| Metric | Count |
|--------|------:|
| Total edge cases | 26 |
| ✅ Handled | 6 |
| ❌ Unhandled | 9 |
| ⚠️ Partial | 11 |

---

## Critical Unhandled (Need Fix)

| # | Edge Case | Category | File(s) | Impact |
|---|-----------|----------|---------|--------|
| R2-2 | `/free100` pairing gate bypass — any Telegram user can mint MASTER tier for arbitrary email without auth | Telegram | `app/api/webhooks/telegram/route.ts` | **CRITICAL** — promo budget drain + unauthorized tier grants |
| R2-6 | Mission credit TOCTOU — 2 concurrent requests both pass balance check, handler executes before deduct, second deduct fails but service already consumed | Missions | `app/api/v1/missions/route.ts`, `forest/missions/dispatcher.ts` | **HIGH** — free service consumption, operator loses money |
| R2-9 | Dispatch crash drops mission forever — `void dispatchMission().catch(log)` with no reaper cron for stuck `pending`/`running` missions | Missions | `forest/missions/dispatcher.ts` | **HIGH** — silent data loss, credits charged with no result |
| R2-10 | No mission handler timeout — external API calls (HeyGen, OpenRouter) can hang indefinitely; CF Workers I/O wait doesn't count as CPU | Missions | `forest/missions/handlers/*` | **MED** — resource leak, stuck missions |
| R2-12 | OAuth token encryption key rotation breaks all tokens — no key versioning, no dual-key fallback | OAuth | `token-crypto.ts` | **HIGH** — key compromise = force re-auth all users |
| R2-16 | Quota cache invalidated on every allowed request — 2 KV writes per request, immediately destroys just-fetched cache | Quota | `forest/quota/quota-enforcer.ts` | **MED** — unnecessary KV cost, permanent cache miss |
| R2-17 | Quota race condition — `checkQuotaWithOverage` and `deductCredits` are non-atomic; concurrent requests both pass quota check | Quota | `forest/quota/quota-enforcer.ts`, `credits-repo.ts` | **HIGH** — quota overshoot |
| R2-18 | Dunning state queried on every API call (2 D1 queries) with no caching — state changes rarely | Quota | `dunning-admin-operations.ts` | **MED** — unnecessary D1 load |
| R2-19 | Video access DB error returns 404 instead of 503 — authorized owners denied during D1 transient errors | Video | `lib/video/video-access-control.ts` | **MED** — false access denial |

---

## Partial Handling (Need Improvement)

| # | Edge Case | Category | Issue | Priority |
|---|-----------|----------|-------|----------|
| R2-1 | Telegram webhook secret uses `!==` (timing side-channel) | Telegram | Exploitability low (network jitter >> timing diff) but easy fix | Low |
| R2-4 | Pairing code brute-force — 6 digits, no lockout | Telegram | Only admin can approve, low risk | Low |
| R2-5 | FSM state race — `mergeContext` is read-then-write, not atomic | Telegram | Telegram serializes per-chat; race only on retry/deploy | Low |
| R2-7 | Mission API leaks Zod issues with internal field names | Missions | Defense-in-depth violation | Low |
| R2-8 | Available commands list exposed in error response | Missions | May leak beta/admin commands in future | Low |
| R2-14 | OAuth callback inconsistency — TikTok/YouTube missing try-catch on token exchange; redirect path differs | OAuth | 500 with stack trace on fetch error | Med |
| R2-15 | Idempotency key 1-second collision — `Math.floor(ts/1000)` drops legitimate same-second events | Quota | Silent event loss if client omits `requestId` | Med |
| R2-21 | R2 video streaming advertises `Accept-Ranges: bytes` but never handles `Range` header — seeking broken | Video | Full re-download on every seek | Med |
| R2-22 | `access_revoked` column has no CHECK constraint — values > 1 bypass `=== 1` check | Video | Currently safe but fragile | Low |
| R2-23 | Crypto disclaimer idempotency check matches first 20 chars only — crafted caption bypasses injection | Publishing | Compliance violation risk | Med |
| R2-26 | Scheduler anti-collision loop is unbounded `while(conflictFound)` — N+1 DB queries possible | Publishing | DoS via heavy scheduling tenant | Med |

---

## Handled (No Action)

| # | Edge Case | Notes |
|---|-----------|-------|
| R2-3 | FSM SQL injection | All inputs passed as D1 bind parameters, no interpolation |
| R2-11 | OAuth state expiry | 10min TTL + HMAC signature, stale replay rejected |
| R2-13 | Refresh token race | D1 row-lock via atomic UPDATE with stale threshold |
| R2-20 | Admin override for video | Design decision — not a security gap (admin features not yet built) |
| R2-24 | Per-channel quota bypass via duplicate account | Uniqueness enforced on `(tenant_id, provider, external_account_id)` + atomic D1 increment |
| R2-25 | Bundle publisher partial failure | Per-channel results with `success|skipped|failed` status reported to UI |

---

## Recommended Fix Priority

### P0 — Fix Before Next Deploy
1. **#R2-2 `/free100` bypass**: Require pairing (remove from `PUBLIC_COMMANDS`) OR add server-side email ownership verification before granting tier
2. **#R2-6 Mission credit TOCTOU**: Move `deductCredits` BEFORE handler execution; refund on handler failure
3. **#R2-9 Stuck mission reaper**: Add cron route to sweep missions with `status='pending|running'` older than 10min → mark `failed` + refund credits

### P1 — Fix This Sprint
4. **#R2-12 Key rotation**: Embed key version prefix in ciphertext (`aes:v2:...`), try current key first, fallback to previous on decrypt failure
5. **#R2-17 Quota race**: Combine quota check + deduct into single D1 atomic operation, or use optimistic lock with retry
6. **#R2-16 Cache invalidation**: Move `invalidateQuotaCache` to AFTER usage event is written (not before request processing)
7. **#R2-10 Mission timeout**: Add `AbortSignal.timeout(25_000)` wrapper at dispatcher level for all external fetch calls
8. **#R2-19 Video DB error**: Return distinct `'db_error'` status mapped to 503 (not 404)
9. **#R2-26 Scheduler loop**: Cap anti-collision iterations at 48 (4h forward max)

### P2 — Plan for Next Sprint
10. **#R2-18 Dunning cache**: Cache dunning state in KV with 5-10min TTL, invalidate on state transition
11. **#R2-14 OAuth callbacks**: Add try-catch to TikTok/YouTube token exchange; unify redirect paths
12. **#R2-21 R2 range support**: Parse `Range` header, pass to `r2Bucket.get({ range })`, return 206 with `Content-Range`
13. **#R2-15 Idempotency**: Include a monotonic counter or random suffix when `requestId` is absent
14. **#R2-23 Disclaimer check**: Compare full disclaimer text, not first 20 chars

### Backlog
15. **#R2-1 Timing-safe compare**: Replace `!==` with `crypto.subtle.timingSafeEqual` for webhook secret
16. **#R2-22 access_revoked**: Add `CHECK (access_revoked IN (0, 1))` or change to truthy check `!== 0`
17. **#R2-8 Command list**: Filter available commands by `status: 'live'` or user tier
18. **#R2-25 Bundle parallel**: Switch from sequential `for...of` to `Promise.allSettled` for platform calls

---

## Unresolved Questions

1. **#R2-2**: Is `/free100` intentionally public for marketing campaigns, or is removing from `PUBLIC_COMMANDS` safe?
2. **#R2-12**: Is `scripts/reencrypt-publishing-tokens.ts` tested and runnable against production D1?
3. **#R2-20**: Are Bluesky/Mastodon OAuth flows using the same HMAC state pattern, or do they have custom flows?
4. **#R2-9**: What is the expected mission execution time range? Needed to set reaper threshold.
5. **#R2-25**: Is sequential publishing intentional (rate limit compliance) or accidental?

---

## Combined Round 1 + Round 2 Summary

| Metric | Round 1 | Round 2 | **Total** |
|--------|--------:|--------:|----------:|
| Edge cases | 30 | 26 | **56** |
| ✅ Handled | 11 | 6 | **17** |
| ❌ Unhandled | 8 | 9 | **17** |
| ⚠️ Partial | 11 | 11 | **22** |

### Top 5 Most Critical (Both Rounds)

| Rank | Case | Description | Impact |
|------|------|-------------|--------|
| 1 | R2-2 | `/free100` grants MASTER tier to any email without auth | **CRITICAL** |
| 2 | R1-8 | MFA bypass on all API routes | **HIGH** |
| 3 | R1-2 | Promo code TOCTOU — abandoned checkouts leak quota | **HIGH** |
| 4 | R2-6 | Mission credit TOCTOU — free service consumption | **HIGH** |
| 5 | R1-6 | PayOS yearly silently downgraded to monthly | **HIGH** |
