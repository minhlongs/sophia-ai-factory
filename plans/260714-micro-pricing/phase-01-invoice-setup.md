# Phase 1: Invoice + SKU Setup

**Effort:** Founder action (15 min) + code (10 min)
**Status:** PENDING — founder creates invoices in NOWPayments dashboard

---

## Context

Three credit pack invoices must be pre-created in NOWPayments dashboard. Invoice IDs
must NOT collide with existing subscription IDs (`5710519960`, `4559269964`,
`6336799275`, `5589879034`) or the `STARTER_BUNDLE` one-time invoice (`7810429001`).

---

## Founder Action Required

Log into https://nowpayments.io → Invoices → Create 3 invoices:

| SKU ID | Label (VI) | Label (EN) | Price (USD) | Credits | Invoice ID (pick any unused 10-digit) |
|--------|-----------|-----------|-------------|---------|---------------------------------------|
| `CREDIT_PACK_STARTER` | 10 Credits | Starter Pack — 10 credits | $29 | 10 | TBD |
| `CREDIT_PACK_STANDARD` | 50 Credits | Standard Pack — 50 credits | $129 | 50 | TBD |
| `CREDIT_PACK_POWER` | 200 Credits | Power Pack — 200 credits | $449 | 200 | TBD |

After creation, provide the 3 invoice IDs to the developer.

---

## Code Change (10 min)

**File:** `src/seed/config/one-time-skus.ts`

Add 3 entries to `ONE_TIME_SKUS`:

```typescript
CREDIT_PACK_STARTER: {
  id: 'CREDIT_PACK_STARTER',
  invoiceId: '<founder-provided-id>',  // e.g. '9012345001'
  priceUsd: 29,
  credits: 10,
  ttlMonths: 3,  // 90 days = TOPUP_CREDIT_EXPIRY_DAYS
  label_vi: '10 Credits — Gói Khởi Đầu',
  label_en: '10 Credits — Starter Pack',
},
CREDIT_PACK_STANDARD: {
  id: 'CREDIT_PACK_STANDARD',
  invoiceId: '<founder-provided-id>',
  priceUsd: 129,
  credits: 50,
  ttlMonths: 3,
  label_vi: '50 Credits — Gói Tiêu Chuẩn',
  label_en: '50 Credits — Standard Pack',
},
CREDIT_PACK_POWER: {
  id: 'CREDIT_PACK_POWER',
  invoiceId: '<founder-provided-id>',
  priceUsd: 449,
  credits: 200,
  ttlMonths: 3,
  label_vi: '200 Credits — Gói Nâng Cao',
  label_en: '200 Credits — Power Pack',
},
```

**Note:** `ttlMonths: 3` maps to ~90 days. The actual expiry is computed by
`addMonths(new Date(), sku.ttlMonths)` in `nowpayments-ipn-one-time.ts:91`.

---

## Protected Flow Check

- NOWPayments IPN handler: **no changes** — `one_time` kind already routes correctly
- `lookupInvoice()` in `nowpayments-client.ts`: already scans `ONE_TIME_SKUS` + `NOWPAYMENTS_TIERS`
- No new invoice IDs conflict with existing subscription IDs (separate namespace)

---

## Verification

1. `npm run build` passes
2. `npm test -- land/billing/__tests__/nowpayments-ipn-one-time.test.ts` passes
3. Zod schema `OneTimeSkuMapSchema` validates on module load (fail-fast)
