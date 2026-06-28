# Phase 6: Admin Dashboard

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Create the internal management interface for Sophia.

## Overview
- **Priority**: P2 (Internal Tool)
- **Status**: Pending
- **Description**: A secure area to manage the platform. Includes "God Mode" controls to simulate tiers, view system stats, and potentially manage the affiliate list (read-only for now).

## Key Insights
- **Security**: Must be protected. Use Middleware Basic Auth as a robust, database-free solution.
- **Layout**: Different layout from Landing Page (Sidebar navigation, denser information).
- **Functionality**: Focus on *observability* and *configuration*.

## Requirements
1.  **Auth**:
    -   Middleware check on `/admin/*`.
    -   Credentials stored in ENV variables (`ADMIN_USER`, `ADMIN_PASS`).
2.  **Dashboard Home**:
    -   Stats: Total Users (mock), Active Tiers, Affiliate Programs Count.
3.  **Feature Flags**:
    -   UI to toggle flags (visual only, or cookie-based override for testing).
4.  **Affiliate Manager**:
    -   Table view of all programs.
    -   Status column (Active/Pending).

## Architecture
- **Route Group**: `app/(admin)/admin/` to isolate layout.
- **Middleware**: `middleware.ts` matching `/admin`.
- **Components**: `app/components/admin/*`.

## Related Code Files
- `middleware.ts`
- `app/(admin)/admin/layout.tsx`
- `app/(admin)/admin/page.tsx`
- `app/(admin)/admin/features/page.tsx`
- `app/components/admin/admin-sidebar.tsx`

## Implementation Steps
1.  **Configure Middleware**: Implement Basic Auth logic in `middleware.ts`.
2.  **Create Admin Layout**: Sidebar + Header + Main Content area.
3.  **Build Dashboard Home**:
    -   Simple stat cards (using `Card` component).
4.  **Build Feature Flag UI**:
    -   List flags from `config/flags.ts`.
    -   Add toggles (visual simulation of "Environment State").
5.  **Build Affiliate Table**:
    -   Simple HTML table or Grid to list all programs.

## Todo List
- [ ] Implement `middleware.ts` for Basic Auth.
- [ ] Create `app/(admin)/admin/layout.tsx`.
- [ ] Create `app/(admin)/admin/page.tsx` (Stats).
- [ ] Create `app/(admin)/admin/features/page.tsx` (Flags).
- [ ] Create `app/components/admin/admin-sidebar.tsx`.
- [ ] Verify auth protection (incognito mode).

## Success Criteria
- [ ] Accessing `/admin` prompts for password.
- [ ] Dashboard renders correctly after auth.
- [ ] Layout is distinct from public pages.

## Risk Assessment
- **Risk**: Basic Auth is annoying for frequent use.
- **Mitigation**: Browser saves credentials. Good enough for MVP.

## Next Steps
- Proceed to Phase 7: Integration & Polish.
