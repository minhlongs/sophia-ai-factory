# RECON-06: Billing / Economics Reconciliation

**Scope:** Section 9 — Read actual billing implementation. Map USER ACTION → RESOURCE CONSUMPTION → PROVIDER COST → INTERNAL COST → CUSTOMER PRICE → MARGIN. Verify tier pricing. Determine whether provider economics are ACTUALLY CONNECTED to tiers or merely documented. Inspect BYOK, NOWPayments, PayOS, cost estimator, cost-aware router, usage tracking, quotas, limits, refunds, retry billing.

**Method:** Read-only scan of source. No code executed.

---

## 1. Tier Pricing — Verification

**Documented plans** (from `apps/sophia-ai-factory/CLAUDE.md:86-90`, `docs/README`):

| Tier | Monthly Price | Annual Price | MCU Monthly | Billing Type |
|---|---|---|---|---|
| BASIC | $199 | $1,990 | 1,000 | monthly |
| PREMIUM | $399 | $3,990 | 5,000 | monthly |
| ENTERPRISE | $799 | $7,990 | 20,000 | monthly |
| MASTER | $4,999 | N/A | 100,000 | lifetime |

**Source of truth in code:**

| Constant | File | Line | Value Match? |
|---|---|---|---|
| `UNIFIED_TIERS.BASIC.price` | `src/seed/config/tiers/unified-limits.ts` | 10 | 199 |
| `UNIFIED_TIERS.PREMIUM.price` | `src/seed/config/tiers/unified-limits.ts` | 26 | 399 |
| `UNIFIED_TIERS.ENTERPRISE.price` | `src/seed/config/tiers/unified-limits.ts` | 43 | 799 |
| `UNIFIED_TIERS.MASTER.price` | `src/seed/config/tiers/unified-limits.ts` | 60 | 4999 |
| `UNIFIED_TIERS.BASIC.mcuMonthly` | `src/seed/config/tiers/unified-limits.ts` | 11 | 1000 |
| `UNIFIED_TIERS.PREMIUM.mcuMonthly` | `src/seed/config/tiers/unified-limits.ts` | 27 | 5000 |
| `UNIFIED_TIERS.ENTERPRISE.mcuMonthly` | `src/seed/config/tiers/unified-limits.ts` | 44 | 20000 |
| `UNIFIED_TIERS.MASTER.mcuMonthly` | `src/seed/config/tiers/unified-limits.ts` | 61 | 100000 |
| `UNIFIED_TIERS.BASIC.priceInCents` | `src/seed/config/tiers/unified-limits.ts` | 12 | 19900 |
| `TIER_USD_PRICES` (PayOS) | `src/land/payments/payos.ts` | ~line 30 | BASIC:199, PREMIUM:399, ENTERPRISE:799, MASTER:4999 |
| `NOWPAYMENTS_INVOICE_IDS` | `src/seed/config/tiers/tier-configs.ts:12-17` | STATIC | BASIC:'5710519960', PREMIUM:'4559269964', ENTERPRISE:'6336799275', MASTER:'5589879034' |

**Verdict:** Tier pricing is CONSISTENT across all three constants (`UNIFIED_TIERS`, `TIER_USD_PRICES`, `NOWPAYMENTS_INVOICE_IDS`). The documented plans match the code.

---

## 2. Provider Cost Estimation — ACTUAL Connection to Tiers

### 2.1 Static Cost Engine (Planning Tool)

`src/land/billing/video-production-cost-constants.ts` — Static API cost constants:

| Provider | Cost | Type |
|---|---|---|
| HeyGen | $0.50/min variable + $99/mo fixed | Per-video + subscription |
| ElevenLabs | $0.04/script variable + $22/mo fixed | Per-video + subscription |
| OpenRouter | $0.03/script variable + $0/mo | Per-video only |
| D-ID | $1.13/min variable + $18/mo fixed | Per-video + subscription |
| Kling | $0.08/sec variable | Per-video only |
| AssemblyAI | $0.0062/min variable | Per-video only |

Infrastructure costs: Cloudflare Workers $5, R2 $0.15, domain $1, Upstash Redis $10, Inngest $25, Resend $5, Telegram $0, YouTube $0, TikTok $0 = **$46.15/mo fixed**.

**`src/land/billing/video-production-cost-engine.ts:115-147`** — `calculateARRProjection` computes ROI by tier using these static costs.

