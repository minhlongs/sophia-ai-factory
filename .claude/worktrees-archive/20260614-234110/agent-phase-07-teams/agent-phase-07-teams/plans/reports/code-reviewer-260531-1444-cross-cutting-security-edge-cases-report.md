# Code Review — Cross-Cutting Security Edge Cases
**Date:** 2026-05-31
**Scope:** 5 security edge cases across webhook, cron, logging, and error handling subsystems

---

## 1. Error Responses Leak Internal Error Messages

**Finding: ❌ Unhandled**

Multiple cron route files return raw `err.message` strings directly in HTTP JSON responses. This leaks D1 error details, stack context, and internal implementation details to any caller that can reach the endpoint (internal services, log aggregators, reverse proxies).

| File | Line | Leakage |
|---|---|---|
| `cron/promo-trial-expiry/route.ts` | 188 | `err instanceof Error ? err.message : 'unknown'` in `NextResponse.json` |
| `cron/email-drip/route.ts` | 666 | `msg` from `getErrorMessage(err)` returned in body |
| `cron/error-digest/route.ts` | 187 | `errMsg` from `getErrorMessage(d1Err)` returned in body |
| `cron/d1-backup/route.ts` | 156 | `errMsg` from `getErrorMessage(err)` returned in body |
| `cron/llm-cache-purge/route.ts` | 81 | `message` from `getErrorMessage(err)` returned in body |
| `cron/memory-consolidation/route.ts` | 47 | `getErrorMessage(err)` returned in body |

**Mitigating factor:** All cron routes are gated by `verifyCronAuth` (CRON_SECRET), so only authenticated internal callers see these messages. The error-digest route uses its own inline `verifyCronSecret` that only checks `Authorization: Bearer` header, missing `x-cron-secret` and `?token=` fallback paths (Edge Case 5 finding).

**Risk:** If any cron route is accidentally exposed (middleware bypass, misconfigured binding, or CRON_SECRET leaked), attackers gain full DB schema and internal state details.

**Fix pattern:** Replace `error: msg` with `error: 'internal_error'` or a generic code. Log the real message internally via `logger.error` (already done in most routes).

---

## 2. PII in Logs

**Finding: ⚠️ Partial**

The PII scrubber (`pii-scrubber.ts`) is comprehensive — it regex-redacts emails, phones, JWTs, Bearer tokens, API keys, and publishable keys before any log leaves the process. The `logger-internals.ts` correctly applies `scrubPII()` to messages and `redactSecretKeys()` + `scrubPIIDeep()` to metadata before emission.

**However, there are log statements that bypass the structured logger and embed PII directly in message strings:**

- `email-drip/route.ts` line 179: `ownerFullName: userRow.email.split('@')[0]` — the log message at line 646 includes aggregate counts only, but the `userRow.email` value flows through to `evaluateLifecycleEmails` and its descendants. If any downstream code logs the decision payload, email prefixes would appear in logs.
- `email-outbox-flush/route.ts`: No PII logged directly, but `enqueueWelcomeEmail` receives `toEmail` — if the email function logs the enqueue action, the email address is in the message string before scrubber catches it.

**Mitigating factor:** The scrubber catches email patterns (`/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g`) so even if emails end up in log message strings, they get replaced with `[REDACTED-EMAIL]`. But this depends on the scrubber being consistently applied, and the `split('@')[0]` pattern (email prefix only) would NOT be caught by the email regex — it would pass through as plain text.

**Risk:** Low-medium. Email prefixes (name portion before @) could leak to log aggregation services (Better Stack, Sentry) through the `ownerFullName` field. Full emails are caught by the scrubber.

---

## 3. Webhook Rate Limiting

**Finding: ❌ Unhandled (HeyGen, Telegram, PayOS)**

| Webhook Endpoint | Rate Limit | Status |
|---|---|---|
| `/api/webhooks/clickbank` | 1000/min per IP (`checkRateLimit`) | ✅ Implemented |
| `/api/webhooks/heygen` | None | ❌ No rate limit |
| `/api/webhooks/telegram` | None at route level (pairing gate exists but not rate limit) | ❌ No rate limit |

**HeyGen webhook:** The `/api/webhooks/heygen` route has no rate limiting whatsoever. An attacker who discovers or guesses the endpoint URL (it is a public route, only guarded by HMAC signature) could flood it with requests. The signature verification provides some protection, but:
- Signature verification runs per-request (async HMAC-SHA256), consuming CPU
- Each valid request triggers D1 writes (UPDATE videos)
- Cloudflare Workers has CPU time limits (10ms per request, 30s total per invocation)

**Attack vector:** Attacker obtains a valid HeyGen webhook secret (if per-customer secrets are stored in D1 and queryable), sends thousands of forged payloads. Even without the secret, the HMAC verification itself consumes resources on invalid requests.

**Fix:** Add a lightweight IP-based rate limiter at the middleware level or within the route handler, before signature verification.

---

## 4. CRON_ROUTES Coverage vs wrangler.toml

**Finding: ⚠️ Minor Gap (dead pattern)**

