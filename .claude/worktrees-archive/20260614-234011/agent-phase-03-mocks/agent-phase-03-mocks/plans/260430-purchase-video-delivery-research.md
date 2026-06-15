# Post-Purchase Auto Video Delivery — Research Report

**Date**: 2026-04-30 | **Project**: Sophia AI Factory  
**Goal**: When customer buys Premium+ tier → auto-generate intro/onboarding video → deliver via dashboard + email

---

## 1. Payment Webhook Flow — Where to Hook In

**Current flow**:  
`POST /api/webhooks/nowpayments` → HMAC-SHA512 verify → `processNowPaymentsIpn()` → dispatch by status → `handleFinished()`

**Critical files**:
- `app/api/webhooks/nowpayments/route.ts` (line 50) — IPN endpoint, fires PostHog analytics post-process
- `lib/billing/nowpayments-ipn-handlers.ts` — dispatcher with idempotency guard (`isPaymentProcessed`)
- `lib/billing/nowpayments-ipn-subscription.ts` (lines 16-65) — `handleFinished()`: looks up tier via invoiceId, extracts userId from `order_id` format `sophia_{userId}_{timestamp}`, upserts `subscriptions`/`organizations`/`org_members`

**Hook point recommendation**:  
Add post-purchase trigger **inside** `handleFinished()` at line 64 (after subscription activation, before `logger.info`). This ensures:
- Idempotency already checked (no double-trigger)
- Subscription already active in DB (tier info available)
- User/org IDs resolved

Alternatively, hook in `route.ts` after line 50 with a conditional `ipn.payment_status === 'finished'` guard — but this is less clean (mixing concerns).

## 2. NOWPayments Subscription Lifecycle & Renewal Detection

**Key finding**: NOWPayments uses **pre-created static invoice IDs** — not native subscriptions. Each purchase is a standalone payment. No webhook distinguishes "first payment" vs "renewal".

**Current state**:
- `order_id` = `sophia_{userId}_{timestamp}` — always unique per checkout
- IPN idempotency via `payment_events.event_id = nowpayments_{payment_id}`  
- `handleFinished()` upserts subscription with `30-day` expiry (or `2099` for MASTER/lifetime)
- Tier configs in `src/lib/clients/nowpayments-client.ts`: `BASIC=invoiceId:5710519960 PREMIUM=4559269964 ENTERPRISE=6336799275 MASTER=5589879034`

**Renewal detection strategy**:
- Before `handleFinished` activates a subscription, check if user already has an **active** subscription at same tier → this is a renewal → skip video delivery
- Check: query `subscriptions` for `org_id` with `status='active'` and matching `plan`
- If previous plan == new plan → renewal → **skip video**
- If previous plan differs (or no previous) → new/upgrade purchase → **trigger video**

**Tiers eligible for video**: `ENTERPRISE` (Premium) and `MASTER` — per user's ask "Premium+ tier"

## 3. Email Delivery — Resend Integration

**Two Resend systems exist**:

| System | Location | From Address | Method |
|--------|----------|-------------|--------|
| Simple | `lib/email/sender.ts` | `noreply@mekongmind.com` | `fetch()` to Resend API |
| Rich (billing) | `lib/billing/email/email-delivery-service.ts` | `billing@sophia.agencyos.network` | `resend` npm SDK |

**Recommended**: Use the simple `lib/email/sender.ts` for video delivery email — it's already used for transactional emails, has dry-run fallback, and the template system (`lib/email/email-templates.ts`) is already built for HTML emails.

**Existing `welcomeEmail()` template** (line 45, `email-templates.ts`) exists but **is never called anywhere** in the codebase. Can be extended with a video link section.

**Email flow**: After video published → call `sendEmail()` with:
- `to`: user email (from Better Auth user object)
- `subject`: "Your Onboarding Video is Ready"
- `html`: new template showing video thumbnail + link to dashboard
- `replyTo`: support email

**Verified domain**: `mekongmind.com` (from default `EMAIL_FROM` env var: `noreply@mekongmind.com`). Also `sophia.agencyos.network` used in billing emails.

## 4. Dashboard Delivery — Video Gallery Integration

**Current video gallery**:  
- Page: `app/[locale]/dashboard/videos/page.tsx` — shows `<VideoGallery locale={locale} />`
- Component: `app/[locale]/dashboard/videos/components/video-gallery.tsx`
- API: `GET /api/videos?limit=50` — returns `VideoItem[]` with `{ id, title, status, video_url, thumbnail_url, heygen_job_id, created_at }`
- Table: `videos` — has `user_id`, `heygen_job_id`, `status`, `video_url`

