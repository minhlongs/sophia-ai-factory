# Phase 05: Dunning State Machine → Resend Wiring

**Priority:** MEDIUM | **Impact:** +5-10% retained revenue
**Status:** COMPLETE

## Problem
- Dunning state machine EXISTS (`src/land/billing/dunning/dunning-state-machine.ts`)
- States: declined → suspended → restored
- Attempts recorded in `dunning_attempts` table
- But: emails NOT sent — no trigger wired to Resend delivery
- Failed payments silently churn users

## Existing Infrastructure
- `src/land/billing/dunning/` — full state machine + actions + admin ops
- `src/land/billing/resend-email-service.ts` — Resend email delivery service
- `src/forest/email/templates/` — existing template patterns
- Email outbox with flush cron

## Tasks

- [x] 5.1 Read dunning state machine thoroughly: understand states, transitions, and where email should fire
      - `src/land/billing/dunning/dunning-state-machine.ts`
      - `src/land/billing/dunning/dunning-actions.ts`

- [x] 5.2 Create 3 dunning email templates (bilingual):
      - `dunning-day1-payment-failed.ts` — friendly 24h reminder with retry link
      - `dunning-day3-action-required.ts` — urgent countdown with suspension date
      - `dunning-day5-final-warning.ts` — final warning with list of features lost
      - All in `src/forest/email/templates/` — pure renderers, seed-only imports

- [x] 5.3 Wire dunning state transitions to email delivery
      - `handlePaymentFailure` → attempt 1 → `dunning_day1`
      - `handlePaymentFailure` → attempt 2 → `dunning_day3`
      - `handlePaymentFailure` → attempt 3+ → `dunning_day5`
      - Implemented via `sendDunningEmail()` private helper in dunning-actions.ts
      - Non-fatal: email failure never blocks payment pipeline

- [x] 5.4 Add "retry payment" deep link in emails
      - All 3 dunning templates link to `/dashboard/billing?retry=true`

- [x] 5.5 Dunning cron trigger exists at `/api/cron/dunning-advance/route.ts`
      - Runs daily (0 1 * * *), advances past_due → suspended after grace period expires
      - Also advances delinquent → suspended if no pending retry

## Files to Modify
- `src/forest/email/templates/` — 3 new dunning templates
- `src/land/billing/dunning/dunning-actions.ts` — wire email sends to state transitions
- `src/land/billing/dunning/dunning-state-machine.ts` — may need email trigger hooks

## Constraints
- Follow cross-layer rules: forest→land orchestration OK, land→forest FORBIDDEN
- Use existing Resend email patterns
- Bilingual templates (EN + VI)
- Do NOT create external cron registrations (per no-tech doctrine)
- The dunning cron route may exist as `/api/cron/...` — check and document

## Success Criteria
- 3 dunning email templates created, bilingual
- State machine transitions trigger email delivery
- Build passes
- Payment retry link works in email template