**wrangler.toml `crons` array** (20 patterns):
```
* * * * *                                    → workflow-stepper
*/2 * * * *                                  → fulfillment-retry, email-outbox-flush
*/5 * * * *                                  → uptime-check, video-status-sync, sop-scheduler, mission-reaper
*/10 * * * *                                 → heartbeat
*/15 * * * *                                 → smoke-one-time
5 * * * *                                    → usage-export, hourly-rollup
7 * * * *                                    → handover-status-sync, ab-winner-picker
10 * * * *                                   → wallet-rebuild
0 */4 * * *                                  → affiliate-scout
0 0 * * *                                    → clearance-promote, promo-trial-expiry, status-rollup, promo-cleanup
0 0 1 * *                                    → mcu-monthly-reset
0 1 * * *                                    → dunning-advance
5 1 * * *                                    → daily-rollup
0 2 * * *                                    → subscription-reminders, memory-consolidation
0 3 * * *                                    → scheduled-campaigns
0 4 * * *                                    → email-drip
0 5 * * *                                    → d1-backup, error-digest, quota-check
0 6 * * *                                    → fulfillment-reconcile
0 6 * * 1                                    → weekly-signals-digest
0 7 * * *                                    → llm-cache-purge
```

**CRON_ROUTES in `inject-scheduled-handler.mjs`** (all 20 patterns mapped):
All 20 wrangler.toml cron patterns are present in CRON_ROUTES. ✅

**Unmapped cron gap (minor):**
- wrangler.toml comment mentions `*/10 * * * *` (heartbeat) as P2 — it IS in CRON_ROUTES but the wrangler.toml `crons` array also includes it. ✅
- wrangler.toml comment mentions `0 5 * * *` (error-digest) as P2 — IS in both. ✅

**Dead cron pattern (historical):** wrangler.toml comment says `*/1 * * * *` was REMOVED because "workflow-stepper has no live handler." However, `* * * * *` IS in the crons array and IS mapped to workflow-stepper in CRON_ROUTES. This means workflow-stepper fires every minute (not every 5 min as the comment suggests). The `*/5 * * * *` comment points to uptime-check + video-status-sync, which are ALSO in CRON_ROUTES. Both patterns coexist, meaning those routes fire twice as often as the comments imply — once from `* * * * *` (via workflow-stepper dispatch) and once from `*/5 * * * *`.

**Summary:** No unmapped crons silently fail. The coverage is complete. The only issue is the dual-firing frequency for `*/5 * * * *` routes due to overlapping `* * * * *` pattern.

---

## 5. Cron Secret Validation Consistency

**Finding: ⚠️ Partial — error-digest has a weaker, inconsistent implementation**

Checked 32 cron route files. All but one use `verifyCronAuth()` from `cron-auth.ts`.

**`verifyCronAuth()` supports 3 auth methods:**
1. `Authorization: Bearer <CRON_SECRET>` (primary — used by scheduled handler)
2. `x-cron-secret: <CRON_SECRET>` (legacy compat)
3. `?token=<CRON_SECRET>` (external monitors like UptimeRobot)

**All 31 routes using `verifyCronAuth()`:** Consistent. ✅

**Exception — `error-digest/route.ts` (line 49-54):**
```typescript
function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}
```
- Only checks `Authorization: Bearer` header
- Does NOT support `x-cron-secret` header
- Does NOT support `?token=` query parameter
- Returns boolean instead of `NextResponse | null` (different contract)
- Does NOT have the `NEXT_PUBLIC_MOCK_AI_SERVICES` bypass guard

**Impact:** Low. The scheduled handler always uses `Authorization: Bearer`, so the primary path works. But external monitors (UptimeRobot, etc.) configured with `?token=` will get 401 from error-digest while succeeding on all other cron routes. This is an inconsistency, not an exploitable vulnerability.

**Dev mode bypass:** `verifyCronAuth` skips auth in `NODE_ENV === 'development'` when `NEXT_PUBLIC_MOCK_AI_SERVICES !== 'true'` and `PLAYWRIGHT_TEST_BASE_URL` is unset. This is intentional for local dev but means any localhost request bypasses cron auth.

---

## Summary Table

| # | Edge Case | Status | Severity |
|---|---|---|---|
| 1 | Error response leakage (err.message) | ❌ Unhandled | Medium (mitigated by CRON_SECRET gate) |
| 2 | PII in logs (email prefixes) | ⚠️ Partial | Low-Medium (scrubber catches full emails) |
| 3 | Webhook rate limiting | ❌ Unhandled | Medium (HeyGen/Telegram exposed to flood) |
| 4 | CRON_ROUTES coverage | ✅ Handled | None (complete coverage) |
| 5 | Cron secret validation consistency | ⚠️ Partial | Low (error-digest has custom weaker impl) |

## Recommendations (Priority Order)

1. **Sanitize cron error responses:** Replace `err.message` with generic `'internal_error'` in all 6 cron routes. Log the real message internally (already done). This defense-in-depth protects against CRON_SECRET leakage.
2. **Add rate limiting to `/api/webhooks/heygen`:** IP-based rate limit before signature verification. Even 100 req/min per IP would prevent flood attacks.
3. **Standardize error-digest auth:** Replace the inline `verifyCronSecret()` with `verifyCronAuth()` for consistency with all other cron routes.
4. **Audit email-prefix logging:** Verify that `ownerFullName: email.split('@')[0]` values never appear in structured log metadata that gets shipped to Better Stack / Sentry.

## Unresolved Questions

- Does the `* * * * *` cron pattern (every minute) intentionally fire workflow-stepper at 1min cadence, or is it a leftover from when `*/1 * * * *` was removed? The wrangler.toml comment says "workflow-stepper has no live handler" but it clearly does.
- Is the `NEXT_PUBLIC_MOCK_AI_SERVICES !== 'true'` dev bypass in `verifyCronAuth` intentional for all cron routes, or should some (like d1-backup) always require auth even in dev?
