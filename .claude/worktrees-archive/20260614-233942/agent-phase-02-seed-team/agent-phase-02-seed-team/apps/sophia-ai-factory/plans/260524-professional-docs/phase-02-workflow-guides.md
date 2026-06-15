# Phase 02: Workflow Guides

**Priority:** HIGH | **Impact:** Core user journey documentation
**Status:** TODO

## Problem
- No "First Video in 5 Minutes" quick-start workflow guide
- No campaign template usage guide
- Existing guide is setup-focused, not outcome-focused

## Tasks

- [ ] 2.1 Create /guide/first-video page — "Your First AI Video in 5 Minutes"
      - 5-step workflow: Login → Setup Keys → Create Campaign → Wait → Download
      - Use GuideStepCard components
      - Estimated time badges per step
      - Bilingual via i18n

- [ ] 2.2 Create /guide/templates page — "Using Campaign Templates"
      - Show VN holiday templates (Tết, Trung Thu, Quốc Khánh)
      - Show evergreen templates
      - Step-by-step: choose template → customize → launch
      - Bilingual

- [ ] 2.3 Create /guide/affiliate page — "Earn 70% Commission"
      - How affiliate works (3 steps)
      - Commission structure table
      - Where to find referral link
      - Payout info
      - Bilingual

## Files to Create
- `src/app/[locale]/guide/first-video/page.tsx`
- `src/app/[locale]/guide/templates/page.tsx`
- `src/app/[locale]/guide/affiliate/page.tsx`

## Files to Modify
- `messages/en.json` — add guide.first_video.*, guide.templates.*, guide.affiliate.*
- `messages/vi.json` — add corresponding VI keys

## Constraints
- Each page under 200 lines
- Reuse GuideStepCard, GuideCallout components
- Bilingual
- Don't duplicate existing content from /guide main page

## Success Criteria
- 3 new workflow guide pages accessible
- All bilingual
- Build passes
