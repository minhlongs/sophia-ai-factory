# Phase 02 — Post-Payment Welcome Trigger

## Context Links
- `apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts` — IPN entrypoint
- `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-handlers.ts` — dispatcher
- `apps/sophia-ai-factory/src/lib/handover/auto-handover.ts` — orchestrator (already wires email)
- GAP2 plan: `plans/260503-0830-sophia-self-serve-checkout-flow/`

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 30m

`auto-handover.ts` already calls `sendAutoHandoverWelcomeEmail`. Goal here = guarantee **trigger fires once and only once**, with retry on transient failure, and surfaces failure to admin Telegram alert. Today the email send is "best-effort" inside try/catch — needs durable enqueue.

## Key Insights
- D1 doesn't have native queues; use `welcome_email_outbox` table polled by existing cron (`/api/cron/email-drip` pattern) for retry
- IPN must remain idempotent on `payment_id` — `auto-handover.ts` already has `handoverExistsForPayment` guard
- Admin Telegram alert path exists in `uptime-check` cron — reuse helper

## Requirements
- Welcome email enqueue is part of the same D1 transaction that creates handover record (or compensating row if separate)
- Failed sends retry up to 5× with exponential backoff
- After 5 failures, fire Telegram alert to admin chat
- Idempotent: same `payment_id` → exactly one email row

## Architecture
```
IPN webhook → nowpayments-ipn-handlers
            → triggerAutoHandover (existing)
                ├── createHandoverRecord (existing)
                ├── INSERT INTO welcome_email_outbox (NEW — replaces direct send)
                └── return result
                
Cron /api/cron/email-outbox-flush (NEW, every 1 min)
            → SELECT pending rows
            → renderEmail + sender.sendEmail
            → on success: status='sent'
            → on fail: attempts++, next_retry_at = now + 2^attempts min
            → if attempts >= 5: status='failed' + Telegram alert
```

## Related Files
**Create:**
- `migrations/0066-welcome-email-outbox.sql` — outbox table
- `src/lib/email/email-outbox.ts` — enqueue/dequeue/markSent/markFailed
- `src/app/api/cron/email-outbox-flush/route.ts` — flush worker

**Modify:**
- `src/lib/handover/auto-handover.ts` — replace direct `sendAutoHandoverWelcomeEmail` with `enqueueWelcomeEmail`
- `apps/sophia-ai-factory/wrangler.toml` — add `*/1 * * * *` cron entry for outbox flush
- `src/lib/security/cron-auth.ts` — register new cron name

## Implementation Steps
1. Write migration:
   ```sql
   CREATE TABLE welcome_email_outbox (
     id TEXT PRIMARY KEY,
     payment_id TEXT NOT NULL UNIQUE,
     to_email TEXT NOT NULL,
     template TEXT NOT NULL,
     payload TEXT NOT NULL,    -- JSON: {ownerFullName, tier, magicLinkUrl, locale}
     status TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed
     attempts INTEGER NOT NULL DEFAULT 0,
     next_retry_at INTEGER NOT NULL,
     last_error TEXT,
     created_at INTEGER NOT NULL,
     sent_at INTEGER
   );
   CREATE INDEX idx_welcome_outbox_pending ON welcome_email_outbox(status, next_retry_at);
   ```
2. `email-outbox.ts`:
   - `enqueueWelcomeEmail({paymentId, toEmail, template, payload})` — INSERT OR IGNORE
   - `flushOutbox()` — claim N rows, render+send, update status, fire alert on max retries
3. `auto-handover.ts`: swap `await sendAutoHandoverWelcomeEmail(...)` → `await enqueueWelcomeEmail(...)` inside the try/catch
4. Cron route: validate `verifyCronAuth`, call `flushOutbox(20)`, return summary
5. wrangler cron: append `"*/1 * * * *"` if not already there (one already at `*/1 * * * *` per wrangler dump — verify slot)
6. Telegram alert: copy helper from `uptime-check` route into `src/lib/alerts/telegram-admin-alert.ts` (single-source)
7. Run `pnpm tsc --noEmit` + add unit test for outbox state machine

## Todo
- [ ] Migration 0066 written + applied via `wrangler d1 execute`
- [ ] `email-outbox.ts` with enqueue/flush
- [ ] `auto-handover.ts` swapped to enqueue
- [ ] Cron route + wrangler entry
- [ ] Telegram alert helper extracted
- [ ] Unit test: 5 retries → alert fired

## Success Criteria
- Simulated IPN with broken `RESEND_API_KEY` → outbox row stays pending, retries 5×, then `failed` + Telegram alert
- Same `payment_id` IPN replayed → exactly 1 outbox row (UNIQUE constraint)
- Happy path: IPN → outbox row → cron flush within 60s → email delivered

## Risk Assessment
- **Cron lag**: 1-min cadence means worst case 60s email delay — acceptable for post-payment UX
- **Outbox flooding**: cap flush batch at 20 rows/run to stay under Cloudflare Worker CPU limit
- **Resend rate limit**: Resend free tier = 100 emails/day; check upgrade plan before launch

## Security Considerations
- `payload` JSON does not contain secrets — only display data + signed magic-link URL
- Cron auth via `CRON_SECRET` (already enforced via `verifyCronAuth`)

## Next
Phase 03 builds `/onboarding` UI that the magic-link lands on.
