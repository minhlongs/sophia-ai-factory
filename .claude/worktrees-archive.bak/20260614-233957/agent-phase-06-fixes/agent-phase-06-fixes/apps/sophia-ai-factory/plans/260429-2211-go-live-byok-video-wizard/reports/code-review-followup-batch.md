# Code Review — Follow-up Batch (Streams A/B/C)

Date: 2026-04-29
Scope: 3 parallel streams, combined diff. Staged uncommitted.
Verified upstream: tsc 0 err, vitest 1782/1813 pass.

## Score: 8.2/10

Solid functional work. Quota race hole + i18n bypass + missing test coverage knock 2 pts.

---

## CRITICAL (block ship)

None. Pre-deploy fix recommended for #H1 (race) before MASTER tier ships at scale.

---

## HIGH

### H1 — Stream A: Quota race condition (TOCTOU)

`checkVideoQuota` reads count → caller checks `allowed` → caller calls HeyGen → caller `incrementVideoUsage`. Window: ~2-30s (HeyGen latency). Concurrent requests from same user all see `used=29` simultaneously, all pass quota gate, all bump to 30+. PREMIUM=30 user can burst 50+ concurrent.

D1 has no row locks. UPSERT is atomic per-row but happens AFTER HeyGen call.

**Fix options:**
- (Pragmatic) Reserve-then-confirm: increment BEFORE HeyGen; on HeyGen failure decrement. Simpler, slight over-count on transient failures.
- (Strict) Use D1 conditional update: `UPDATE … SET count = count + 1 WHERE count < ?limit RETURNING count` (single statement, atomic, no preflight read). Reject if no row affected.
- (Cheapest) Accept the burst — document MASTER tier risk = 1000+5 = 1005 max. BASIC blocked at 402 anyway.

Recommend strict atomic UPDATE for go-live; small SQL change, kills the race.

### H2 — Stream B: i18n bypass via hardcoded SIGNUP_STRINGS_VI

`messages/{en,vi}.json` got `auth.signup` namespace (good), but `login/page.tsx` hardcodes `SIGNUP_STRINGS_VI` constant and ignores both. Result: English-locale users see Vietnamese signup form. EN translations are unused.

**Fix:** Use `useTranslations('auth.signup')` from next-intl in the client component (login page is `'use client'` — `useTranslations` works client-side when wrapped in `NextIntlClientProvider`). Pass result to `<SignupForm t={...} />`.

### H3 — Stream A: Migration filename style mismatch

`0033_video_usage_monthly.sql` uses underscore. Existing 0030+ all use dash (`0030-videos-r2-key.sql`, `0031-affiliate-offers-catalog.sql`). Only 3 historical files use underscore. wrangler is filename-agnostic so it deploys, but breaks alphabetical grep & inconsistency.

**Fix:** Rename to `0033-video-usage-monthly.sql`.

---

## MEDIUM

### M1 — Stream A: Redundant index

```sql
PRIMARY KEY (user_id, year_month)
CREATE INDEX idx_video_usage_monthly_user_month ON (user_id, year_month)
```
PRIMARY KEY already creates the index. Duplicate index wastes storage and write throughput. Drop the explicit `CREATE INDEX`.

### M2 — Stream B: Auto-redirect timing creates flash

`setTimeout(() => router.push('/setup-wizard'), 1200)` + `setupWizard/layout.tsx` reads session + checks providers. New user has 0 providers → renders wizard. But there is a brief "Account Created!" flash (1.2s) then nav. Acceptable, but redirect is fragile — if user closes tab in 1.2s window, they lose the success confirmation. Consider `router.push` immediately after a 300ms checkmark animation.

### M3 — Stream C: window.confirm for delete UX

`window.confirm` is functional but jarring (browser-native modal, no styling, blocks JS). For a user-facing PaaS, custom dialog (existing shadcn `AlertDialog` if present) is better. Not blocking — `confirm` is safe and tested.

### M4 — Stream C: No rate limit on /api/health/byok

GET endpoint requires auth, returns provider list (no key material). Auth gate is sufficient — no rate-limit needed for read-only metadata. **Decision: ship as-is.** Add rate limit only if abuse observed.

### M5 — Stream B: Email enumeration in error handling

`handleSubmit` checks `msg.includes("already")` — surfaces "This email is already registered" message. Standard tradeoff: better UX vs. enumeration. For a B2B SaaS targeting non-tech CEOs, keeping the friendly error is correct. **Decision: accept the trade-off.** Document in security threat model.

### M6 — Stream C: Webhook update scoped only by heygen_job_id

