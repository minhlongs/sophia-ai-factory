# Phase 04: Post-Purchase Onboarding Email Sequence

**Priority:** MEDIUM | **Impact:** +15-25% activation rate
**Status:** COMPLETE

## Problem
- After payment, user gets single Vietnamese-only email ("Video giới thiệu đã sẵn sàng")
- No structured post-purchase drip to guide activation
- Setup Wizard (BYOK keys) is discoverable only via /payment-success page
- Users who close browser after payment have no re-entry path via email

## Existing Infrastructure (LEVERAGE — don't rebuild)
- Resend email provider already wired
- `src/forest/email/templates/` has 9 lifecycle templates
- `src/seed/email/bilingual-cta-template.ts` — bilingual EN+VI template engine
- Email outbox with 2-min flush cron (`/api/cron/email-outbox-flush`)
- Drip engine: `/api/cron/email-drip` + `lifecycle-email-rules.ts`

## Tasks

- [x] 4.1 Create post-purchase email template: "Welcome + Setup Your API Keys" (bilingual)
      - Trigger: immediately after IPN confirms payment
      - Content: congratulations, tier name, direct link to Setup Wizard, 5-10 min setup promise
      - File: `src/forest/email/templates/post-purchase-welcome.ts`

- [x] 4.2 Create activation nudge email: "Complete Setup in 30 Seconds" (bilingual)
      - Trigger: 2 hours after purchase IF setup wizard not completed
      - Content: reminder, simplified steps, direct wizard link
      - File: `src/forest/email/templates/post-purchase-nudge.ts`

- [x] 4.3 Create first-success email: "Your First Video is Live!" (bilingual)
      - Trigger: after first video_jobs row created for this user
      - Content: celebration, link to results dashboard, "share your success" CTA
      - File: `src/forest/email/templates/post-purchase-first-success.ts`

- [x] 4.4 Add drip rules for these 3 emails in lifecycle-email-rules.ts
      - Rule 1: payment_confirmed + no onboarding_completed → send welcome
      - Rule 2: payment_confirmed + 2h elapsed + no onboarding_completed → send nudge  
      - Rule 3: first video created → send first-success

- [x] 4.5 Wire IPN handlers to queue welcome email on successful payment
      - Modified `src/land/billing/nowpayments-ipn-subscription.ts` to enqueue email in handleFinished

## Files to Modify
- `src/forest/email/templates/` — 3 new templates
- `src/forest/email/lifecycle-email-rules.ts` — add 3 drip rules
- `src/land/billing/nowpayments-ipn-handlers.ts` — trigger welcome email on payment confirm

## Constraints
- Use existing bilingual template engine (`bilingual-cta-template.ts`)
- Use existing email outbox queue pattern (don't create new delivery mechanism)
- Templates must be bilingual (EN + VI)
- Follow forest layer conventions

## Success Criteria
- 3 new email templates created, bilingual
- Drip rules configured in lifecycle-email-rules.ts
- IPN handler queues welcome email on successful payment
- Build passes
