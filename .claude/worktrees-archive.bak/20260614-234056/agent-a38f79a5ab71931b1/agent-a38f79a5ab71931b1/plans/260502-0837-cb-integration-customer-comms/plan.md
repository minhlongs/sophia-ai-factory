# Plan: Circuit Breaker Integration + Customer Comms (B + F9-lite)

## Status
- Phase 01: Feature B — recordHeyGenAttempt integration [pending]
- Phase 02: Feature F9-lite — Customer outage comms [pending]

## Overview

**B**: Wire `recordHeyGenAttempt` into all HeyGen paths (retry cron + webhook), add `shouldDispatch()` guard in retry cron.
**F9-lite**: When circuit transitions `closed→open`, notify affected customers + extend bundle TTL 7 days.

## Key Files

### Feature B (modify only)
- `src/app/api/cron/fulfillment-retry/route.ts` — add shouldDispatch guard + recordHeyGenAttempt
- `src/lib/fulfillment/complete-video-from-webhook.ts` — add recordHeyGenAttempt in both handlers

### Feature F9-lite (create + modify)
- `src/lib/billing/email/templates/bundle-outage-apology.ts` — NEW bilingual template
- `src/lib/billing/email/send-bundle-outage-apology-email.ts` — NEW idempotent sender
- `src/lib/fulfillment/circuit-breaker-comms.ts` — NEW notifyCustomersOnOutage()
- `src/lib/fulfillment/circuit-breaker.ts` — add onCircuitOpen callback + transition detection
- `src/app/api/admin/ops/snapshot/route.ts` — add outageNotifications field
- `migrations/0046-billing-events-outage-tracking.sql` — unique index (local only)

## Constraints
- No `:any`, no `console.log`, files ≤200 LOC
- Idempotency via billing_events unique events
- Transition detection: ONLY closed→open edge, not while already open
- waitUntil for fire-and-forget in recordHeyGenAttempt
- Local migration only (no remote apply)

## Dependencies
- Phase 01 before Phase 02 (circuit-breaker.ts changes needed for callback hook)
