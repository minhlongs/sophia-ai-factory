# Phase 2: Remove Fake YouTube Feature

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 15 minutes

## Problem

Pricing page claims "1 YouTube Channel" and "3 YouTube Channels" but:
- NO YouTube API integration exists
- NO `googleapis` imports anywhere
- NO OAuth flow for YouTube
- NO video upload functionality
- Just tier limit numbers that gate NOTHING

## Evidence

**File:** `src/components/pricing-section.tsx` (lines 83-105)

```typescript
const TIER_FEATURES: Record<string, string[]> = {
  BASIC: [
    "1 YouTube Channel",      // ← FAKE
    "5 Video Templates",
    "Basic Analytics",
    "Email Support",
  ],
  PREMIUM: [
    "3 YouTube Channels",     // ← FAKE
    "Unlimited Templates",
    "Advanced Analytics",
    "Priority Support",
    "Custom Branding",
  ],
  ENTERPRISE: [
    "Unlimited Channels",     // ← FAKE
    // ...
  ],
};
```

## Options (User Decision Required)

### Option A: Remove YouTube Claims Entirely

Replace with accurate features:

```typescript
const TIER_FEATURES: Record<string, string[]> = {
  BASIC: [
    "5 Video Templates",
    "Basic Analytics",
    "Email Support",
    "Auto-Discovery Engine",
  ],
  PREMIUM: [
    "Unlimited Templates",
    "Advanced Analytics",
    "Priority Support",
    "Custom Branding",
    "ROI Calculator",
  ],
  ENTERPRISE: [
    "Custom Templates",
    "White-labeling",
    "Dedicated Account Manager",
    "API Access",
    "SLA Guarantee",
  ],
};
```

### Option B: Add "(Coming Soon)" Indicator

```typescript
BASIC: [
  "1 YouTube Channel (Coming Soon)",
  // ...
],
```

## Recommendation

**Option A** - Remove entirely. "(Coming Soon)" still implies commitment. Better to under-promise and over-deliver.

## Implementation Steps

1. [ ] Decide: Option A (remove) or Option B (coming soon)
2. [ ] Open `src/components/pricing-section.tsx`
3. [ ] Update `TIER_FEATURES` object (lines 83-105)
4. [ ] Run `npm run build`
5. [ ] Visual check pricing page

## Success Criteria

- No false YouTube claims on pricing page
- All listed features have actual implementations
- Build passes