**How to add onboarding section**:
1. Add `category` enum column to `videos` table: `'user_generated' | 'onboarding'` (default `'user_generated'`)
2. In `VideoGallery`, add a section above the grid: "Onboarding Videos" with a filtered list
3. OR: add a new `video_onboarding` table with FK to `video_jobs.id` and `user_id`, plus `delivered_at`, `email_sent` flags
4. Simpler approach (YAGNI): add `is_onboarding INTEGER DEFAULT 0` column to existing `videos` table, filter in gallery

**Video pipeline integration**: Onboarding video goes through same `video_jobs` FSM pipeline: `queued → scripting → tts_pending → visual_pending → composing → uploaded → published`. The `video.published` Inngest event (line 48 of `video-publish.ts`) is the natural trigger for delivery.

## 5. Database Changes Needed

**New table**: `video_onboarding_events` — tracks delivery status per purchase

```sql
CREATE TABLE IF NOT EXISTS video_onboarding_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  org_id TEXT,
  payment_id TEXT NOT NULL UNIQUE,        -- NOWPayments payment_id (idempotency)
  tier TEXT NOT NULL,                      -- ENTERPRISE or MASTER
  video_job_id TEXT,                       -- FK to video_jobs.id (nullable until created)
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(delivery_status IN ('pending','generating','delivered','email_sent','failed')),
  email_recipient TEXT,
  email_sent_at INTEGER,
  delivered_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Modify existing tables**:
- `videos` table: add `is_onboarding INTEGER DEFAULT 0` (for gallery filtering)
- `payment_events` table: no changes needed (already has idempotency)

## 6. Edge Cases

### 6.1 Race: Webhook Arrives Before Video Gen Completes

**Problem**: IPN webhook is near-instant (seconds). Video generation takes 5-15 minutes through Inngest pipeline.

**Solution**: Use `video_onboarding_events` as coordinator:
1. `handleFinished` inserts row with `delivery_status='pending'`, `video_job_id=null`
2. `video.published` Inngest event checks for pending onboarding events → updates `video_job_id`, sets status to `'delivered'` → triggers email
3. OR: add a **new Inngest function** listening to `video.published` that checks for onboarding deliveries

### 6.2 Retry on Failure

**Already built**: Inngest FSM has `retries: 3` in `video-publish.ts` (line 20). If the video job fails:
- FSM transitions to `'failed'` state
- Set `video_onboarding_events.delivery_status = 'failed'`
- Add a retry via Inngest `video.retry` event or admin-triggered retry endpoint

**Email retry**: `lib/email/sender.ts` has built-in error handling (returns `{ success: false, error }`). Wrap in retry loop (max 3, 5min backoff).

### 6.3 Multi-Tier Purchase (Re-buy)

**Detection**: Query `subscriptions` table before activating — if user has active subscription at same tier, it's a renewal. If different tier, it's an upgrade → trigger new onboarding video.

**Idempotency**: `payment_events` table with `event_id = nowpayments_{payment_id}` already prevents double-processing of same payment. The `video_onboarding_events.payment_id` UNIQUE constraint prevents duplicate video jobs.

### 6.4 No Email on File / Email Unreachable

**Fallback**: If `sendEmail` fails, still set `delivery_status='delivered'` — user can find video in dashboard. Don't block dashboard delivery on email success.

## Summary of Required Changes

| # | What | Where | Complexity |
|---|------|-------|------------|
| 1 | New DB table `video_onboarding_events` | Migration `0038-video-onboarding.sql` | Low |
| 2 | Hook into `handleFinished()` | `nowpayments-ipn-subscription.ts` after line 64 | Low |
| 3 | Create `createOnboardingVideoJob()` | New file `lib/video/onboarding-video.ts` | Medium |
| 4 | Add `is_onboarding` to gallery | `VideoGallery` component + API filter | Low |
| 5 | New Inngest function for `video.published` delivery check | `lib/inngest/functions/video-onboarding-deliver.ts` | Medium |
| 6 | Email template + send logic | `lib/email/email-templates.ts`, `lib/email/sender.ts` | Low |
| 7 | Renewal detection in IPN handler | `nowpayments-ipn-subscription.ts` before activation | Low |

## Unresolved Questions

1. **Onboarding video content**: What prompt/content should the auto-generated video use? Intro to Sophia AI Factory features? Personalized with user's org name?
2. **Video cost**: Who pays for the onboarding video MCU cost? Deduct from first-month credits or free?
3. **Retry UX**: Should failed onboarding videos show a "Regenerate" button in dashboard?
4. **MASTER tier**: Lifetime purchase — same onboarding flow or different?
