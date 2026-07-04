---
phase: 3
title: "B1-PostHog Funnels"
status: completed
effort: "Small (1-2d)"
priority: P1
dependencies: []
track: B
---

# Phase 3: B1-PostHog Funnels

## Overview

Wire PostHog product analytics for funnel tracking. 16 events already captured (signup, pageview, checkout, etc.) but 4 critical funnels are missing. Add 3 new event types + funnel attribution.

## Context

- PostHog provider: `src/forest/components/posthog-provider.tsx` — already wired
- Event capture: `src/forest/telemetry/posthog-capture.ts` — captureServer exists
- Event types: `src/**/event-types.ts` — Zod schemas exist
- 16 existing events: signup, pageview, cta_click, wizard_step, wizard_completed, byok_configured, campaign_created, video_rendered, tier_upgraded, payment_succeeded, churn_signal, signup_complete, checkout_started, payment_success, tier_upgrade, checkout_abandoned

## Missing Funnels

| Funnel | Events Needed | Impact |
|--------|---------------|--------|
| Landing page → signup | pageview + cta_click + signup_complete + niche attribution | Cannot attribute which niches drive signups |
| Onboarding → first video | signup + wizard_step + wizard_completed + first_video_started + first_video_completed | Onboarding dropout invisible |
| First video → paid | video_rendered + free_quota_exhaustion + checkout_started + payment_success | Cannot measure free-to-paid conversion |
| Campaign lifecycle | campaign_created + campaign_published + campaign_first_view | Campaign success rate invisible |

## Related Code Files

- **Modify:** `src/forest/telemetry/posthog-capture.ts` — add new event types
- **Modify:** `src/forest/quota/quota-enforcer.ts` — add free_quota_exhaustion capture
- **Modify:** `src/land/video/` — add first_video_started/completed events
- **Modify:** `src/land/campaigns/` — add campaign_published/first_view events
- **Modify:** `src/app/[locale]/auth/callback/` — pass niche attribution on signup

## Implementation Steps

1. Add 3 new event types to Events enum: `first_video_started`, `first_video_completed`, `free_quota_exhaustion`, `campaign_published`
2. Add captureServer() calls in first-video creation path
3. Add captureServer() call in quota enforcer when free tier limit hit
4. Add captureServer() call when campaign goes live
5. Pass landing page slug as property on signup events (via referral cookie chain or query param)
6. Create PostHog funnel definitions in PostHog dashboard

## Success Criteria

- [ ] 4 funnels trackable in PostHog dashboard
- [ ] Niche attribution on signup events
- [ ] Free quota exhaustion captured
- [ ] First video generation events captured
- [ ] All existing tests pass