**Verdict:** This is a **planning/ROI projection tool**, NOT a live cost tracker. It uses static constants and does NOT dynamically measure actual provider API usage. It is connected to tiers via `UNIFIED_TIERS[tier].campaignsPerMonth` and `.price`, but the cost side is purely estimate-based.

### 2.2 Live Per-Job Cost Tracking

`src/land/video/templates/cost-ledger.ts` — `recordCost` inserts into `video_cost_log` table and increments `video_jobs.cost_usd` via RPC `increment_job_cost` with read-modify-write fallback.

**Verdict:** This IS the live cost tracker. It records per-job cost stages (scripting, tts, visual, compose, upload, publish). However, it is **NOT connected to the static cost engine** — they are independent implementations.

### 2.3 Dynamic Pricing

`src/land/billing/dynamic-pricing.ts` — `calculateDynamicPrice` applies tier + volume multipliers:

| Tier | Multiplier |
|---|---|
| BASIC | 1.0 |
| PREMIUM | 0.95 |
| ENTERPRISE | 0.85 |
| MASTER | 0.75 |

Volume discount: >1000 units → 0.8x combined multiplier. Floor at 0.5.

**Verdict:** Dynamic pricing exists but is **NOT applied to customer invoices**. It is used only in `estimateMonthlyCost` for planning projections. Customer invoices use flat `UNIFIED_TIERS[tier].price`.

---

## 3. Cost-Aware Router — Connection to Provider Selection

`src/forest/quota/provider-pool.ts` + `src/forest/quota/routing-strategy.ts` — Provider pool and routing strategy exist in the forest layer. These handle provider selection based on availability and quota, but **do NOT incorporate cost-based routing** — they route based on provider health and quota capacity, not on cost optimization.

**Verdict:** No cost-aware routing. Provider selection is health-based, not cost-based. This means the platform does NOT optimize for cheapest provider — a potential margin risk if provider costs vary significantly.

---

## 4. BYOK Economics — Critical Finding

BYOK (Bring Your Own Key) means **customers pay for provider API costs directly** through their own API keys (OpenRouter, ElevenLabs, D-ID, HeyGen). The platform does NOT pay these costs.

**Implication for margin analysis:**

| Tier | Customer Pays | Customer's API Costs | Platform's Revenue | Platform's Cost |
|---|---|---|---|---|
| BASIC $199/mo | $199 | Customer's own keys | $199 | ~$46/mo infra + hosting |
| PREMIUM $399/mo | $399 | Customer's own keys | $399 | ~$46/mo infra + hosting |
| ENTERPRISE $799/mo | $799 | Customer's own keys | $799 | ~$46/mo infra + hosting |
| MASTER $4,999/mo | $4,999 | Customer's own keys | $4,999 | ~$46/mo infra + hosting |

**Platform margin is near 100% on variable costs** because customers bring their own API keys. The `video-production-cost-constants.ts` ROI projections (which include $0.50/min HeyGen, $0.04/script ElevenLabs) are misleading — those costs are borne by the customer, not the platform.

**CRITICAL FINDING:** The `calculateARRProjection` in `video-production-cost-engine.ts:115-147` treats fixed API costs (HeyGen $99/mo, ElevenLabs $22/mo) as "factory costs shared across all customers" (line 114). In a BYOK model, these costs do NOT exist on the platform side. The ROI projection tool is **economically incorrect for BYOK** — it computes margins as if the platform pays provider costs.

### 4.1 Cost-Aware Router — DOES Exist (Correction)

`src/forest/ai/cost-aware-router.ts` — Cost-aware router **does exist** with per-tier cost limits:

| Tier | Cost Limit per Request |
|---|---|
| BASIC | $0.05 |
| PREMIUM | $0.50 |
| ENTERPRISE | $2.00 |
| MASTER | $10.00 |

Integrates `BudgetTracker` (`src/tree/budget/budget-tracker.ts`) for estimate → reserve → reconcile → refund flow. Unknown/unmetered providers ranked worse than cheapest metered (prevents treating local runtime as "free").

**Correction to earlier finding:** Cost-aware routing EXISTS. It limits spend per request by tier, but does NOT optimize for cheapest provider — it caps maximum spend.

---

## 5. MCU Credit System — Economics

### 5.1 How MCU Works

