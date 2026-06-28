# Phase 02: Post-Purchase Trigger + DB Schema

**Status:** ✅ done | **Date:** 2026-04-30

## Summary

Hook NOWPayments IPN → auto trigger onboarding video for ENTERPRISE/MASTER purchases.

## Changes

### DB Migration (0034)
- New table: `video_onboarding_events` — tracks delivery status per purchase
- New column: `videos.is_onboarding` — flags onboarding videos in gallery

### IPN Hook (`nowpayments-ipn-subscription.ts`)
- After subscription activation, check if tier is ENTERPRISE or MASTER
- If yes, call `createOnboardingVideo()` with user email
- Non-fatal if fails — subscription still activates

### Onboarding Video Module (`lib/video/onboarding-video.ts`)
- `createOnboardingVideo()` — creates HeyGen video with templated script
- `ONBOARDING_TIERS` — Set of tiers eligible (ENTERPRISE, MASTER)
- Vietnamese script templates for each tier
- Stores video in `videos` table with `is_onboarding = 1`

## Files Changed

- `migrations/0034-video-onboarding-events.sql` — new migration
- `src/lib/billing/nowpayments-ipn-subscription.ts` — onboarding trigger
- `src/lib/video/onboarding-video.ts` — new module