`UPDATE videos … WHERE heygen_job_id = ?` — no `user_id` constraint. If HeyGen ever recycles IDs (they don't, but defense-in-depth), one user's webhook could mutate another user's row. Cost: trivial. **Fix:** sig check already prevents external tampering, but tighten by joining user_id from existing row.

---

## LOW

### L1 — Stream A: `incrementVideoUsage` swallows error silently

Logged but not surfaced. Quota counter drift possible on D1 transient failures. Fine for go-live, add monitoring alert later.

### L2 — Stream B: SignupForm has no rate-limit / captcha

Better Auth handles backend rate-limit. UI doesn't disable button after N rapid submits. Better Auth client returns errors fine; not a security gap.

### L3 — Stream C: Webhook signature timing-safe compare ✅

Implementation does constant-time XOR loop — correct. (Cited as positive observation.)

### L4 — Stream A: `BASIC: 0` map entry is unreachable

Tier gate at line 22 returns 402 before quota check. `VIDEO_QUOTA_BY_TIER.BASIC` never read in current flow. Keep for defensive completeness or drop. Cosmetic.

### L5 — Test mock pollution risk

`process.env.HEYGEN_WEBHOOK_SECRET` `delete` in webhook tests. If another test sets the env earlier in same vitest process, ordering could matter. Current `beforeEach`/`afterEach` correctly delete. Pass — no action.

---

## EDGE CASES SCOUTED (cross-stream)

1. **Concurrent signup w/ same email** — Better Auth guards via DB unique constraint. UI surfaces "already exists". OK.
2. **User signs up → never finishes wizard → tries `/dashboard`** — middleware redirects to `/setup-wizard`. OK.
3. **Quota counter increments after HeyGen 200 but D1 INSERT into `videos` fails** — quota counted, video lost. User sees DB_FAILED 500. Counter is wasted. Acceptable failure mode but worth documenting.
4. **User on PREMIUM upgrades to MASTER mid-month** — quota lookup uses `tier` from `getUserTier()` (current). Old `count` carries over, new limit applied. New user effectively gets MASTER limit minus PREMIUM usage. Fair.
5. **User downgrades MASTER → PREMIUM mid-month at count=500** — `used=500 > limit=30` → blocked rest of month. Edge case to document; not a bug.
6. **Webhook arrives before D1 INSERT** — Race: HeyGen pushes status before our INSERT lands. Webhook UPDATE matches 0 rows, silently does nothing. Cron polling backstops. OK.
7. **video_usage_monthly schema on prod D1** — Migration applies via guard. 0033 number is unused; prod will accept. OK.
8. **i18n keys in en.json/vi.json present but unused** — verified `auth.signup` block exists in both, but `login/page.tsx` does not consume them. Dead translation keys until H2 fixed.
9. **Test file ownership** — `api-routes.test.ts` modified by both Stream A (quota tests) and Stream C (webhook x-signature test). Single file, single agent should own. Both edits happen in non-overlapping describe blocks → safe but coordinate next time.
10. **Signup form `pageTab` reset on switch** — clears email/password but not name/confirm in SignupForm (state lives in child). Switching to signin then back to signup keeps form state. Probably desired.

---

## POSITIVE OBSERVATIONS

- Stream A: Quota counter increment AFTER HeyGen success is the right call (don't penalize failures).
- Stream A: `incrementVideoUsage` failure is non-fatal — user gets video. Good UX-first design.
- Stream A: ON CONFLICT DO UPDATE syntax is D1-correct (SQLite-compatible).
- Stream B: Client-side validation matches server min length (8). Both layers — defense in depth.
- Stream C: Webhook timing-safe signature compare (constant-time XOR loop). Proper crypto.
- Stream C: Header variant fallback chain is sensible (x-heygen, heygen, x-signature, heygen-webhook).
- Stream C: Webhook returns 200 for missing-secret to avoid HeyGen retry storm — correct ops behavior.
- Tests: Quota tests cover the 3 critical paths (under/at/increment-once). Good coverage.

---

## RECOMMENDED ACTIONS (ordered)

1. **Before merge:** Rename migration to `0033-video-usage-monthly.sql` (M3, 1 min).
2. **Before merge:** Drop redundant CREATE INDEX (M1, 1 min).
3. **Before go-live:** Replace quota check-then-increment with atomic conditional UPDATE (H1, ~30 min).
4. **Before EN locale launch:** Wire `useTranslations` in login page (H2, ~15 min).
5. **Post-launch:** Replace `window.confirm` with shadcn AlertDialog (M3, ~45 min).
6. **Post-launch:** Add `user_id` scope to webhook update (M6, ~10 min).

---

## METRICS

- Type Coverage: tsc 0 err (verified).
- Test Coverage: +51 net tests, 0 failures.
- New `:any` types: 0 (uses `as never` casts in tests — acceptable per project standard).
- New `console.log`: 0 (uses `logger` utility).
- File size: signup-form.tsx 209 lines (slightly over 200 threshold; acceptable for cohesive form).

---

## UNRESOLVED QUESTIONS

1. Atomic UPDATE quota fix: acceptable to ship H1 as-is for soft launch, or block on it? Burst risk is bounded (PREMIUM=30 → at most ~5x burst = 150). Likely OK for week-1.
2. EN locale: is `/en/login` advertised yet, or is `/vi/login` the only entry? If VI-only for soft launch, H2 can wait.
3. `0033` migration number: confirm prod D1 has not yet applied any 0033. (Migration-guard will detect.)
4. Should `incrementVideoUsage` failure be surfaced as a 500 (force reconciliation) or stay non-fatal? Current design favors UX over accounting accuracy.