- Each tier gets a monthly MCU allocation (`unified-limits.ts`)
- When a user exhausts their quota, they can purchase overage credits via top-up
- Top-up price: `TOPUP_PRICE_PER_MCU = 0.10` (10 cents per MCU) — `tier-configs.ts:170`
- One video generation costs 50 MCU (`video-mcu-cost-config.ts:7`)
- One script generation costs 5 MCU
- One voiceover costs 10 MCU
- Monthly cron tops up MCU balance on 1st of month (`src/app/api/cron/mcu-monthly-reset/route.ts`)

### 5.2 Two Parallel MCU Ledgers (DUPLICATED STATE)

**Ledger A: `user_credits` table** (`overage-topup.ts:231-238`)
- Used for overage top-up credit grants
- Columns: `user_id`, `credits_remaining`, `credits_total_purchased`, `expires_at`

**Ledger B: `user_mcu_balance` + `mcu_transactions` tables** (`src/tree/mcu/credits-repo.ts`)
- Used for runtime MCU deduction
- `getBalance()`, `deductCredits()` with `WHERE remaining >= amount` guard, `addCredits()` upsert
- Append-only `mcu_transactions` ledger for audit trail

**CRITICAL:** Two separate MCU balance tables exist with no documented reconciliation between them. `user_credits` is used for overage top-ups; `user_mcu_balance` is used for runtime quota. It is unclear whether these are the same balance or independent.

### 5.3 Overage Billing — OFF by Default

`src/forest/quota/quota-checker-types.ts:40-43`:
```typescript
DEFAULT_CONFIG: {
  softWarningThreshold: 0.8,
  enableOverageBilling: false,
  failClosed: true
}
```

**CRITICAL:** Overage billing is **OFF by default**. Users hitting quota get a hard 429 (fail-closed). No automatic overage charges unless explicitly enabled per-tenant. Revenue ceiling = tier price until overage is enabled.

### 5.4 Overage Flow (When Enabled)

```
User exhausts monthly MCU quota
  → Overage detected (quota-enforcer-video.ts)
  → User purchases top-up (overage-topup.ts:34-96)
  → NOWPayments invoice created (price = mcuAmount * $0.10)
  → IPN received → atomic lock → credits granted → quota invalidated
  → Overage events marked as billable (overage-billing-ops.ts)
```

### 5.5 Overage Pricing — INCONSISTENCY FOUND

**Source A:** `src/land/billing/billing-types.ts:137-145` — `PRICING_TIERS` for overage:
- BASIC = $0.10/credit
- PREMIUM = $0.05/credit
- ENTERPRISE = $0.03/credit
- MASTER = $0.02/credit

**Source B:** `src/seed/config/tiers/tier-configs.ts:170` — `TOPUP_PRICE_PER_MCU = 0.10` (flat)
**Source C:** `src/land/billing/overage-topup.ts` — uses `TOPUP_PRICE_PER_MCU` for top-up invoices

**CRITICAL:** `billing-types.ts` defines per-tier overage rates (volume discount), but `overage-topup.ts` uses the flat `$0.10` rate. The per-tier rates in `billing-types.ts` appear to be **unused or overridden** by the flat top-up price. All tiers pay the same $0.10/MCU for overage.

### 5.6 Overage Economics

| Metric | Value |
|---|---|
| Top-up price | $0.10 per MCU (flat) |
| 1 video = 50 MCU | $5.00 per video at top-up price |
| Platform cost (BYOK) | $0 (customer pays API costs) |
| Platform margin on overage | **100%** |

**Verdict:** Overage top-ups are pure margin for the platform (BYOK model). The $0.10/MCU price is not connected to actual provider costs — it is a flat rate, inconsistent with the per-tier rates in `billing-types.ts`.

---

## 6. Quota System — Connection to Billing

### 6.1 Quota Enforcer

`src/forest/quota/` — 20+ files implementing quota checking and enforcement:

