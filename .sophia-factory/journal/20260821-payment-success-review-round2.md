# Journal — 2026-08-21: Payment-Success Review Round 2

## Codename
PAYMENT-SUCCESS-REVIEW-ROUND2

## What happened
Code review of the P0 payment-success fix identified 4 issues. All resolved in two follow-up commits.

## Issues found and fixed

### H1 (HIGH): False "Reloading in 3 seconds..." text
The `isComplete` branch of `PaymentStatusPoller` showed "Reloading in 3 seconds..." but never triggered a reload. User would stare at a misleading message forever.
**Fix:** Replaced with honest copy ("check your email for a receipt") + locale-aware dashboard Link component.

### M1 (MEDIUM): Concurrent poll requests
When HTTP latency exceeded the 4s poll interval, multiple `fetch` calls would overlap.
**Fix:** Added `pollingRef` guard — async callback returns early if a poll is already in-flight.

### M2 (MEDIUM): `sku` query parameter not handled
One-time SKU purchases (`nowpayments-client.ts:135`) redirect with `?sku=...&order_id=...` but the page only read `tier`.
**Fix:** Added `sku` to searchParams, added `success_sku` i18n key, render SKU name when present.

### M3 (LOW): Vietnamese typo
`vi.json` had "Chúng đang xác nhận" (incomplete sentence) → fixed to "Chúng tôi đang xác nhận".

## Commits
- `19299f8f3` — payment-success page + sku handling + i18n keys + Vietnamese typo
- `6f1ee3d09` — poller false reload text + concurrent poll guard + dashboard Link

## Verification
- `npx tsc --noEmit` → exit 0 (both commits)
- `npx vitest run` → 7112 passed, 0 failed (both commits)

## Remaining non-blocking items
- **GAP-2 (P2):** `parseUserIdFromOrderId` truncates userIds with underscores — low risk (Better Auth UUIDs)
- **GAP-3 (P2):** Redundant PayOS webhook routes — mitigated by `FEATURE_PAYOS` defaulting to false
- **GAP-4 (P1):** Migration 0044 status unknown — documentation issue

## Impact
- Payment-success page is now production-ready for first paying customer
- No infinite reload loop risk
- One-time SKU checkout flow is handled
