# Phase 04: Mobile & Responsive Polish

## Context Links
- Plan: [plan.md](./plan.md)
- Mobile nav: `apps/sophia-ai-factory/src/seed/components/ui/mobile-nav.tsx:1`
- Sidebar nav: `apps/sophia-ai-factory/src/forest/dashboard/dashboard-sidebar-nav.tsx:1`
- Table primitive: `apps/sophia-ai-factory/src/seed/components/ui/table.tsx:1`
- Container: `apps/sophia-ai-factory/src/seed/components/ui/container.tsx:1`

## Overview
- Priority: P1
- Status: pending
- Effort: 2.5h
- Description: Ensure responsive UX across mobile viewports (down to 375px) by enforcing touch targets >= 44px, wrapping tables in horizontal scroll containers, and polishing mobile navigation drawer and sheet components.

## Key Insights
- `MobileNav` (`src/seed/components/ui/mobile-nav.tsx`) links need 44px minimum touch targets and active state indicators to comply with mobile touch guidelines.
- Multiple data tables in `src/forest/components/` (`installation-runs-tab`, `creator-payouts-section`, `admin-billing-overages-table`, `payouts-client`, `audit-history-table`, `pricing-comparison-table`) risk horizontal viewport blowout on 375px screens if not wrapped in `overflow-x-auto` or using the `<Table>` primitive.
- Navigation links in `dashboard-sidebar-nav.tsx` have `min-h-[44px]` (good), but need responsive mobile sheet triggers on small viewports.

## Requirements
### Functional
- `MobileNav`: Ensure every tap target is at least 44x44px (`min-h-[44px] min-w-[44px] flex items-center justify-center`).
- Table wrapping: Wrap all dashboard tables in responsive scroll containers (`overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0`).
- Responsive grids: Ensure multi-column dashboard stats collapse gracefully (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- Prevent horizontal scrollbars on body at 375px viewport.

### Non-Functional
- Smooth CSS transitions for mobile interactions.
- Zero layout shift (CLS) during viewport resizing.
- Performance: Avoid expensive layout recalculations.

## Architecture
```
Mobile Viewport (<= 768px)
  ├── MobileNav (bottom fixed bar with 44px touch targets)
  ├── Responsive Data Tables (overflow-x-auto scroll container)
  └── Responsive Stat Grids (grid-cols-1 -> sm:grid-cols-2 -> lg:grid-cols-4)
```

## File Ownership
This phase strictly owns and modifies the following files:

### Files to Modify
1. `apps/sophia-ai-factory/src/seed/components/ui/mobile-nav.tsx`
2. `apps/sophia-ai-factory/src/forest/components/sop/installation-runs-tab.tsx`
3. `apps/sophia-ai-factory/src/forest/components/sop/creator-payouts-section.tsx`
4. `apps/sophia-ai-factory/src/forest/components/sop/installation-list-table.tsx`
5. `apps/sophia-ai-factory/src/forest/components/dashboard/admin-billing-overages-table.tsx`
6. `apps/sophia-ai-factory/src/forest/components/dashboard/payouts-client.tsx`
7. `apps/sophia-ai-factory/src/forest/components/dashboard/referral-stats-section.tsx`
8. `apps/sophia-ai-factory/src/forest/components/dashboard/admin-billing-dunning-section.tsx`
9. `apps/sophia-ai-factory/src/forest/components/audit/audit-history-table.tsx`
10. `apps/sophia-ai-factory/src/forest/components/pricing/pricing-comparison-table.tsx`
11. `apps/sophia-ai-factory/src/forest/components/analytics/revenue-card.tsx`
12. `apps/sophia-ai-factory/src/forest/components/analytics/cohort-retention-chart.tsx`
13. `apps/sophia-ai-factory/src/forest/dashboard/campaign/analytics-recent-campaigns.tsx`

## Implementation Steps
1. In `src/seed/components/ui/mobile-nav.tsx`:
   - Increase icon/touch area to `min-h-[44px] min-w-[44px]` with proper active highlight pill.
   - Add backdrop blur and border styling matching Cyber-Glass tokens.
2. In `src/forest/components/sop/` tables (`installation-runs-tab.tsx`, `creator-payouts-section.tsx`, `installation-list-table.tsx`):
   - Wrap `<table>` in `<div className="w-full overflow-x-auto rounded-lg border border-border">`.
3. In `src/forest/components/dashboard/` tables (`admin-billing-overages-table.tsx`, `payouts-client.tsx`, `referral-stats-section.tsx`, `admin-billing-dunning-section.tsx`):
   - Wrap tables with `overflow-x-auto` container and add mobile-friendly cell truncation.
4. In `src/forest/components/audit/audit-history-table.tsx`:
   - Add responsive table container.
5. In `src/forest/components/pricing/pricing-comparison-table.tsx`:
   - Ensure sticky first column on mobile overflow scroll for comparison usability.
6. In `src/forest/components/analytics/` (`revenue-card.tsx`, `cohort-retention-chart.tsx`, `analytics-recent-campaigns.tsx`):
   - Wrap charts and tables in horizontal scroll containers.
7. Run `npm run type-check`.

## Todo List
- [ ] Polish `mobile-nav.tsx` for >=44px touch targets and Cyber-Glass styling
- [ ] Add `overflow-x-auto` wrapping to SOP tables in `installation-runs-tab.tsx` & `creator-payouts-section.tsx`
- [ ] Add `overflow-x-auto` wrapping to `installation-list-table.tsx`
- [ ] Add `overflow-x-auto` wrapping to billing tables in `admin-billing-overages-table.tsx` & `payouts-client.tsx`
- [ ] Add `overflow-x-auto` wrapping to `referral-stats-section.tsx` & `admin-billing-dunning-section.tsx`
- [ ] Add `overflow-x-auto` wrapping to `audit-history-table.tsx` & `pricing-comparison-table.tsx`
- [ ] Add responsive wrapping to analytics tables in `revenue-card.tsx` & `analytics-recent-campaigns.tsx`
- [ ] Run `npm run type-check`

## Success Criteria
- [ ] All table components scroll horizontally without breaking page layout at 375px
- [ ] Mobile navigation tap targets >= 44x44px
- [ ] Zero horizontal body overflow on mobile screens
- [ ] TypeScript check passes cleanly

## Risk Assessment & Mitigations
- **Risk:** Table scrollbars appearing visually cluttered.
  - **Mitigation:** Use custom thin scrollbar utility or subtle webkit scrollbar styles.
- **Risk:** Nested horizontal scrolling conflicts.
  - **Mitigation:** Only scroll the inner table element, not outer card wrapper.

## Security Considerations
- Responsive layouts must not hide security-relevant confirmation dialogs or warnings on mobile viewports.

## Next Steps
- Pass to Phase 05 for Empty State unification and bilingual i18n audit.