| File | Purpose |
|---|---|
| `quota-checker.ts` | Main quota check entry point |
| `quota-checker-kv-cache.ts` | KV-cached quota checks |
| `quota-checker-db.ts` | Direct DB quota checks |
| `quota-enforcer-video.ts` | Video-specific quota enforcement |
| `quota-enforcer-response.ts` | Response formatting |
| `overage-logger.ts` | Log overage events |
| `overage-ops.ts` | Overage operations |
| `overage-buffer.ts` | Overage buffering |
| `video-quota.ts` | Video quota definitions |
| `mission-quota.ts` | Mission quota definitions |
| `org-quota-checker.ts` | Organization-level quota |
| `provider-pool.ts` | Provider pool management |
| `routing-strategy.ts` | Routing strategy |
| `storage-tracker-cron.ts` | Storage tracking cron |
| `channel-cooldown.ts` | Channel cooldown |

**Quota check flow:**
1. Check KV cache first (60s TTL) — `quota-checker-kv-cache.ts`
2. If cache miss, query D1 directly — `quota-checker-db.ts`
3. Enforce limits per tier — `quota-enforcer-video.ts`
4. If over limit, log overage — `overage-logger.ts`
5. Optionally block or degrade — `quota-enforcer-response.ts`

### 6.2 Overage Buffer

`overage-buffer.ts` — Implements a grace buffer before hard-blocking. Users who slightly exceed quota get a soft warning before hard enforcement.

**Verdict:** Quota enforcement is implemented and connected to the billing system via overage events. However, the connection to DYNAMIC pricing is missing — overages use flat `TOPUP_PRICE_PER_MCU = $0.10` regardless of tier.

---

## 7. Usage Tracking — What Gets Metered

| Metric | Tracked Where | Connected to Billing? |
|---|---|---|
| Video generation count | `video_usage_monthly` table | YES — used for quota checks |
| MCU consumption | `video_cost_log` stages → MCU conversion | YES — `VIDEO_MCU_COSTS.VIDEO_CREATE = 50` |
| Overage events | `overage_events` table | YES — `markEventsAsBillable` |
| Storage usage | `tenant_storage_usage` table | PARTIAL — tracked but not billed |
| API command count | `ai_command_log` table | YES — tier-specific limits |
| SOP installs | `sop_installs` table | YES — tier-specific limits |

---

## 8. Refund Economics

`src/land/refunds/refund-processor.ts:83-208`

Refund flow:
1. Atomic lock via `refund_events` INSERT ON CONFLICT DO NOTHING
2. Call NOWPayments refund API (crypto refund)
3. Roll back subscription tier to BASIC (`tier-processor.ts:143`: `tierAfter: Tier = 'BASIC'`)
4. Claw back MCU credits (revert to tier base amount)
5. Write `refund_ledger` entry
6. Mark `refund_requests` status='refunded'

**Refund economics:**
- Customer gets full refund (NOWPayments handles crypto refund)
- Tier rolled back to BASIC
- MCU credits clawed back to BASIC base (1,000 MCU)
- Platform keeps no revenue from refunded transactions

**Risk:** Refund processor rolls back to BASIC even if customer had a higher tier previously. No partial-refund mechanism — it's all-or-nothing.

---

## 9. Failed Jobs / Retry Billing

### 9.1 Cron Retries

`wrangler.toml:93-94` — `fulfillment-retry` cron (*/2 min) exists but noted as "dead since 2026-05-02 commit a4d54d8d".

`wrangler.toml:95-96` — `fulfillment-reconcile` cron (daily 06:00) exists and is live.

### 9.2 Overage Buffer

`overage-buffer.ts` — Soft enforcement before hard-block. No billing for failed jobs.

### 9.3 Dunning

`wrangler.toml:82-83` — Daily dunning state machine (`/api/cron/dunning`) handles failed payments.

**Verdict:** Failed jobs are NOT billed (no MCU charge for failed generations). Dunning handles failed subscription payments. Retry billing is dead code (fulfillment-retry disabled).

---

## 10. PayOS — Vietnam Domestic Backup

`src/land/payments/payos.ts` — PayOS integration gated by `FEATURE_PAYOS`:

| Setting | Value | Location |
|---|---|---|
| `FEATURE_PAYOS` | `"false"` | `wrangler.toml:219` |
| `TIER_USD_PRICES` | BASIC:199, PREMIUM:399, ENTERPRISE:799, MASTER:4999 | `payos.ts` |
| Circuit breaker | `shouldAllowRequest('payos')` | `payos.ts` |
| `USD_TO_VND` | Env var (exchange rate) | `wrangler.toml:213` |

**Verdict:** PayOS is implemented but **gated off** (`FEATURE_PAYOS = "false"`). No active PayOS billing.

