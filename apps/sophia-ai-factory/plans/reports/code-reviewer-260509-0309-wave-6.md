# Wave 6 Code Review (F-1 → F-6)

**Date:** 2026-05-09 03:09 UTC
**Reviewer:** code-reviewer
**Scope:** 7 files, 984 LOC

## Score: 6.5 / 10  ❌ (target ≥ 9.0)

Two CRITICAL functional bugs (F-6 always-blocks logged-in users; F-3 client/server field-name mismatch makes revealedKey.key undefined and lastUsedAt never display). One HIGH (F-3 duplicate page conflict with existing `/dashboard/api-keys`). Wave is NOT ship-ready.

---

## CRITICAL (must fix before deploy)

### C1. F-6 — `emailVerified` always undefined → all logged-in users blocked
**File:** `src/app/api/promo/redeem-free/route.ts:38-42`

`getCurrentUserFromHeaders()` at `src/seed/auth/better-auth-session.ts:65-72` returns the wrapped `User` type (`src/seed/db/client.ts`):
```ts
export type User = { id; email; full_name?; avatar_url?; role? };
```
`emailVerified` is NEVER copied through. The cast `(user as unknown as { emailVerified?: boolean }).emailVerified === true` always reads `undefined → false`. Therefore:

```ts
if (userId && !resolved.sessionEmailVerified) // ALWAYS true for logged-in users
  return 403 email_not_verified;
```

Every logged-in user redeeming FREE100 gets blocked. F-6 anti-abuse goal is achieved by accident, but the legitimate-user UX is destroyed.

**Fix:**
1. Extend `getCurrentUserFromHeaders` (and `User` type) to surface `emailVerified` from `session.user.emailVerified`:
```ts
return {
  id: session.user.id,
  email: session.user.email,
  emailVerified: (session.user as { emailVerified?: boolean }).emailVerified === true,
  ...
};
```
2. Update `User` type to include `emailVerified?: boolean`.
3. Then read it cleanly in `findOrResolveUser`.

Additionally: also blocks NOT-logged-in users with existing accounts (line 118 sets `userId` from email lookup with `sessionEmailVerified: false`). Decide whether anonymous redeem against an existing email should also fail — current behaviour does fail it.

---

### C2. F-3 — server/client field-name mismatch (camelCase vs snake_case)
**Files:** `src/app/[locale]/dashboard/settings/api-keys/api-keys-client.tsx:7-21, 79-81, 113-117`
vs `src/forest/api-keys/d1-store.ts:52-58, 134-145`

Server `CreateKeyResult` returns `{ fullKey, keyId, prefix, id, createdAt }`.
Server `ApiKeyInfo` returns `{ id, keyId, prefix, name, createdAt, lastUsedAt, ... }`.

Client interfaces declare:
```ts
interface ApiKey { id; name; prefix; created_at; last_used_at; }
interface CreateKeyResponse { id; name; key; prefix; created_at; }
```

Result:
- `revealedKey.key` (line 113-114) is **always undefined** → user sees blank `<code>`. Newly-created secret never shown. Feature broken.
- `k.last_used_at` (line 171) is undefined → "Last used" column always renders `t('neverUsed')`. Misleading for active keys.
- `k.created_at` not displayed but type-mismatch.

**Fix:** Either rename client types to camelCase (`fullKey`, `lastUsedAt`, `createdAt`), or add a server-side mapping in route handlers to snake_case before responding. Recommend camelCase client to match d1-store contract.

---

### C3. F-3 — duplicate page conflicts with existing `/dashboard/api-keys`
**Files:**
- New: `src/app/[locale]/dashboard/settings/api-keys/page.tsx`
- Existing: `src/app/[locale]/dashboard/api-keys/page.tsx` (using `ApiKeyList`, `ApiKeyCreateModal`, `ApiKeyShowModal` from `@/forest/components/raas/`)
- Sidebar: `src/app/[locale]/dashboard/layout.tsx:193` links to `/dashboard/api-keys` (the OLD one)

Two parallel implementations now exist; sidebar still routes to the old page; new page is unreachable from nav.

Violates `development-rules.md`: *"DO NOT create new enhanced files, update to the existing files directly."*

**Fix:** Pick ONE:
(a) Replace the old page's contents with the new client and delete `forest/components/raas/api-key-*` if unused, OR
(b) Delete `dashboard/settings/api-keys/` and update the existing page+components instead.

---

## HIGH

