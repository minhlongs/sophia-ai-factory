# Phase 5: Integrate Forest Components into Campaigns Page

## Context Links
- `src/app/[locale]/dashboard/campaigns/page.tsx`
- `src/app/[locale]/dashboard/components/campaigns-client-wrapper.tsx`
- `src/app/[locale]/dashboard/components/campaign-filter-tabs.tsx`
- `src/app/[locale]/dashboard/components/campaign-grid.tsx`
- `src/app/[locale]/dashboard/components/campaign-card.tsx`

## Overview
Update the campaigns page to use the newly created forest components instead of the app-layer components. This demonstrates integration and reusability.

## Implementation Steps
1. Modify `src/app/[locale]/dashboard/campaigns/components/campaigns-client-wrapper.tsx` (or wherever the wrapper lives) to import from `@/forest/dashboard/campaign`:
   - Replace `import { CampaignFilterTabs } from '../components/campaign-filter-tabs'` with forest import.
   - Replace `import { CampaignGrid } from '../components/campaign-grid'`.
   - If modal used, consider whether to keep app-level or move to forest.
2. Ensure i18n namespaces still work (forest components use same keys).
3. Test the page manually or via existing Playwright tests.
4. Remove or deprecate old app-level campaign components if no longer used.

## Todo List
- [ ] Update imports in campaigns page/client wrapper
- [ ] Verify no import errors
- [ ] Run existing tests for campaigns page
- [ ] Manual smoke test (optional)

## Success Criteria
- Campaigns page renders identically (or better) with forest components
- No console errors
- Tests pass

## Risk Assessment
Low: Components are copy-paste with minor adjustments.
