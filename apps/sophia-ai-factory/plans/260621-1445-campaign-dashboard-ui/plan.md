# Plan: Complete Campaign Dashboard UI

**Status**: In Progress  
**Objective**: Implement reusable campaign dashboard UI components in forest layer with i18n, responsive design, tests, and API integration.

## Overview

This plan creates a new `forest/dashboard/campaign/` module containing React components for displaying campaign data. These components will be used by the campaigns page and potentially the main dashboard.

## Phases

- **Phase 1**: Scout existing code (Stitch screens, campaigns page, i18n)
- **Phase 2**: Verify i18n keys completeness (en/vi)
- **Phase 3**: Create forest/dashboard/campaign directory and scaffolding
- **Phase 4**: Implement core components (CampaignCard, CampaignGrid, CampaignMetricsCard, CampaignStatusBadge, CampaignProgressBar)
- **Phase 5**: Write Vitest tests for each component
- **Phase 6**: Integrate forest components into campaigns page
- **Phase 7**: Run tests, build, and verify

## Success Criteria

- All new components render correctly with responsive layouts
- All text is bilingual (Vietnamese + English) via next-intl
- Vitest coverage ≥ 80% for new components
- Campaigns page uses forest components without breaking
- TypeScript compilation succeeds with 0 errors
- Components integrate with forest/dashboard/metrics API

## Dependencies

- Existing campaign API (`/api/campaigns`) and data fetching functions in `forest/dashboard/metrics.ts`
- i18n messages already defined in `messages/en.json` and `messages/vi.json`
- UI primitives from `@/seed/components/ui/*`
