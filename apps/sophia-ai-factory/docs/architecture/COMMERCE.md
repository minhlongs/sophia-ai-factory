# Commerce — Digital Product Sales Layer

> **Status**: Implemented (Phase 4)
> **Goal**: Sell digital products (downloads / access grants) through the existing NOWPayments payment flow without touching the protected tier-activation chain.

## Problem / Vấn đề

Sophia's payment flow is a **protected flow**: NOWPayments IPN webhook → tier activation. Phase 4 adds digital-product commerce (sell a template, an ebook, an access grant) without breaking that chain.

Challenges:
- The IPN webhook must keep activating subscription tiers exactly as before.
- Commerce orders need their own lifecycle (`pending → paid → fulfilled`).
- Double IPN delivery from NOWPayments must be safe (no double-grant, no double-charge).
- Revenue from commerce must flow into the same `performance_events` pipeline so the Creative Economy dashboard sees it.

**Vietnamese:** Luồng thanh toán NOWPayments là luồng được bảo vệ (IPN → kích hoạt gói). Phase 4 thêm bán sản phẩm số mà không phá vỡ luồng đó, chống trùng IPN, và đưa doanh thu vào cùng pipeline `performance_events`.

## Architecture / Kiến trúc

```
NOWPayments IPN webhook (app/api/webhooks/nowpayments)
  │
  ├─ order_id matches a commerce order? ──YES──► confirmCommercePayment (land/commerce)
  │                                                │  pending → paid (idempotent)
  │                                                │  enqueue commerce/payment.confirmed
  │                                                ▼
  │                                          forest commerce-fulfillment (Inngest)
  │                                                │  fulfillOrder (exactly-once)
  │                                                │  emit revenue/event.recorded
  │                                                ▼
  │                                          ingestion atomic lock → performance_events
  │
  └─ NO (ORDER_NOT_FOUND) ──► standard tier-activation chain (UNCHANGED)
```

The routing decision is made by `routeCommerceIpn` in the webhook route. A non-commerce `order_id` returns `ORDER_NOT_FOUND`, which the route treats as "fall through to tier activation" — the protected flow is untouched.

## Modules / Mô-đun (`src/land/commerce/`)

| File | Responsibility |
|------|----------------|
| `product-model.ts` | Zod schemas + row mapper for `CommerceProduct` |
| `product-catalog.ts` | Product CRUD (create/get/list/update/deactivate) |
| `order-model.ts` | Zod schemas + row mapper + `buildCommerceEventId` |
| `commerce-order.ts` | Order lifecycle: `createOrder`, `markOrderPaid`, `markOrderFulfilled` |
| `commerce-payment.ts` | `confirmCommercePayment` — the IPN→order bridge |
| `digital-fulfillment.ts` | `fulfillOrder` — exactly-once grant |
| `actions/` | Server Actions (`create-product`, `list-products`, `update-product`) |
| `index.ts` | Public API barrel (internal helpers NOT re-exported) |

Forest orchestration: `src/forest/inngest/functions/commerce-fulfillment.ts` (forest→land orchestration exception).

## Key Invariants / Bất biến

### 1. Financial code never throws
Every function returns `Result<T, E>` via `success()` / `failure()` from `@/seed/types/result`. Expected failures are typed error codes, not exceptions.

### 2. Idempotency at three layers
- **Order paid**: `markOrderPaid` uses `UPDATE ... WHERE status = 'pending'` + `meta.changes` check. Re-confirming a paid/fulfilled order returns `transitioned: false`, not an error.
- **Fulfillment**: `commerce_fulfillments` has `UNIQUE(order_id)`; the insert is `INSERT ... ON CONFLICT(order_id) DO NOTHING`. `meta.changes` decides ownership. A duplicate delivery returns `alreadyFulfilled: true`.
- **Revenue event**: event id `commerce_{productId}_{orderId}` is deduped by the ingestion atomic lock (`revenue-event-lock`).

### 3. No live platform calls in fulfillment
The grant is a deterministic reference (`access:<assetRef>` or `download:<orderId>`) persisted on the fulfillment row. Fulfillment is safe to retry because it makes no external call.

### 4. Timestamps are MILLISECONDS
Matches the `performance_events` convention (`strftime('%s','now') * 1000`).

### 5. Soft-delete products
`deactivateProduct` sets `is_active = 0`; products are never hard-deleted because orders reference them.

## Data Model / Mô hình dữ liệu (migration `0261_commerce_tables.sql`)

```sql
commerce_products   (id, workspace_id, name, description, product_type,
                     price_cents, currency, asset_ref, is_active, metadata,
                     created_at, updated_at)

commerce_orders     (id, workspace_id, product_id, buyer_user_id, quantity,
                     amount_cents, currency, status, payment_provider,
                     external_payment_id, metadata, created_at, updated_at)
                     -- status: pending|paid|fulfilled|failed|refunded

commerce_fulfillments (id, order_id UNIQUE, product_id, workspace_id, status,
                       grant_ref, error, fulfilled_at, created_at)
                       -- status: pending|granted|failed
```

`amount_cents` is a **price snapshot** taken at order creation (`product.price_cents × quantity`), so later price changes don't affect existing orders.

## Error Codes / Mã lỗi

| Domain | Codes |
|--------|-------|
| Product | `INVALID_INPUT`, `DB_UNAVAILABLE`, `NOT_FOUND`, `WRITE_FAILED` |
| Order | `INVALID_INPUT`, `DB_UNAVAILABLE`, `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `NOT_FOUND`, `WRITE_FAILED` |
| Payment | `INVALID_INPUT`, `DB_UNAVAILABLE`, `ORDER_NOT_FOUND`, `WRITE_FAILED` |
| Fulfillment | `DB_UNAVAILABLE`, `ORDER_NOT_FOUND`, `ORDER_NOT_PAID`, `WRITE_FAILED` |

`ORDER_NOT_FOUND` from `confirmCommercePayment` is the **webhook fall-through signal** — it means "this is not a commerce order, run tier activation instead."

## Testing / Kiểm thử

Deterministic fixtures via the in-memory D1 shim (`freshDb` / `makeD1`). No live platform data. Coverage:
- `commerce-order.test.ts` — lifecycle transitions, idempotent `markOrderPaid`
- `commerce-payment.test.ts` — IPN bridge, `ORDER_NOT_FOUND` fall-through, replay safety
- `digital-fulfillment.test.ts` — exactly-once grant, duplicate delivery

## Non-Goals / Không làm (Phase 4)

- ❌ Full autonomous publishing / autonomous checkout flows
- ❌ Refund processing (status exists, no automation)
- ❌ Physical product fulfillment
- ❌ Multi-currency conversion (price stored in product currency)
