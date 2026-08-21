# Journal — 2026-08-21: Payment-Success P0 Fix

## Codename
PAYMENT-SUCCESS-P0-FIX

## What happened
Fixed a P0 blocker found in the T003 payment flow validation: the `payment-success` page route did not exist. After NOWPayments redirects a paying customer back, they landed on a broken page with no confirmation UI.

## Root cause
The checkout panel and NOWPayments client both redirect to `/payment-success?tier=X&order_id=Y` after checkout creation, but no `page.tsx` had been created at that route path. The catch-all `[...rest]/page.tsx` triggers `notFound()`, so Next.js returned HTTP 200 (layout rendered without a page body) but showed no UI.

## Files
- **Created**: `src/app/[locale]/payment-success/page.tsx` — server component matching the failure page pattern
- **Modified**: `messages/en.json`, `messages/vi.json` — 5 new i18n keys in `checkout` namespace

## Verification
- `npx tsc --noEmit` — exit 0
- `npx vitest run` — 7112 passed, 0 failed
- Route now resolves for all 9 redirect targets identified in T003

## Impact
- Unblocks the first paying customer flow end-to-end
- No breaking changes to existing routes, API contracts, or DB schemas
- `PaymentStatusPoller` component (already complete) is now actually rendered

## Open items from T003
- GAP-2 (P2): `parseUserIdFromOrderId` truncates userIds with underscores — low risk (Better Auth UUIDs don't have underscores)
- GAP-3 (P2): Redundant PayOS webhook routes — mitigated by `FEATURE_PAYOS` defaulting to false
- GAP-4 (P1): Migration 0044 status unknown — documentation issue
