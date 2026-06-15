# Phase 5: Affiliate Discovery Engine

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Build the core value prop for the Enterprise tier - the "Dự án Sạch" discovery engine.

## Overview
- **Priority**: P1
- **Status**: Pending
- **Description**: A dedicated page (`/affiliate-discovery`) that lists the curated high-quality affiliate programs. It features filtering, sorting, and detailed cards. It demonstrates the "Auto-Discovery" capability.

## Key Insights
- **Data-Driven**: The UI is a direct reflection of `data/affiliate-programs.json`.
- **Filtering**: Users need to find programs by Category, Commission Rate, and Platform.
- **Access Control**: This page should only be fully visible to Premium/Enterprise users. Basic users see a blurred preview or limit of 3.

## Requirements
1.  **Page Layout**: Sidebar (Filters) + Main Content (Grid).
2.  **Program Card**:
    -   Logo (Placeholder or text).
    -   Name & Category.
    -   Commission Badge (e.g., "50% Lifetime").
    -   Stats: Cookie duration, EPC.
    -   CTA: "Apply Now" / "View Details".
3.  **Filters**:
    -   Category (SaaS, AI, Marketing).
    -   Min Commission %.
    -   Platform (PartnerStack, Impact).
4.  **Gating**:
    -   Check Tier. If Basic, show overlay "Upgrade to unlock 150+ programs".

## Architecture
- **Page**: `app/affiliate-discovery/page.tsx`.
- **Components**: `app/components/affiliate/program-card.tsx`, `app/components/affiliate/filter-sidebar.tsx`, `app/components/affiliate/program-grid.tsx`.
- **State**: Client-side state for filters (using React `useState` or URL search params).

## Related Code Files
- `app/affiliate-discovery/page.tsx`
- `app/components/affiliate/program-card.tsx`
- `app/components/affiliate/filter-sidebar.tsx`
- `app/components/affiliate/program-grid.tsx`
- `lib/affiliates.ts`

## Implementation Steps
1.  **Scaffold Page**: Create `/affiliate-discovery` route.
2.  **Implement Data Fetching**: Load data from `lib/affiliates.ts` (Server Component).
3.  **Build Components**:
    -   `ProgramCard`: Glassmorphic style, prominent commission display.
    -   `FilterSidebar`: Checkboxes and Range sliders.
4.  **Implement Search/Filter Logic**:
    -   Use `useSearchParams` to make filters shareable.
    -   Filter the list client-side (since list is small < 200 items).
5.  **Implement Gating**:
    -   Wrap grid in a check. If locked, show first 3 items then a blurred "Upgrade" CTA.

## Todo List
- [ ] Create `app/affiliate-discovery/page.tsx`.
- [ ] Implement `ProgramCard`.
- [ ] Implement `FilterSidebar`.
- [ ] Implement `ProgramGrid` with filtering logic.
- [ ] Implement "Upgrade to Unlock" view for Basic users.
- [ ] Verify deep linking (filters via URL).

## Success Criteria
- [ ] Filtering works correctly (AND logic).
- [ ] Cards display all relevant data points.
- [ ] Gating prevents Basic users from seeing full list.

## Risk Assessment
- **Risk**: List growing too large for client-side filtering.
- **Mitigation**: It's fine for now (20-150 items). Pagination/Server-search for Phase 2.

## Next Steps
- Proceed to Phase 6: Admin Dashboard.
