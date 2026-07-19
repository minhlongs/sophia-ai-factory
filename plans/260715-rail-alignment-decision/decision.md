# Rail Alignment Decision — NOWPayments Agency Billing
> Status: DECIDED | Date: 2026-07-15 | Author: Kongming + Sophia Team

## Problem
Agency billing (agency-billing.ts) currently infers tier from payment AMOUNT
(inferTierFromAmount) because there is no invoice-level tracking per sub-client.
This couples price changes to routing logic and limits flexibility.

## Current Architecture (3 Rails)
- Rail 1 (Individual Subscription): invoice_id -> getTierByInvoiceId -> activate subscription ($199/$399/$799/$4999/mo)
- Rail 2 (One-time SKU): invoice_id -> getOneTimeSkuByInvoiceId -> credit pack purchase ($49/$29/$129/$449 one-time)
- Rail 3 (Agency): order_id starts with "ag_" -> inferTierFromAmount(price_amount) -> agency tier ($500/$1500/$3000/mo)

## Options Evaluated

### Option A: Shared NOWPayments + Amount Detection (Current)
Pros: Already implemented, zero NOWPayments setup, simple
Cons: Price changes break routing, agency/individual share account, cannot support custom agency pricing
Effort to unblock Track D: 0h (already works)

### Option B: Separate NOWPayments Merchant Account per Agency Tier — REJECTED
Pros: Clean separation, NOWPayments native handling, per-tier reporting
Cons: NOWPayments merchant account = operator setup = VIOLATES NO-TECH DOCTRINE
Decision: Cannot comply with BYOK doctrine

### Option C: Invoice-Level Routing with Agency Prefix — RECOMMENDED
Architecture:
  Agency Rail: order_id "ag_" -> lookupAgencyInvoice(invoiceId) ->
    AgencyInvoiceConfig { agencyId, tier, monthlyPrice, credits, tenantId? }

Implementation:
1. Create NOWPAYMENTS_AGENCY_INVOICE_IDS map in nowpayments-client.ts
2. Add lookupAgencyInvoice(invoiceId) function
3. Replace inferTierFromAmount with invoice lookup (fallback to amount detection)
4. Add agency invoice creation API endpoint

## Decision: Option C
Rationale:
- Aligns agency rail with existing individual subscription rail pattern (invoice_id lookup)
- Enables credit pack pass-through (agency buys bulk credits, sub-tenants consume)
- No operator setup required (BYOK doctrine preserved)
- Unblocks Track D (ARR gap fill) and micro-pricing agency tier simultaneously
- Minimal code change: ~2-3 files, ~100 lines

## Impact
- Unblocks: Track D (ARR gap fill, 42-58h), credit pack agency pass-through, tenant isolation billing contract
- Does NOT break: Individual subscription rail, one-time SKU rail, existing agency payments
- Risk: LOW — additive change, old agency payments continue working via fallback to amount detection

## Next Steps
1. Implement NOWPAYMENTS_AGENCY_INVOICE_IDS config + lookup function
2. Update agency-billing.ts to use invoice lookup (with fallback to amount detection)
3. Add agency invoice creation API
4. Wire credit pack pass-through for agency sub-tenants
