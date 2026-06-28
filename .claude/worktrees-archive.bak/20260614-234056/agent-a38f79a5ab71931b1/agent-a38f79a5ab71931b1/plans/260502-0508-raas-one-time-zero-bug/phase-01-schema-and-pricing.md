# Phase 01 — Schema + Pricing

## Context Links

- Sibling plan video pipeline: `plans/260428-0117-video-pipeline-content-factory/`
- Sibling plan auto handoff: `plans/260430-0054-auto-video-customer-handoff/`
- Existing migrations dir: `apps/sophia-ai-factory/migrations/` (sequential 00XX-*.sql)
- Existing pricing page: `apps/sophia-ai-factory/src/app/[locale]/pricing/`
- NOWPayments client: `apps/sophia-ai-factory/src/lib/clients/nowpayments-client.ts`
- Tier configs: `apps/sophia-ai-factory/src/config/tiers/tier-configs.ts`

## Overview

- **Priority:** P1 (foundation — blocks Phase 02/03)
- **Status:** done
- **Description:** Add `user_purchases` table với `kind` discriminator + `credits_remaining`. Wire One-Time SKU catalog vào NOWPayments client. Add pricing page card.

## Key Insights

- `user_purchases` MUST be NEW table — KHÔNG modify `subscriptions` (avoid breaking recurring flow)
- `payment_id` UNIQUE → idempotency primitive for IPN retries
- One-Time SKU IDs riêng biệt, KHÔNG đè lên `NOWPAYMENTS_TIERS` map
- Pricing card phải tone-match existing tier cards (Tailwind 4 + same component)
- Bilingual copy mandatory (Vi/En) — non-tech CEO Vietnamese

## Requirements

**Functional:**
- DB table `user_purchases` lưu mọi giao dịch (sub renewal + one_time bundle) với `kind` discriminator
- Credit pool field `credits_remaining INTEGER` — không tự reset monthly
- SKU catalog `ONE_TIME_SKUS` map: `{ skuId, invoiceId, priceUsd, creditsGranted, label_vi, label_en }`
- Pricing page card "One-Time Bundle" với CTA → NOWPayments invoice
- Migration safe to re-run (idempotent `CREATE TABLE IF NOT EXISTS`)

**Non-functional:**
- File <200 lines
- Zero `:any`
- Zod schema for SKU catalog
- Build pass on edit

## Architecture

```
DB:
  user_purchases
    id PK
    user_id FK → user.id
    payment_id UNIQUE       -- NOWPayments payment_id (idempotency)
    kind TEXT CHECK in ('subscription','one_time')
    sku_id TEXT             -- tier name OR one_time SKU id
    invoice_id TEXT         -- NOWPayments invoice_id
    amount_usd REAL
    credits_granted INTEGER -- 0 for subscription, N for one_time
    credits_remaining INTEGER -- decremented on consumption
    status TEXT CHECK in ('pending','paid','refunded','failed')
    created_at INTEGER
    paid_at INTEGER
    refunded_at INTEGER
  INDEX (user_id, kind, status)
  INDEX (payment_id) UNIQUE

Code:
  src/config/one-time-skus.ts    -- SKU catalog (parallel to tier-configs)
  src/types/index.ts             -- add PurchaseKind, OneTimeSku types
  src/app/[locale]/pricing/...   -- add One-Time card component
```

## Related Code Files

**Create:**
- `apps/sophia-ai-factory/migrations/0039-user-purchases.sql`
- `apps/sophia-ai-factory/src/config/one-time-skus.ts`
- `apps/sophia-ai-factory/src/lib/db/repositories/user-purchases-repo.ts`
- `apps/sophia-ai-factory/src/components/pricing/one-time-bundle-card.tsx`

**Modify:**
- `apps/sophia-ai-factory/src/types/index.ts` — add `PurchaseKind`, `OneTimeSkuId`, `UserPurchase`
- `apps/sophia-ai-factory/src/lib/clients/nowpayments-client.ts` — add `getOneTimeSkuByInvoiceId()`
- `apps/sophia-ai-factory/src/app/[locale]/pricing/page.tsx` — render `<OneTimeBundleCard>`

**Delete:** none

## Implementation Steps

1. Write migration `0039-user-purchases.sql` với schema trên + 2 indexes
2. Add types: `PurchaseKind`, `OneTimeSkuId`, `UserPurchase` interface, `OneTimeSku` config interface
3. Create `one-time-skus.ts` — initial 1 SKU (validate with CEO before adding more):
   - `STARTER_BUNDLE`: $49 → 10 credits, no expiry
4. Update `nowpayments-client.ts`: add `ONE_TIME_INVOICE_IDS` map + lookup helpers (KEEP existing tier maps unchanged)
5. Create repo `user-purchases-repo.ts`: `insertPurchase()`, `getByPaymentId()`, `decrementCredits()`, `listByUser()`
6. Create `one-time-bundle-card.tsx` — Tailwind card, bilingual labels (read locale from `useTranslations`)
7. Wire card into pricing page (below tier grid)
8. Run `npm run build` in `apps/sophia-ai-factory/` — assert 0 errors
9. Apply migration locally: `wrangler d1 execute sophia-raas-db --local --file=migrations/0039-user-purchases.sql`

## Todo List

- [x] Write migration SQL (0038-pricing, mig 0039-user-purchases)
- [x] Add PurchaseKind + OneTimeSku types
- [x] Create one-time-skus catalog (1 SKU: STARTER_BUNDLE $49/10cr)
- [x] Extend nowpayments-client invoice lookup
- [x] Create user-purchases repo
- [x] Create OneTimeBundleCard component
- [x] Wire card into pricing page
- [x] Bilingual labels Vi/En verified
- [x] Build pass (0 TS errors)
- [x] Migration applied to local D1

## Success Criteria

- [x] `wrangler d1 execute --local` migration runs clean
- [x] `npm run build` exit 0
- [x] `npm test` no new failures
- [x] `<OneTimeBundleCard>` renders at `/[locale]/pricing` both `vi` and `en`
- [x] Repo CRUD passes a manual smoke (`repo.insertPurchase` then `getByPaymentId`)

## Risk Assessment

- **DB schema drift prod vs local:** Apply migration to prod via wrangler in Phase 04 only after CI green. Mitigation: use `IF NOT EXISTS`.
- **NOWPayments invoice ID collision:** One-Time SKU ID must NOT clash with existing tier invoice IDs. Mitigation: dedicated `ONE_TIME_INVOICE_IDS` map + dispatcher checks one_time first then tier.
- **Currency rounding:** $49.00 vs $49 stored as REAL. Mitigation: store as INTEGER cents (`amount_cents`) — TODO confirm with current `subscriptions.amount` convention.

## Security Considerations

- `payment_id` from IPN is attacker-controllable until HMAC verified — Phase 02 handles HMAC; Phase 01 only writes to DB AFTER Phase 02 caller verified
- `credits_remaining` decrement must be atomic (UPDATE WHERE credits_remaining > 0) to prevent race on parallel consumption

## Next Steps

- Phase 02 reads `getOneTimeSkuByInvoiceId()` to branch IPN
- Phase 03 reads repo to fetch credits for video gen
