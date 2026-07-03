---
phase: 2
title: "Group B: New Pages"
status: pending
priority: P1
dependencies: []
---

# Phase 2: Group B — New Pages from Stitch Designs

## Overview

Build 3 new pages from Stitch designs: Pricing Page (rebuild A-Z), Video Creation Flow (client wizard), Login Page (merge with Better Auth). Runs in parallel with Phases 1 and 3.

## Architecture

- **Pricing Page**: Server component with `getTranslations`, new JSX layout matching Stitch screen `4d87fc20...`
- **Video Creation Flow**: Client wizard (`'use client'`), 4-step state machine (Script→Voice→Visual→Review)
- **Login Page**: Merge Stitch design UI with existing Better Auth integration

## Related Code Files

- **Modify:** `src/app/[locale]/pricing/page.tsx` — full rebuild of JSX, keep tier data logic
- **Create:** `src/app/components/sections/pricing-hero.tsx` (if splitting)
- **Create:** `src/app/components/sections/video-creation-wizard.tsx` — client wizard
- **Create:** `src/app/components/sections/video-creation-step-script.tsx`
- **Create:** `src/app/components/sections/video-creation-step-voice.tsx`
- **Create:** `src/app/components/sections/video-creation-step-visual.tsx`
- **Create:** `src/app/components/sections/video-creation-step-review.tsx`
- **Modify:** `src/app/[locale]/login/page.tsx` — UI wrapper update only
- **Modify:** `messages/en.json`, `messages/vi.json` — i18n keys

## Implementation Steps

### Step 1: Pre-validate style
- `ui-ux-pro-max search.py --domain style --stack nextjs` for design guidelines
- `ui-ux-pro-max search.py --domain landing --stack nextjs` for page structure patterns

### Step 2: Pricing Page (rebuild from Stitch)
- Reference Stitch screen ID `4d87fc2014924658b0b905f49cccdbc7`
- 4 pricing cards: BASIC $29, PREMIUM $79, ENTERPRISE $199, MASTER Custom
- Monthly/Yearly toggle pill with "Save 20%" badge
- FAQ accordion section below cards
- Keep existing `getTranslations('pricing')` and tier data logic
- Match Stitch design: dark cards, indigo borders, "Most Popular" badge

### Step 3: Login Page (merge with Better Auth)
- Reference Stitch screen ID `7a21cc675458464aa397aad8277dcaea`
- Keep existing auth client: `import { authClient } from '@/seed/auth/better-auth-client'`
- Update UI: centered card layout, email/password form, social auth buttons
- Match Stitch: dark surface card, indigo focus ring, locale toggle footer

### Step 4: Video Creation Flow (client wizard)
- Reference Stitch screen ID `c828a3ec2fff4f399a9bc9cf4f1831c7`
- 4-step wizard with `'use client'` state management
- Progress indicator with step numbers + checkmarks
- Step 1: Script Input (textarea + AI Generate button)
- Step 2: Voice Selection (TTS preview)
- Step 3: Visual Style (template/cinematic toggle)
- Step 4: Review (summary + Continue button)
- Bottom action bar with Back/Continue navigation

### Step 5: ui-styling pass
- Align all new pages with Tailwind config tokens
- Ensure dark mode, indigo accent, consistent spacing

### Step 6: ui-ux-pro-max review
- Post-implementation UX audit for all 3 pages
- `search.py --domain ux` for anti-patterns
- `search.py --domain landing` for CTA/flow validation

## Success Criteria

- [ ] Pricing page renders with 4 tiers, toggle, FAQ — matches Stitch design
- [ ] Login page preserves Better Auth flow with new UI wrapper
- [ ] Video Creation wizard has 4 working steps with navigation
- [ ] All pages dark mode, indigo accent, responsive
- [ ] i18n keys added for all new text content
- [ ] No `console.log` or `:any` types
- [ ] Build passes (npm run build exit 0)

## Risk Assessment

- Risk: Breaking Better Auth integration on login page → **Mitigation:** Change only JSX wrapper, keep all auth imports/logic
- Risk: Client wizard losing state on navigation → **Mitigation:** Single 'use client' component, no URL-based steps
