# Project: Robust Edge Case Fixes

## Architecture
This project addresses 10 critical edge cases across payments, authentication, credits & video generation, and usage metering.
- **Payments**: Idempotency for NOWPayments and PayOS webhooks; VND amount verification and match order fallback removal in PayOS IPN.
- **Auth**: Direct DB lookup for admin validation bypassing session cookie caching; fail-closed MFA validation in middleware during DB connectivity failures.
- **Video & Credits**: Compare-And-Swap (CAS) check on HeyGen webhook fulfillment; true row mutation check in optimistic credit decrement; batched execution of retry jobs in the cron route.
- **Quota Metering**: Atomic increments with expiry in Redis (Upstash) for realtime tracking; SQL-level aggregations for D1 usage calculations.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Payments & Webhooks Security | Fix concurrent duplicate IPN requests (idempotency race) for NOWPayments/PayOS, verify PayOS amount, and remove insecure fallback match (Cases 1.1, 1.3, 1.4) | None | DONE |
| 2 | M2: Authentication & MFA | Enforce direct DB checks for demoted admins, and fail-closed MFA checks on DB connectivity failures (Cases 2.2, 2.4) | M1 | DONE |
| 3 | M3: Credits & Video Concurrency | Implement Compare-And-Swap (CAS) for HeyGen success webhooks, correct optimistic locking in `decrementCredits`, and chunk cron retry jobs (Cases 3.1, 3.3, 3.4) | M2 | DONE |
| 4 | M4: Metering & Performance | Implement atomic Redis updates and migrate D1 usage rollup from JS reductions to SQLite aggregations (Cases 4.1, 4.2) | M3 | DONE |
| 5 | M5: Global Validation & CI Gates | Verify TypeScript compilation (`npm run ci:typecheck`), unit tests (`npm run ci:test`), and docs script (`python3 scripts/verify-go-live-docs.py`) | M4 | DONE |

## Interface Contracts
- **Payment Events Locking**: Insert rows into `payment_events` table (or similar D1 table) with a unique constraint on `event_id` (e.g. `nowpayments_{paymentId}` and `payos_{orderCode}`).
- **MFA Fail Closed**: In `middleware.ts`, wrap D1 calls in `try-catch` blocks and redirect to login or error endpoint on catch.
- **Admin Verification**: Force a query to `user_profiles` table directly in D1 instead of relying solely on `user.role` from cookie.
- **HeyGen Webhook Status**: Atomic update statement in SQLite/D1 checking `status != 'completed'` before transitioning to `completed`.
- **Credit Decrement Mutated Row**: `decrementCredits` returns `false` if the D1 update affected 0 rows.
- **Quota Checking**: SQL conditional sum query replacing multiple JS `select` queries and reductions.

## Code Layout
- NOWPayments IPN: `apps/sophia-ai-factory/src/land/billing/nowpayments-ipn-handlers.ts`
- PayOS IPN: `apps/sophia-ai-factory/src/app/api/payos/ipn/route.ts`
- Admin Lookup: `apps/sophia-ai-factory/src/seed/auth/is-user-admin.ts`
- Middleware: `apps/sophia-ai-factory/src/middleware.ts`
- HeyGen Fulfillment: `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`
- User Purchases Repo: `apps/sophia-ai-factory/src/seed/db/repositories/user-purchases-repo.ts`
- Retry Queue Cron: `apps/sophia-ai-factory/src/app/api/cron/fulfillment-retry/route.ts`
- Realtime Tracker (Redis): `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts`
- Quota Checker DB: `apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts`
