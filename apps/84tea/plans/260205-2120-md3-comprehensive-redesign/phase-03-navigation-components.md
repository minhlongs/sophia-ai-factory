# Phase 3: Navigation Components

## Context Links
- [MD3 Navigation](https://m3.material.io/components/navigation-drawer/overview)
- [Phase 2 Core Components](./phase-02-core-components.md)

## Overview
- **Priority**: P1
- **Status**: Pending
- **Description**: Implement the responsive navigation structure defined in MD3: Navigation Drawer for mobile/tablet, Top App Bar for global actions, and Navigation Rail/Bar as needed.

## Key Insights
- **Responsive Behavior**: Navigation must adapt based on breakpoints (Drawer on mobile, Standard nav on desktop).
- **Top App Bar**: Needs to handle scroll behavior (center aligned vs small/medium).

## Requirements
1.  **Top App Bar**: Center aligned (Logo), Leading icon (Menu), Trailing icons (Cart, Search).
2.  **Navigation Drawer**: Modal drawer for mobile (Hamburger menu). Standard drawer for Tablet/Desktop if applicable (or simple Top Nav for website).
3.  **Bottom Navigation**: Mobile-only bottom bar for quick access (Home, Products, Cart, Profile).
4.  **Tabs**: For product categorization.

## Architecture
- **Layout Integration**: `src/components/layout/` components integrated into `src/app/layout.tsx`.
- **State Management**: Simple React state or Context for Drawer Open/Close.

## Related Code Files
- Create: `src/components/layout/top-app-bar.tsx`
- Create: `src/components/layout/navigation-drawer.tsx`
- Create: `src/components/layout/bottom-nav.tsx`
- Create: `src/components/ui/tabs.tsx`

## Implementation Steps
1.  **Top App Bar**: Implement the container, scroll behavior (sticky/hide on scroll), and slot layout (Leading, Headline, Trailing).
2.  **Navigation Drawer**: Implement the Modal Drawer pattern with backdrop for mobile. Ensure focus trapping when open.
3.  **Bottom Navigation**: Create the fixed bottom bar for mobile viewports (`compact` breakpoint).
4.  **Tabs**: Implement MD3 Tabs (Primary/Secondary) with active indicator animation.
5.  **Integration**: Assemble these into a `MainLayout` component.

## Todo List
- [ ] Implement `TopAppBar`
- [ ] Implement `NavigationDrawer` (Mobile)
- [ ] Implement `BottomNavigation` (Mobile)
- [ ] Implement `Tabs` component
- [ ] Create responsive `MainLayout` wrapper

## Success Criteria
- [ ] Navigation switches between Bottom Bar/Drawer (Mobile) and Top Bar (Desktop) correctly.
- [ ] Smooth transitions for Drawer open/close.
- [ ] Active states clearly visible.

## Risk Assessment
- **Risk**: Z-index conflicts with sticky headers and drawers.
  - **Mitigation**: Define a strict Z-index scale in Tailwind config.

## Next Steps
- Phase 4: Page Redesign.
