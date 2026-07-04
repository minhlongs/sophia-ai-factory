---
phase: 2
title: "A2-Onboarding Optimization"
status: completed
effort: "Medium (3-5d)"
priority: P1
dependencies: []
track: A
---

# Phase 2: A2-Onboarding Optimization

## Overview

Reduce time-to-first-video from 15-30 minutes to under 5 minutes. Current Setup Wizard requires 4+ API keys (OpenRouter, ElevenLabs, D-ID, MUAPI, HeyGen) before generating any video. Two-pronged fix: reduce minimum gating to 1 key + add instant Magic Demo.

## Context

- Setup Wizard: `forest/components/wizard/` — 4+ key validation steps
- Welcome page: `app/[locale]/welcome/` — gates behind key config
- BYOK flow: `tree/byok/` — key validation
- No "try before you BYOK" path currently exists

## Related Code Files

- **Modify:** `src/forest/components/wizard/wizard-client.tsx` — make ElevenLabs, D-ID optional
- **Modify:** `src/app/[locale]/welcome/page.tsx` — add Magic Demo CTA
- **Create:** `src/forest/components/onboarding/magic-demo-button.tsx` — instant demo video
- **Modify:** `src/app/[locale]/dashboard/onboarding/page.tsx` — streamlined flow

## Implementation Steps

1. **Reduce minimum gates:** Change Setup Wizard to require only OpenRouter. Mark ElevenLabs, D-ID, MUAPI, HeyGen as optional with "Add later" badge in sidebar.
2. **Create Magic Demo:** Build a button on welcome page that generates a sample video using platform demo credentials (rate-limited to 1). Uses pre-baked SOP template + generic assets.
3. **Streamline onboarding:** Add "Create First Video" CTA on welcome page that uses pre-made template. User sees finished video before touching wizard.
4. **First-video path:** When only OpenRouter key is configured, use text-to-slides style (no avatar). This drops avatar provider (D-ID/HeyGen) from critical path.
5. **Error recovery:** Add "Chat with support" shortcut for key validation failures with pre-filled diagnostic.

## Success Criteria

- [ ] User can generate first video with only OpenRouter key configured
- [ ] Magic Demo generates a sample video in under 60 seconds
- [ ] ElevenLabs, D-ID keys can be deferred to post-onboarding
- [ ] "Create First Video" CTA appears on welcome page
- [ ] All existing tests pass

## Risk Assessment

- Demo credentials need to be platform-provisioned (limited quota)
- Existing users with 4+ keys already configured are unaffected
- Text-to-slides first video is less impressive than avatar video — trade-off for speed
