# Phase 1: Scout Existing Code and Verify i18n

## Context Links
- `/src/components/stitch/screens/dashboard/dashboard-page.tsx` (Stitch design reference)
- `/src/app/[locale]/dashboard/campaigns/page.tsx` (existing campaigns page)
- `/src/app/[locale]/dashboard/components/campaign-*.tsx` (existing app-layer components)
- `/src/forest/dashboard/metrics.ts` (data fetching functions)
- `/messages/en.json` and `/messages/vi.json` (i18n resources)

## Overview
Review existing campaign UI components, understand design patterns from Stitch screens, and verify that all required i18n keys exist in both English and Vietnamese.

## Priority
P1 (Must do first)

## Current Status
Not started

## Requirements
1. List all existing campaign-related UI components and their locations.
2. Identify design patterns used (Tailwind classes, component composition).
3. Verify that i18n keys used by existing components exist in both languages.
4. Document any missing keys.

## Architecture Notes
- Forest layer: reusable components (`src/forest/`)
- App layer: page-specific components (`src/app/[locale]/dashboard/components/`)
- i18n: next-intl with `useTranslations` hook
- UI primitives: `@/seed/components/ui/*` (Card, Badge, Button, Progress, etc.)

## Related Code Files
- `src/components/stitch/screens/dashboard/dashboard-page.tsx`
- `src/app/[locale]/dashboard/campaigns/page.tsx`
- `src/app/[locale]/dashboard/components/campaign-card.tsx`
- `src/app/[locale]/dashboard/components/campaign-grid.tsx`
- `src/app/[locale]/dashboard/components/campaign-filter-tabs.tsx`
- `src/app/[locale]/dashboard/components/campaigns-client-wrapper.tsx`
- `src/forest/dashboard/metrics.ts`

## Implementation Steps
1. Read Stitch screen to understand layout and styling patterns.
2. List existing campaign components in app layer and forest layer.
3. Extract all i18n keys used by these components.
4. Check existence of those keys in `messages/en.json` and `messages/vi.json`.
5. Report any gaps (likely none, but verify).

## Todo List
- [ ] Read Stitch dashboard-page.tsx
- [ ] Inventory existing campaign components
- [ ] Extract i18n keys from components
- [ ] Verify keys in en.json and vi.json
- [ ] Document findings

## Success Criteria
- Clear understanding of design patterns (responsive grid, cards, badges)
- Confirmation that all needed i18n keys exist in both languages
- List of components to be re-implemented in forest/dashboard/campaign

## Risk Assessment
Low: The components already exist; we are moving them to forest layer. i18n appears complete.

## Security Considerations
None. UI components only.

## Next Steps
If i18n gaps found, add missing keys to both message files before proceeding to implementation.
