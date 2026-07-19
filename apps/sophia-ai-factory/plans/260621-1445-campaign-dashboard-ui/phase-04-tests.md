# Phase 4: Write Vitest Tests

## Context Links
- Existing test examples: `src/forest/components/__tests__/*.test.tsx`
- `src/app/[locale]/dashboard/components/create-campaign/campaign-form.test.tsx`

## Overview
Write unit tests for each new component in `src/forest/dashboard/campaign/__tests__/`. Use `@testing-library/react` and `vitest`. Mock dependencies (i18n, lucide icons, UI primitives).

## Implementation Steps
For each component:
1. Create a test file: `__tests__/campaign-card.test.tsx`, etc.
2. Render component with minimal props.
3. Test that it renders without crashing.
4. Test i18n keys are called (mock `useTranslations` to return key).
5. Test conditional rendering (e.g., progress bar shown only for processing status).
6. Test accessibility (ARIA labels, roles).
7. Aim for ≥80% coverage.

## Todo List
- [ ] Write CampaignStatusBadge tests
- [ ] Write CampaignProgressBar tests
- [ ] Write CampaignCard tests
- [ ] Write CampaignGrid tests
- [ ] Write CampaignMetricsCard tests
- [ ] Run coverage

## Success Criteria
- All tests pass
- Coverage report shows ≥80% for forest/dashboard/campaign

## Risk Assessment
Low: Standard React testing.