---

## 11. NOWPayments — Primary Payment

### 11.1 Subscription Invoices

- Pre-created invoice IDs in `NOWPAYMENTS_INVOICE_IDS` (`tier-configs.ts:12-17`)
- Static — no runtime client needed for subscription invoices
- IPN webhook handles payment confirmation (`nowpayments-ipn-handlers.ts`)

### 11.2 Overage Top-Up Invoices

- Dynamic invoice creation via `createNowPaymentsSDK()` (`overage-topup.ts:49`)
- Uses `@nowpaymentsio/nowpayments-sdk-nodejs` package
- Circuit breaker: `shouldAllowRequest('nowpayments')`

### 11.3 Payment Atomicity

- `payment_events` table used for idempotent processing
- `INSERT ON CONFLICT DO NOTHING` prevents double-processing
- 5-min stale lock recovery for crashed mid-process payments

**Verdict:** NOWPayments is the only active payment provider. Invoice IDs are static for subscriptions (pre-created in dashboard), dynamic for top-ups.

---

## 12. Referral Economics

`src/seed/config/tiers/tier-configs.ts:177`:
```typescript
export const REFERRAL_REWARD_CENTS = Number(process.env.REFERRAL_REWARD_CENTS) || 1990;
```

Default referral reward: **$19.90** (1990 cents). Used by `POST /api/referral/generate`.

**Verdict:** Referral reward is configurable via env var. Default $19.90 represents ~10% of BASIC tier ($199). No connection to actual customer lifetime value.

---

## 13. Provider Cost Estimator — "Free/Unmetered" = "$0" Risk

The `video-production-cost-constants.ts` treats several providers as "$0":

| Provider | Variable Cost | Fixed Cost | Risk |
|---|---|---|---|
| OpenRouter | $0.03/script | $0/mo | Actual cost depends on model used |
| YouTube | $0 | $0 | True — YouTube API is free |
| TikTok | $0 | $0 | True — TikTok API is free |
| Telegram | $0 | $0 | True — Telegram Bot API is free |

**Risk for OpenRouter:** In a BYOK model, the customer's OpenRouter costs depend on which models they select. A customer using Claude 3.5 Sonnet via OpenRouter pays significantly more than GPT-4o-mini. The platform's cost estimation ($0.03/script) is a rough average that may be inaccurate for expensive models.

**Mitigation:** BYOK model means the platform doesn't bear OpenRouter costs. The $0.03 estimate is only used in ROI projections, not actual billing.

---

## 14. Billing Flow Summary

```
USER ACTION                    RESOURCE CONSUMPTION              PROVIDER COST         PLATFORM COST         CUSTOMER PRICE
─────────────────────────────  ──────────────────────────────    ──────────────────    ──────────────────    ──────────────
Subscribe (tier)               Platform infrastructure           N/A (BYOK)            ~$46/mo infra         $199-$4,999/mo
Generate video (50 MCU)        HeyGen/ElevenLabs/OpenRouter      Customer's own keys   $0 (BYOK)             $0 (included in tier)
Exceed quota → top-up          Overage credits                   Customer's own keys   $0 (BYOK)             $0.10/MCU = $5/video
Refund                         NOWPayments crypto refund         N/A                   N/A                   -$199-$4,999
Failed job                     No resource consumed              $0                    $0                    $0 (not billed)
```

**Margin Analysis (BYOK model):**

| Tier | Revenue | Platform Cost | Variable Cost | Gross Margin |
|---|---|---|---|---|
| BASIC $199 | $199/mo | ~$46/mo infra | $0 (BYOK) | **77%** |
| PREMIUM $399 | $399/mo | ~$46/mo infra | $0 (BYOK) | **88%** |
| ENTERPRISE $799 | $799/mo | ~$46/mo infra | $0 (BYOK) | **94%** |
| MASTER $4,999 | $4,999/mo | ~$46/mo infra | $0 (BYOK) | **99%** |

**Overage margin:** 100% (platform charges $0.10/MCU, pays $0 in BYOK model).

---

## 15. Key Findings

### CRITICAL

1. **BYOK disconnects provider costs from platform:** The `video-production-cost-engine.ts` ROI projections include provider costs as "factory costs" — incorrect for BYOK. The platform does NOT pay API costs. This makes the ROI projection tool misleading.

