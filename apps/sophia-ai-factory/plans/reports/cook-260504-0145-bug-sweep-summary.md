# /cook Bug Sweep — Final Summary

**Date:** 2026-05-04
**Trigger:** D1 setup wizard step 5 error "no such table: user_api_keys"
**Plan:** `apps/sophia-ai-factory/plans/260504-0127-bug-sweep-ux-flow/plan.md`

## Outcome

24 issues identified, **22 fixed**, 2 reverted/deferred per security review.

## Phase results

| Phase | Status | Notes |
|---|---|---|
| Migration apply (immediate fix) | ✅ | `0011-user-api-keys.sql` applied to remote D1 |
| A — Wizard gate DB-based | ✅ | middleware reads `onboarding_completed_at` with cookie fallback |
| B — Wizard UX hardening | ✅ | retry 3x backoff, isTransitioning, type guard, bilingual errors, unified VerifyKeyResponse |
| C — HeyGen webhook fail-safe | ✅ | `webhook_registered` field, UI banner |
| D — Dashboard CTA + form | ✅ | disabled coming-soon buttons, affiliate validation msg, removed dup hidden input, template empty state |
| E — Bilingual error.tsx (7 files) | ✅ | useTranslations + i18n keys |
| F — Signup + auth polish | ✅ | removed 1200ms setTimeout, subscriptions INSERT in user.create |
| G — OAuth callbacks → D1 | ❌ REVERTED | Read-path in 4 files not migrated → would break YT/TT publish. Defer until read-path migration is part of same change |
| H — Type safety (13 `:any`) | ✅ | All eliminated; `tsc --noEmit` 0 errors |
| P0-1 localStorage leak | ✅ | Re-fixed: persist only `step` number, never API keys |

## Verification

- `npm run build` → exit 0 (Next.js + Turbopack, 144 pages)
- `npm test -- --run` → 2796/2827 passed (31 skipped)
- `tsc --noEmit` → 0 errors
- `setup-wizard` tests → 18/18 pass
- Migration 0062 (`onboarding_completed_at`) verified applied on remote D1
- BYOK_MASTER_KEY confirmed set in CF Workers production secrets

## Security re-review

P0-1 localStorage leak (initial fix persisted raw API keys to localStorage):
- **Resolved:** Now persists only `step: number`. API keys never written to localStorage.
- Storage key bumped `v1 → v2`; v1 cleared on next mount via `clearPersistedState()`.
- Trade-off: user re-enters keys on F5 refresh. Accepted vs. XSS / Chrome profile sync exposure.

## Deferred (out of scope this session)

- OAuth callbacks D1 migration (need to migrate 4 read-paths simultaneously: `youtube-channel-adapter.ts`, `tiktok-channel-adapter.ts` caller, `dashboard/page.tsx` `hasApiKeys` derive, `tier-guard.ts` channel count)
- Dead success-state block in `signup-form.tsx` (cosmetic, post-removed setTimeout)
- 6 documented TODOs (postback HMAC, cron HTTP migration, R2 wiring, commission %, Inngest, KV) — separate roadmap
- `d1_migrations` tracking sync (cosmetic; schema actually in sync)
- `D1QueryChain.upsert()` `onConflict` arg never worked at runtime (silently dropped) — type-level cleanup verified no functional regression

## Files changed (29 total)

**Wizard:** `middleware.ts`, `api/setup/save/route.ts`, `api/setup-wizard/save-credentials/route.ts`, `api/setup-wizard/test-heygen/route.ts`, `api/setup-wizard/test-resend/route.ts`, `setup-wizard/page.tsx`, `forest/components/setup-wizard/local-mode-step.tsx`

**i18n:** `messages/vi.json`, `messages/en.json`, 7 `dashboard/*/error.tsx`

**Dashboard/Auth:** `dashboard/integrations/integration-card.tsx`, `dashboard/components/create-campaign/{campaign-form,template-selector}.tsx`, `forest/components/auth/signup-form.tsx`, `seed/auth/better-auth-server.ts`

**Type safety:** `land/billing/dunning/{dunning-attempt-recorder,dunning-actions}.ts`, `land/billing/email/email-tracking-service.ts`, `forest/quota/overage-logger-ops.ts`, `tree/telegram/telegram-state-backup-service.ts`, `app/api/license/sync/license-sync-db.ts`, `app/api/admin/violations/route.ts`, `forest/components/billing/usage-summary-card.tsx`

## Unresolved questions

1. OAuth read-path migration: dedicated session needed. Estimate ~2 hours (4 files + tests + browser verify YT publish still works).
2. Should D1QueryChain expose `upsert(payload, { onConflict })` with proper SQLite `INSERT ... ON CONFLICT(col) DO UPDATE` codegen? Current `INSERT OR REPLACE` semantics work for current callers but limit future use.
3. Browser smoke test of wizard after deploy: signup → wizard step 1-5 → /dashboard → first campaign. Required per Sophia handover Rule 13 before declaring DONE.
