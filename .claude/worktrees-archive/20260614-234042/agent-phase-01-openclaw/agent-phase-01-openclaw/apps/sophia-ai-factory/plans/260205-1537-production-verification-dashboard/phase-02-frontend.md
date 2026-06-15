# Phase 2: Frontend Implementation

## Objective
Visualize the system health status in the dashboard.

## Implementation Steps

1.  **Create Types**
    - Define TypeScript interfaces for the health response in `src/types/health.ts` (or inside the component if simple).

2.  **Create `HealthIndicator` Component**
    - File: `src/components/dashboard/HealthIndicator.tsx`
    - Function: Fetches `/api/health` periodically or on mount.
    - UI: Small dot (Green/Yellow/Red) with tooltip or label.
    - Location: Sidebar (bottom, near settings/logout).

3.  **Create `SystemHealth` Page**
    - File: `src/app/dashboard/system-health/page.tsx`
    - Function: Detailed view of all services.
    - UI: Card grid or list showing each service status.

4.  **Update Dashboard Layout**
    - File: `src/app/dashboard/layout.tsx`
    - Add `HealthIndicator` to the sidebar navigation.

## Code Files
- `src/components/dashboard/HealthIndicator.tsx` (New)
- `src/app/dashboard/system-health/page.tsx` (New)
- `src/app/dashboard/layout.tsx` (Update)