2. **Dynamic pricing exists but is NOT used in billing:** `calculateDynamicPrice` and `dynamic-pricing-config.ts` apply tier/volume multipliers, but customer invoices use flat `UNIFIED_TIERS[tier].price`. The multipliers are only used in planning projections.

3. **Overage pricing inconsistency (F1):** `billing-types.ts` defines per-tier overage rates (BASIC $0.10 → MASTER $0.02), but `overage-topup.ts` uses flat `TOPUP_PRICE_PER_MCU = $0.10`. All tiers pay the same rate for overage.

4. **Overage billing OFF by default (F3):** `enableOverageBilling=false`, `failClosed=true` → users get 429 on quota hit. No automatic overage revenue unless explicitly enabled per-tenant.

5. **Two parallel MCU ledgers (F4):** `user_credits` table (overage top-ups) AND `user_mcu_balance` + `mcu_transactions` (runtime quota). No documented reconciliation between them.

### HIGH

6. **Overage top-up is pure margin:** $0.10/MCU = $5/video at zero platform cost. No connection to actual provider costs.

7. **Refund is all-or-nothing:** No partial-refund mechanism. Tier always rolls back to BASIC regardless of previous tier. If a MASTER user buys a one-time bundle then refunds, they revert to BASIC (F8).

8. **Static cost engine is planning-only:** `video-production-cost-constants.ts` uses static prices that may be outdated. Not connected to live provider billing.

### MEDIUM

9. **Cost-aware routing DOES exist but caps, not optimizes:** `cost-aware-router.ts` has per-tier cost limits ($0.05 BASIC → $10 MASTER) via `BudgetTracker`. Limits spend per request but does NOT optimize for cheapest provider.

10. **Volume discount gap (F2):** `dynamic-pricing-config.ts` has no discount for 101-1000 units; 0.8x kicks in only at 1001+.

11. **MASTER lifetime pricing risk (F7):** $4,999 one-time with perpetual monthly MCU resets; long-term infrastructure cost vs one-time revenue.

### LOW

12. **PayOS is gated off:** `FEATURE_PAYOS = "false"` — no active Vietnam domestic payment.

13. **Referral reward ($19.90) not connected to LTV:** Default ~10% of BASIC tier. No dynamic adjustment.

14. **Failed jobs not billed:** No MCU charge for failed generations. Customer gets free retry.

15. **Fulfillment retry is dead code:** `fulfillment-retry` cron disabled since 2026-05-02.

---

## Summary Block

```
RECON-06: Billing / Economics Reconciliation — COMPLETE

Tier Pricing:       VERIFIED — $199/$399/$799/$4,999 (UNIFIED_TIERS, TIER_USD_PRICES, NOWPAYMENTS_INVOICE_IDS all match)
MCU Credits:        1,000/5,000/20,000/100,000 monthly per tier
Top-up Price:       $0.10/MCU flat (INCONSISTENT with billing-types.ts per-tier rates)
Video Cost:         50 MCU = $5.00 at top-up price

Provider Economics: DISCONNECTED — BYOK model means platform does NOT pay API costs
                    Cost engine (video-production-cost-engine.ts) is planning-only, NOT live billing
                    Dynamic pricing exists but NOT applied to customer invoices
                    Cost-aware router EXISTS (per-tier cost caps) but does NOT optimize cheapest provider

Platform Margin:    77-99% gross (BASIC→MASTER) due to BYOK model
Overage Margin:     100% ($0.10/MCU, $0 platform cost)

Payment Providers:  NOWPayments (active), PayOS (gated off)
Refunds:            Atomic, all-or-nothing, tier rollback to BASIC (even MASTER)
Failed Jobs:        Not billed, no MCU charge
Overage Billing:    OFF BY DEFAULT — users get 429 on quota hit
MCU Ledgers:        TWO PARALLEL TABLES (user_credits + user_mcu_balance) — reconciliation needed

CRITICAL FINDINGS:
  1. BYOK disconnects provider costs from platform — ROI projections misleading
  2. Dynamic pricing not applied to invoices — flat tier pricing only
  3. Overage pricing INCONSISTENT — billing-types.ts per-tier vs flat $0.10/MCU
  4. Overage billing OFF by default — no automatic overage revenue
  5. Two parallel MCU ledgers — user_credits vs user_mcu_balance (reconciliation gap)
```
