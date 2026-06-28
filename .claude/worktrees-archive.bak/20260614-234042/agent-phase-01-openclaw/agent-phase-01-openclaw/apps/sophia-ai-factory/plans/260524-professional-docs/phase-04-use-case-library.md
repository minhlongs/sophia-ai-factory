# Phase 04: Use Case Library

**Priority:** MEDIUM | **Impact:** Show practical applications
**Status:** TODO

## Problem
- No use case examples showing real business applications
- Users don't know what they can DO with Sophia beyond "make videos"
- Competitors all have use case libraries

## Tasks

- [ ] 4.1 Create /guide/use-cases page — Use Case Library index
      - Card grid linking to 3 use cases
      - Each card: title, description, estimated ROI
      - Bilingual

- [ ] 4.2 Create /guide/use-cases/ceo-marketing page
      - "Non-Tech CEO Video Marketing"
      - Scenario: CEO wants weekly YouTube content without hiring videographer
      - Workflow: Script AI → Voice AI → Avatar → YouTube
      - Expected results: 4 videos/week, $0 production cost
      - Bilingual

- [ ] 4.3 Create /guide/use-cases/ecommerce page
      - "E-commerce Product Videos"
      - Scenario: Shopify store owner needs product demo videos
      - Workflow: Product script → Professional voice → Product showcase
      - Expected results: 50+ product videos/month
      - Bilingual

- [ ] 4.4 Create /guide/use-cases/real-estate page
      - "Real Estate Virtual Tours"
      - Scenario: Agent needs video walkthroughs for listings
      - Workflow: Property description → Narration → Virtual tour video
      - Expected results: Every listing has video
      - Bilingual

## Files to Create
- `src/app/[locale]/guide/use-cases/page.tsx`
- `src/app/[locale]/guide/use-cases/ceo-marketing/page.tsx`
- `src/app/[locale]/guide/use-cases/ecommerce/page.tsx`
- `src/app/[locale]/guide/use-cases/real-estate/page.tsx`

## Files to Modify
- `messages/en.json` — add guide.use_cases.* keys
- `messages/vi.json` — add corresponding VI keys

## Constraints
- Non-technical language
- Bilingual
- Under 200 lines per page
- Use GuideStepCard for workflow steps

## Success Criteria
- Use case index + 3 use case pages accessible
- All bilingual
- Build passes