### H1. F-1 — `user_id` is NULLABLE per migration 0087; cron passes NULL to addCredits
**File:** `src/app/api/cron/mcu-monthly-reset/route.ts:68-94`

Migration 0087 recreated `subscriptions` with `user_id TEXT` (NULLABLE — no NOT NULL constraint). Pre-0086 rows are NULL; org-only rows from old paths NULL. The query `select user_id, tier where status='active'` will return NULL user_id rows, which then call:
```ts
addCredits(user.user_id /* null */, monthlyMcu, ...)
```
Unsafe; `mcu_transactions.user_id` will be NULL or PK violation depending on table schema.

**Fix:** Add `.not('user_id', 'is', null)` filter, or `WHERE user_id IS NOT NULL` SQL guard. Optional: alert/log NULL-user-id rows for backfill.

The task brief asserted "user_id NOT NULL post-migration 0086" — this is incorrect; both 0086 and 0087 leave it NULLABLE.

---

### H2. F-2 — pre-deduct refund missing on upstream LLM 4xx/5xx
**File:** `src/app/api/v1/agent-chat/route.ts:84-90, 132-138`

Pre-deduct happens at line 84. If upstream returns `!response.ok` at 133 (401, 429, 502, etc.), the user has been charged 1 MCU for a failed call. Comment at 75-76 documents "we do not refund partial streams — full session is the unit," but a 4xx that returns *zero* tokens isn't a partial stream — it's a non-event. UX impact: zero-balance user wastes their last credit on provider rate-limit error.

**Fix:** Refund (call `addCredits(user.id, 1, 'agent_chat_failed_call')`) inside the `!response.ok` branch before sending error event.

Race-condition trade-off (concurrent deduct via atomic SQL guard) is acceptable as documented — `WHERE credits_remaining >= ?` with `meta.changes` check is verified correct.

---

### H3. F-3 — `listApiKeys` returns revoked keys; UI shows them
**Files:** `src/forest/api-keys/d1-store.ts:135-145`, `api-keys-client.tsx:166-189`

`listApiKeys` SELECT does not filter `revoked_at IS NULL`. Client renders all rows including revoked; user can hit Rotate/Revoke on already-revoked keys (fails with 404 silently). Also reveals revoked-key history without a status indicator.

**Fix:** Add `WHERE revoked_at IS NULL` to listApiKeys, or filter client-side and show status column.

---

### H4. F-4 — bilingual email subject + body doubles length, may trip spam filters
**File:** `src/seed/auth/better-auth-server.ts:100, 195-206`

Subject `"Sign in to Sophia AI Factory · Đăng nhập Sophia AI"` includes non-ASCII `·` and Vietnamese diacritics. Some MTAs (Outlook.com particularly) penalise mixed-script subject lines. Doubled-content body has fewer template tokens per word, but plausibly within thresholds — worth A/B monitoring.

**Fix (low-risk):** Use simpler ASCII-safe subject `"Sign in to Sophia · Đăng nhập"` or even drop bilingual subject and rely on body. Keep bilingual body.

Out-of-scope but flagged: F-4 doesn't use the user locale (better-auth callback doesn't expose it as noted in comment). If/when user locale becomes available, drop the unused half.

---

## MEDIUM

### M1. LOC overflow vs ≤200 rule
- `src/seed/auth/better-auth-server.ts` — 207 lines (was already over before F-4/F-5 added 14 lines)
- `src/app/api/promo/redeem-free/route.ts` — 210 lines (F-6 added ~12 lines for bilingual email + verify gate)

Both narrowly over. Refactor candidates: extract `buildMagicLinkHtml` + `buildWelcomeHtml` to `seed/email/templates/`, extract `findOrResolveUser` + `buildMagicLinkEmail` to `land/promo/redeem-helpers.ts`.

### M2. `confirm()` for destructive actions, inconsistent with prior wave UX pattern
**File:** `api-keys-client.tsx:72, 89`

Native `confirm()` blocks the main thread; prior waves established a banner/dialog pattern (`role="alert"` patterns already used at line 109). Acceptable for admin-tier destructive actions but inconsistent.

**Fix (optional):** Replace with shadcn `AlertDialog` for visual consistency.

### M3. `getCurrentUser` strip of `role` defaults to `'user'`
**File:** `src/seed/auth/better-auth-session.ts:49, 72`

`role: (user.role as string) ?? 'user'` — if Better-Auth returns role=null/undefined for some auth flow, fallback hides the issue. Not introduced by Wave 6 but adjacent to F-6 fix; consider tightening when adding emailVerified surfacing.

