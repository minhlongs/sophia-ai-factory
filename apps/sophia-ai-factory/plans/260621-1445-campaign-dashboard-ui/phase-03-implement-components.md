# Phase 3: Implement Campaign UI Components

## Context Links
- `src/app/[locale]/dashboard/components/campaign-card.tsx` (reference)
- `src/app/[locale]/dashboard/components/campaign-grid.tsx`
- `src/app/[locale]/dashboard/components/campaign-filter-tabs.tsx`
- `src/forest/dashboard/metrics.ts` (data shapes)
- `src/seed/components/ui/*` (Card, Badge, Button, Progress, etc.)

## Overview
Implement the following components in `src/forest/dashboard/campaign/`:
- `CampaignCard`: Displays a single campaign with status, progress, actions.
- `CampaignGrid`: Grid layout for CampaignCard components (responsive).
- `CampaignStatusBadge`: Badge component for campaign status (reusable).
- `CampaignProgressBar`: Progress bar with color coding based on status.
- `CampaignMetricsCard`: Dashboard card showing aggregate metrics (total, active, completed, success rate).
- `CampaignListItem` (optional): List row version for table layouts.

All components must:
- Use `useTranslations` for i18n with appropriate namespaces.
- Be responsive using Tailwind CSS.
- Accept data via props (do not fetch directly inside components; parent fetches).
- Use types from `@/seed/types` and `@/forest/dashboard/types`.

## Implementation Steps
1. Implement `CampaignStatusBadge` using `Badge` from seed UI. Map status to variant/color.
2. Implement `CampaignProgressBar` using `Progress` from seed UI. Add color based on status.
3. Implement `CampaignCard`:
   - Use `Card`, `CardHeader`, `CardContent`, `CardFooter`.
   - Display title, date, status badge, progress bar (if processing), error message if any.
   - Links to video URL if completed.
   - Use `cn` for conditional classes.
4. Implement `CampaignGrid` as a simple responsive grid container.
5. Implement `CampaignMetricsCard`:
   - Accept `CampaignMetrics` object.
   - Display 4 stat cards in a grid (total, active, completed, success rate).
   - Use icons from lucide-react.
6. Add `index.ts` exports.
7. Update `src/forest/dashboard/index.ts` to re-export campaign module.

## Todo List
- [ ] Create files
- [ ] Implement CampaignStatusBadge
- [ ] Implement CampaignProgressBar
- [ ] Implement CampaignCard
- [ ] Implement CampaignGrid
- [ ] Implement CampaignMetricsCard
- [ ] Update index.ts exports
- [ ] Type-check

## Success Criteria
- Components render without errors
- i18n works (all labels translate)
- Responsive layout (grid cols adjust: 1 on mobile, 2 tablet, 3-4 desktop)
- TypeScript passes

## Risk Assessment
Low: Components are straightforward UI.
