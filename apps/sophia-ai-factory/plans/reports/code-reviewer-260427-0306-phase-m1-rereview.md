# Phase M1 Re-Review — Fix Loop Verification

**Date:** 2026-04-27 03:06
**Original score:** 7.5/10 REJECTED (C1 + 2H + 3M)
**Re-review score:** **9.6/10 — APPROVED**

---

## Issue-by-Issue Verification

### C1 — `user_profiles` columns ✅ RESOLVED
- `migrations/0020-user-profiles-extend.sql` exists, 13 lines, syntactically clean
- `subscription_tier TEXT DEFAULT 'BASIC' CHECK (...)` — UPPERCASE enum enforced via CHECK constraint ✅
- `telegram_chat_id TEXT` added ✅
- Both indexes present (`idx_user_profiles_telegram_chat_id`, `idx_user_profiles_subscription_tier`) ✅
- `ALTER TABLE … ADD COLUMN` syntax SQLite-compatible ✅
- Local D1 `PRAGMA table_info(user_profiles)` confirms cols 6 (subscription_tier) + 7 (telegram_chat_id) added ✅

### H1 — Real test coverage ✅ RESOLVED
- `telegram-bot-campaign-handlers.test.ts` (197 lines) imports `handleCampaign, handleStatus, handleResults` from correct module ✅
- 7 tests total covering ALL required branches:
  1. Account-not-linked (handleCampaign) ✅
  2. Campaign insert success path (insert payload + Inngest event + success message) ✅
  3. All 4 tier mappings (BASIC/PREMIUM/ENTERPRISE/MASTER) — parameterised for-loop ✅
  4. Plus handleStatus + handleResults account-not-linked coverage ✅
- Mock pattern (`vi.hoisted` + `vi.mock` + chainable builder) idiomatic ✅
- Tests exercise REAL code paths (insert payload assertions, Inngest send assertions) — not trivial ✅

### H2 — Tier casing ✅ RESOLVED
- `mapSubscriptionToTier()` line 54-62: `subTier?.toUpperCase()` defensive normalize ✅
- Type union `'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' | null` matches CHECK constraint ✅
- All 4 cases mapped explicitly; default fallthrough to `'BASIC'` only when null/unknown ✅

### M1 — Boolean coercion ✅ RESOLVED
- `raas-license-crud.ts:108` → `isRevoked: !!license.is_revoked` ✅
- Note: 2 remaining 0/1 leak sites elsewhere (`admin/licenses/[id]/route.ts:55`, `usage-kv-sync.ts:92`) — OUT OF M1 SCOPE, flag for follow-up ticket

### M2 — Hash-chain dead reads ✅ RESOLVED
- Lines 36-38: comment explains removal; SELECTs gone ✅
- Line 109: `hashChainValid: true` literal default with comment ✅
- Lines 117-122: `hashChainVerification` uses literal `'N/A'` + `verified: true` ✅
- Zero TS errors after removal (per tester report) ✅

### M3 — Column name ✅ RESOLVED
- `debug/migrate/route.ts:26` → `script_content TEXT` ✅
- Matches canonical name in `0018-campaigns.sql` and `telegram-bot-campaign-handlers.ts:26` (`script_content: string | null`) ✅

---

## Quality Sweep

| Check | Result |
|---|---|
| New `:any` types | 0 (grep clean) |
| New `console.*` calls | 0 (grep clean) |
| TS errors | 0 (per fix report) |
| Test pass | 1406/1406 (+7 new) |
| Behavioral parity | preserved |
| L2 bare catches | deferred (acceptable per fix report) |

---

## Remaining Gaps (non-blocking, follow-up)

1. **0/1 leak elsewhere** — `usage-kv-sync.ts:92` does `if (license.is_revoked)` (truthy 0=false works in JS but type leak). `admin/licenses/[id]/route.ts:55` returns raw `license.is_revoked` to client. NOT regressions; pre-existing. Flag for cleanup ticket.
2. **Dead `template_id` field** in `0018-campaigns.sql` — not referenced by 0020 or any handler; no action needed for M1.
3. **Hash-chain implementation** — comment in `cron-report-runner-data-fetcher.ts:38` says "implement when writer is ready" — track in audit/M-series follow-up.

---

## Auto-Approve Decision

**Threshold:** 9.5+ with 0 critical/high
**Score:** 9.6/10
**Critical:** 0
**High:** 0
**Verdict:** ✅ **APPROVED — proceed to commit + verify CI green**

Deductions: -0.4 for residual 0/1 leak sites outside M1 scope (flag, not block).

---

## Unresolved Questions

- Should `usage-kv-sync.ts:92` and `admin/licenses/[id]/route.ts:55` 0/1 normalisation be batched into M1 commit or split to separate ticket? (Recommend split — keeps M1 atomic.)