### M4. F-5 — no CHECK constraint guards `tier='BASIC'`
**Files:** migration 0086, 0087

Tables `subscriptions` after 0087 have `tier TEXT` with no constraint. F-5 inserts uppercase 'BASIC' (correct), but nothing prevents legacy code-paths from inserting 'basic' (lowercase). The cron's `TIER_MAP` accommodates both, so non-blocking, but the schema drift is a future bug-source.

**Fix (optional):** Add `CHECK (tier IS NULL OR tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER'))` in a follow-up migration.

---

## LOW

### L1. `addCredits` doesn't validate userId
**File:** `src/lib/mcu/credits-repo.ts:105-137`

No defensive `if (!userId) return` guard. Combined with H1, NULL-user_id from cron triggers DB error caught silently by try/catch. Add `if (!userId || amount <= 0) return;`.

### L2. F-6 unused `tier` parameter casting
**File:** `redeem-free/route.ts:184`

`tierToSend = (tier ?? preCheck.appliesToTier ?? 'MASTER') as Tier` — `'MASTER'` literal hardcoded but tier enum requires it; trust string fallback, fine. Style only.

### L3. Magic-link template has hardcoded production URL
**File:** `better-auth-server.ts:181`

`href="https://sophia.agencyos.network/setup-wizard"` — breaks for local/staging if Better-Auth `baseURL` differs. Use env var `process.env.NEXT_PUBLIC_APP_URL`.

---

## Positive Observations

- ✅ Zero `:any` types in changed files
- ✅ Zero `console.*` calls
- ✅ Zero banned imports (`@/lib/auth`, `@/lib/subscription`, etc.)
- ✅ Zero Polar.sh references
- ✅ F-1 idempotency guard via `wasRecentlyRun` is sound
- ✅ F-2 atomic deduct via `WHERE credits_remaining >= ?` is provably race-safe
- ✅ F-5 hook subscription insert correctly uses BASIC uppercase + user_id + org_id
- ✅ Zod validation present on POST endpoints (F-3, F-6)
- ✅ Rate limit (5/min) on POST `/api/v1/api-keys` is appropriate (F-3)
- ✅ Magic-link XSS-sanitised URL (F-4 line 191-193) — defensive
- ✅ Locale messages well-structured, parallel EN/VI keys (F-3)

---

## Edge Cases Found by Scout

1. F-6 anonymous-redeem-with-existing-email path returns 403 too — likely unintended (covered in C1).
2. F-1 NULL user_id rows from pre-migration data (covered in H1).
3. F-2 zero-token upstream failures still charge user (covered in H2).
4. F-3 revoked keys leak into list response (covered in H3).
5. Concurrent rotate+revoke on same key — second op gets 404; current UX shows error banner — acceptable.
6. F-3 DELETE returns 204; client reads `res.json()` only on `!res.ok`, safe.
7. `getCurrentUser()` (server-component variant in `page.tsx`) also strips `emailVerified` — same fix as C1 applies.

---

## Recommended Actions (priority order)

1. **C1** Surface `emailVerified` through `getCurrentUserFromHeaders` + `User` type. Re-test FREE100 logged-in flow.
2. **C2** Align client/server field naming (camelCase preferred). Verify revealed key visible after create.
3. **C3** Choose single api-keys page; delete the other; update sidebar link.
4. **H1** Add `user_id IS NOT NULL` filter to MCU cron query.
5. **H2** Refund 1 MCU on upstream `!response.ok` in agent-chat.
6. **H3** Filter revoked from `listApiKeys`.
7. **H4** Simplify magic-link subject if spam metrics regress post-deploy.
8. **M1** Modularise `better-auth-server.ts` and `redeem-free/route.ts` to ≤200 LOC.
9. **L1, L2, L3** clean-ups.

---

## Metrics

- Files changed: 7 (5 modified, 2 new)
- Total LOC: 984
- `:any` count: 0
- `console.*` count: 0
- Banned-import count: 0
- Polar references: 0
- LOC > 200 violations: 2

---

## Unresolved Questions

1. Is `/dashboard/api-keys` (old, with `ApiKeyList` component) still needed, or fully superseded by `/dashboard/settings/api-keys`?
2. Should anonymous FREE100 redeem against existing-email accounts be allowed (current = blocked by C1 fix path)?
3. Are pre-0086 subscriptions rows expected on production D1, or is the dataset already backfilled? (affects H1 urgency)
4. Should F-2 refund failed-LLM calls explicitly, or is "documented loss" the product decision?
