# /cook FREE100 Dashboard 100/100 — Rate Limit State

**Date:** 2026-05-04 03:04 PT
**Status:** PARTIAL — Anthropic API rate limit hit, resets 05:20 PT (~2h 16min)

## What's done

- ✅ **Phase 1:** Migration `0086-subscriptions-add-user-tier-trial.sql` applied to remote D1. Columns added: `user_id`, `tier` (trial_ends_at already existed).
- ✅ **Phase 2A partial:** 
  - `src/seed/db/get-user-tier.ts` — user-scoped subscription lookup first, org-based fallback, BASIC fallback. Handles FREE100 customers without org.
  - `src/tree/handover/handover-account-setup.ts` — added `ensureCustomerOrg(db, userId, email)` idempotent helper (creates organizations + org_members + org_balances). `upsertUserTier` now calls it before INSERT subscriptions with org_id+user_id+tier.

## What's NOT done

### Phase 2A remaining
- Magic-link email send in `src/app/api/promo/redeem-free/route.ts`
- Surface silent handover failure to user (`auto-handover.ts`, `redeem-page-client.tsx`)
- Promo validator `'already_redeemed'` reason (was `'user_limit'`)
- Promo applier transaction wrapper (race condition on concurrent redeems)
- `setUserTrialExpiry` verify works post-migration

### Phase 2B (NOT STARTED)
- Postback HMAC verification (Binance, Bybit, PartnerStack, Awin, ClickBank, TikTok Shop)
- Affiliate scout `org_id` filter
- New file: `src/lib/postback/hmac-verifier.ts`

### Phase 2C (NOT STARTED — agent created orphan import, reverted)
- Dashboard `hasApiKeys` derive → use `onboarding_completed_at`
- `TIER_MCU_LIMITS` fallback → query subscriptions.tier directly
- "First campaign" CTA widget on dashboard
- Tier badge use `TIER_CONFIG[tier].label`
- i18n keys for new CTA

### Phase 3 (NOT STARTED)
- URL-to-Revenue Inngest dispatch (`url-to-revenue.ts`)
- ElevenLabs → R2 audio upload
- Video failure → R2 cleanup
- Telegram DM after FREE100 redeem

### Phase 4 (NOT STARTED)
- tester agent
- code-reviewer agent
- Deploy via `npm run deploy:full`
- Browser verify FREE100 redeem flow

## Resume after 5:20am PT

Prompt to use:
```
/cook continue from plan apps/sophia-ai-factory/plans/reports/cook-260504-0304-rate-limit-state.md — resume Phase 2A remaining (magic-link email + silent handover surface + already_redeemed + transaction), then dispatch Phase 2B/2C/3 in parallel, then Phase 4 finalize.
```

Or invoke per-phase manually:
- Phase 2A remaining: `/cook fix magic-link email send + silent handover surface + already_redeemed reason + race condition transaction in promo flow`
- Phase 2B: `/cook implement postback HMAC verify all networks + affiliate scout org_id isolation`
- Phase 2C: `/cook polish dashboard for MASTER tier — hasApiKeys logic + TIER_MCU fallback + first-campaign CTA`
- Phase 3: `/cook wire URL-to-Revenue Inngest + ElevenLabs R2 + video R2 cleanup + Telegram DM after redeem`

## Current state safe to commit?

YES — the partial work is self-coherent:
- Migration applied (idempotent)
- getUserTier upgrade is backwards-compatible (still falls back to org)
- ensureCustomerOrg is opt-in (only called from handover path)
- tsc → 0 errors
- Build untested but type-clean

Recommend: commit partial as `feat: subscriptions schema + tier resolution + customer org helper` to lock in foundation, resume from clean state after rate limit.
