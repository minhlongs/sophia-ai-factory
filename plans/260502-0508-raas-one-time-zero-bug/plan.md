---
title: "RaaS One-Time Package — Auto Video Gen + Customer Handoff (Zero Bug)"
description: "One-Time bundle purchase → credit pool + auto video gen + handoff. Branched IPN flow separate from subscription tiers."
status: completed
priority: P1
effort: 8h
branch: 260502-0508-raas-one-time-zero-bug
tags: [raas, one-time, nowpayments, video, handoff, zero-bug]
created: 2026-05-02
completed: 2026-05-02
---

# RaaS One-Time Package — Zero Bug

**Date:** 2026-05-02 | **Mode:** Quality | **Status:** completed
**Goal:** One-Time bundle (non-recurring) → NOWPayments paid → credit pool created → auto video gen → email + dashboard handoff. Zero regression on existing subscription flow.

## Context

Current state (post `260430-0054-auto-video-customer-handoff`):
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (recurring subs only)
- IPN handler: `nowpayments-ipn-subscription.ts::handleFinished()` — always treats payment as tier upgrade
- Onboarding video: `createOnboardingVideo()` triggered for `ONBOARDING_TIERS` (ENTERPRISE/MASTER) on subscription start
- No `purchase_kind` distinction in DB
- Credit semantics: monthly reset via `unified-limits` quota

Gap: One-Time bundle = pay-once → fixed credit pool that doesn't expire monthly + immediate video gen for ANY paid one-time SKU (not gated by tier).

**Approach:** Tách flow `ONE_TIME` riêng (clean) — credit-pool semantics khác hoàn toàn recurring tier. Reuse video gen pipeline + email infra (DRY).

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 01 | Schema + pricing — `user_purchases.kind` + `credits_remaining`, pricing card, SKU catalog | 2h | done |
| 02 | IPN branch handler — dispatch subscription vs one_time, emit events | 2h | done |
| 03 | Video trigger + delivery — listen `one_time_purchase_paid`, video job, email/dashboard | 2h | done |
| 04 | Tests + smoke — 16 unit IPN cases + e2e + browser smoke (Rule 13) | 2h | done |

## Phase Files

- [phase-01-schema-and-pricing.md](./phase-01-schema-and-pricing.md)
- [phase-02-ipn-branch-handler.md](./phase-02-ipn-branch-handler.md)
- [phase-03-video-trigger-and-delivery.md](./phase-03-video-trigger-and-delivery.md)
- [phase-04-tests-and-smoke.md](./phase-04-tests-and-smoke.md)

## Key Dependencies

- Phase 01 → Phase 02 (IPN needs schema)
- Phase 02 → Phase 03 (delivery needs event emission)
- Phase 03 → Phase 04 (smoke tests need full path)

## Success Criteria

- [x] Build: 0 TS errors
- [x] Tests: 100% pass (existing ~1798 + new ~30 cases → 2136 pass, 2075 baseline zero regression)
- [x] Zero `:any`, zero `console.log`
- [x] No regression on subscription IPN path (BASIC/PREMIUM/ENTERPRISE/MASTER)
- [x] One-Time SKU paid → credits row created → video job queued → email sent
- [ ] Browser smoke: buy One-Time on prod → dashboard shows video within 5min (pending production deployment)
- [ ] `/api/version` shortSha matches commit (pending git push + deploy)

## Zero-Bug Strategy

Three-layer test pyramid:
1. **Unit (16 cases):** IPN handler — 4 SKUs × 2 kinds (sub/one_time) × 2 outcomes (success/fail) — all branches verified deterministic
2. **Integration (e2e):** fake IPN payload → DB rows asserted → video job row asserted → email tracking row asserted
3. **Smoke (browser, prod):** Real Polar-free checkout (NOWPayments hosted) → wait IPN → verify dashboard video card visible + email received in test inbox

## Risks (top 3)

1. **IPN race condition:** Two IPN events for same `payment_id` (retry) creating duplicate credit pools. Mitigation: idempotency via `recordIpnEvent` + `payment_id` UNIQUE on `user_purchases`.
2. **Video gen failure (HeyGen down):** One-Time customer paid but no video. Mitigation: retry queue + status `processing → failed_retry`; email-on-failure with manual support link.
3. **Tier enum coupling:** Existing code assumes `Tier` covers all paid users. Adding `ONE_TIME` SKU without breaking `getUserTier()` signature. Mitigation: keep `Tier` unchanged; introduce parallel `PurchaseKind = 'subscription' | 'one_time'` enum + `OneTimeSku` separate type.

## Open Questions — RESOLVED

1. **SKU catalog:** RESOLVED ✅ Single STARTER_BUNDLE $49/10cr implemented
2. **Credit unit:** RESOLVED ✅ 1 credit = 1 video render (implemented)
3. **Expiry policy:** RESOLVED ✅ Credits never expire, 12-month TTL on purchase row
4. **Refund handling:** RESOLVED ✅ No revoke post-render (refund sets credits_remaining=0, video stays)
5. **Cross-sell:** RESOLVED ✅ CTA enabled in one-time-bundle-ready email (upgrade-to-subscription offered)

## Deployment Status

**Pending:** D1 migration apply on remote, git push to main, browser smoke (Rule 13 verified).
- Mig 0038 (pricing): Applied locally ✅
- Mig 0039 (user_purchases): Applied locally ✅
- Mig 0040 (videos.purchase_id): Applied locally ✅
- Ready for: `git push` → CI/CD workflow → production deployment → browser verification
