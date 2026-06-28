# Phase 06: Multi-Channel Publish — TikTok + Instagram

**Priority:** P1 | **Status:** TODO | **Est:** 4-5 days
**Depends on:** Phase 04 (PlatformAdapter interface, credential management)

## Overview

Extend multi-channel publish to TikTok and Instagram Reels. Reuse PlatformAdapter from Phase 04.

## Requirements

### TikTok
- Content Posting API (direct post, not share intent)
- App review required (2-6 weeks) — start immediately
- Business account only
- Rate limit: 25 posts/day, 6 req/min
- Async status polling (no webhook)
- Token refresh: 30-day expiry

### Instagram Reels
- Graph API for content publishing
- Requires Facebook Business account linked to Instagram
- Max 90s video (API limit)
- Two-step: create container → publish container
- No webhook — poll for status (silent failure risk)
- Token refresh: 60-day long-lived token

## Files to Create

- `src/lib/publishing/tiktok-adapter.ts`
- `src/lib/publishing/instagram-adapter.ts`
- `src/forest/inngest/functions/video-publish-tiktok.ts`
- `src/forest/inngest/functions/video-publish-instagram.ts`
- `src/lib/publishing/token-refresh-service.ts` (multi-platform token lifecycle)

## Files to Modify

- `src/app/[locale]/dashboard/creative-studio/components/publish-dialog.tsx` — add TikTok/Instagram options
- `src/forest/inngest/functions/publish-status-poller.ts` — add TikTok/Instagram polling
- Setup Wizard — TikTok/Instagram OAuth connect sections
- `src/lib/analytics/analytics-normalizer.ts` — TikTok/Instagram metric normalization

## Implementation Steps

- [ ] 1. tiktok-adapter.ts: direct post API, status polling
- [ ] 2. instagram-adapter.ts: container create → publish, poll status
- [ ] 3. token-refresh-service.ts: multi-platform refresh cron (daily)
- [ ] 4. Inngest publish functions for each platform
- [ ] 5. Update publish dialog with platform multi-select
- [ ] 6. Update status poller for TikTok/Instagram
- [ ] 7. OAuth connect flows in Setup Wizard
- [ ] 8. Handle Instagram 90s limit (warn user, auto-trim option)
- [ ] 9. Tests per adapter

## Risk

- TikTok API review: 2-6 weeks. Ship YouTube+Instagram first, add TikTok when approved.
- Instagram silent failure: implement 10-min polling cap + user notification on timeout.

## Success Criteria

- Publish to YouTube + TikTok + Instagram simultaneously from one dialog
- Status tracked per platform independently
- Token auto-refresh prevents auth expiry
