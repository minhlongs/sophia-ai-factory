# Phase 03 — Video Trigger + Delivery

## Context Links

- Existing onboarding video: `apps/sophia-ai-factory/src/lib/video/onboarding-video.ts`
- HeyGen helpers: `apps/sophia-ai-factory/src/lib/video/heygen-helpers.ts`
- Email infra: `apps/sophia-ai-factory/src/lib/billing/email/`
- Dashboard videos page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/videos/`
- Phase 02 stub: `apps/sophia-ai-factory/src/lib/fulfillment/one-time-fulfillment.ts`

## Overview

- **Priority:** P1 (depends on Phase 02)
- **Status:** done
- **Description:** Implement `triggerOneTimeFulfillment()`. Generate welcome video via HeyGen, send bilingual email with video link + credit balance, ensure dashboard surfaces purchase + video.

## Key Insights

- Reuse existing `createHeyGenVideo()` — DRY
- Welcome script for one_time differs from subscription onboarding (mentions credits + bundle, not "monthly plan")
- Email template needs new variant: `oneTimeBundleReady.{vi,en}` with: greeting, credit balance, video link, dashboard link, support link, NO upgrade-CTA in v1 (open question — see plan.md)
- Dashboard reuses existing video gallery — no new UI needed in v1; surfaces via `videos` table (already linked to user_id)
- Add new column `videos.purchase_id` (nullable, FK → user_purchases.id) for traceability

## Requirements

**Functional:**
- On `one_time_purchase_paid` → fetch user email
- Generate HeyGen video with welcome script (script content from `getOneTimeWelcomeScript(sku, locale)`)
- On video ready (HeyGen polling already exists in cron) → send email "Your bundle is ready"
- Insert `videos` row with `purchase_id` reference
- Email tracking via existing email infra (idempotent send — check `email_log` for prior send)
- Failure path: HeyGen 5xx → mark video failed, send fallback email "Bundle activated, video coming soon" + ops alert

**Non-functional:**
- File <200 lines
- No `:any`
- No `console.log`
- Bilingual scripts (Vi/En) sourced from user locale preference (fallback `vi`)

## Architecture

```
triggerOneTimeFulfillment(userId, purchaseId, sku)
  ├─ fetch user → { email, locale }
  ├─ script = getOneTimeWelcomeScript(sku, locale)
  ├─ video = createHeyGenVideo({ script, voice, ... })
  ├─ insert videos row { user_id, purchase_id, heygen_job_id, status: 'processing' }
  └─ enqueue email-on-ready (existing cron polls HeyGen → on completed → sendOneTimeBundleReadyEmail)

sendOneTimeBundleReadyEmail(userId, purchaseId, videoUrl)
  ├─ idempotent check via email_log
  ├─ render template { creditsRemaining, videoUrl, dashboardUrl }
  └─ send + log
```

## Related Code Files

**Create:**
- `apps/sophia-ai-factory/src/lib/fulfillment/one-time-fulfillment.ts` — `triggerOneTimeFulfillment()` (replace Phase 02 stub)
- `apps/sophia-ai-factory/src/lib/video/one-time-welcome-script.ts` — bilingual script templates
- `apps/sophia-ai-factory/src/lib/billing/email/templates/one-time-bundle-ready.ts` — Vi+En template
- `apps/sophia-ai-factory/migrations/0040-videos-purchase-id.sql` — add nullable `purchase_id` column + index

**Modify:**
- `apps/sophia-ai-factory/src/lib/video/heygen-poll-cron.ts` (existing cron) — on `status: completed`, branch: if `purchase_id != null` → call `sendOneTimeBundleReadyEmail`; else existing onboarding email path
- `apps/sophia-ai-factory/src/lib/billing/email/email-dispatch.ts` (or equivalent) — register new template

**No delete.**

## Implementation Steps

1. Migration `0040-videos-purchase-id.sql`: `ALTER TABLE videos ADD COLUMN purchase_id TEXT REFERENCES user_purchases(id)` + index
2. Create `one-time-welcome-script.ts` — bilingual content per SKU (initial: STARTER_BUNDLE)
3. Create `one-time-fulfillment.ts`:
   - Fetch user via D1
   - Resolve script via `getOneTimeWelcomeScript(sku, locale)`
   - Call `createHeyGenVideo()`
   - Insert `videos` row with `purchase_id` set
4. Create email template `one-time-bundle-ready.ts` — Vi+En variants
5. Modify HeyGen poll cron — branch on `purchase_id` to trigger right email
6. Wire `triggerOneTimeFulfillment` into Phase 02 (replace stub)
7. Build assert
8. Apply migration locally

## Todo List

- [x] Migration 0040 written + applied locally
- [x] Welcome script bilingual (Vi/En)
- [x] Email template bilingual (one-time-bundle-ready)
- [x] Fulfillment function complete (triggerOneTimeFulfillment)
- [x] HeyGen poll cron branches correctly
- [x] Phase 02 stub replaced
- [x] Build pass (0 TS errors)

## Success Criteria

- [x] Manual test: insert fake `user_purchases` row + call `triggerOneTimeFulfillment` → assert `videos` row created with HeyGen job
- [x] Email log shows one entry per purchase (idempotent — second invoke does NOT duplicate)
- [x] Bilingual rendering verified (Vi user → Vi email; En → En)
- [x] Cron picks completed video → email sent

## Risk Assessment

- **HeyGen quota exhaustion:** Many one_time purchases concurrent → HeyGen rate limit. Mitigation: existing rate limiter in heygen-helpers + queue retry.
- **Email send failures:** Network/provider blip. Mitigation: existing email retry infra + cron sweep for `email_log.status = 'failed'`.
- **Cron branching regression:** Onboarding (subscription) email path could break. Mitigation: explicit branch on `purchase_id IS NULL` for onboarding, `IS NOT NULL` for one_time; Phase 04 covers both.

## Security Considerations

- Video URL R2 signed (existing pattern) — no public bucket
- Email template escapes user-controllable fields (display name); use existing email-render helpers
- `purchase_id` exposed in dashboard only to owner (RLS via `user_id` check)

## Next Steps

- Phase 04 writes integration test for full pipeline + browser smoke
