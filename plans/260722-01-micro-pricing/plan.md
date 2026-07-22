# L-Plan: ID-01 Usage-Based Micro-Pricing
> Created: 2026-07-22 | Worker: planner | Contract: M1 | Priority: P1

## Objective
Add credit packs as additive overlay to existing subscription quotas. Preserve current subscription MRR while opening pay-as-you-go path.

## Assumed Decisions (overridable)
- Hybrid model confirmed: subscription base + credit overlay
- Credit packs: 10/$29, 50/$99, 200/$299
- Credits expire in 90 days
- NOWPayments coupon/override acceptable on existing subscription webhook (non-breaking)

## Phase 1: Schema + Migration (2h)
- Create D1 `credits` table with expiry fields and idempotency columns
- Preserve `tiers` enum; do not change `getUserTier` lookup
- Validation: existing subscription flows unchanged

## Phase 2: Purchase Flow (3h)
- Add credit-pack checkout via NOWPayments override logic
- IPN handler: safe-add credits, never overwrite existing subscription quota
- Idempotency key per credit purchase

## Phase 3: Quota Enforcement (2h)
- Video generation path: check `subscription_quota + credits_available`
- Deduct 1 credit per generation invocation
- Nightly expiry cron for 90-day credit rolloff

## Phase 4: Upsell UX (2h)
- 80% quota utilization modal offers credit pack; do NOT force tier upgrade
- Bilingual VN+EN copy; non-tech CEO friendly
- Success path: purchase -> credit added -> generation continues

## Phase 5: Observability (1h)
- Extend usage_events with per-video cost columns in follow-on phase, not this plan

## Verification Gates
- npm test: existing suite must remain passing
- Manual: purchase 10-credit pack -> verify +10 credits visible -> generate video -> -1 credit
- Billing: reconcile NOWPayments invoice vs D1 credit delta

## Risks
- Q1 answer flips to pure usage-based: requires M2 migration (out of scope here)
- 90-day expiry edge cases around timezone and partial months need acceptance criteria
