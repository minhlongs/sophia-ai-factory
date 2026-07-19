# Phase 6: Mobile Polish

## Context
- **Plan:** [Overview](./plan.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Ensure the "Wow" factor translates to small screens. Complex animations can feel clunky on mobile; we need to optimize for touch and vertical scrolling.

## Key Insights
- **Scroll Snap:** Helps guide users through feature highlights.
- **Simplified Nav:** Full-screen glass menu instead of a small dropdown.
- **Performance:** Reduce particle counts and blur radii on mobile.

## Requirements
1.  **Mobile Navigation:** Hamburger menu triggers full-screen modal with staggered link entry.
2.  **Scroll Snap:** Apply to Horizontal scroll sections (if any) or vertical sections.
3.  **Touch targets:** Ensure buttons are 44px+ height.

## Architecture
- **Responsive Design:** Mobile-first Tailwind classes (`md:`, `lg:` overrides).

## Implementation Steps

1.  **Mobile Menu**
    - Create `MobileNav` component.
    - `AnimatePresence` for entrance/exit.
    - Glass background (`backdrop-blur-xl bg-deep-space/90`).

2.  **Refine Hero for Mobile**
    - Stack text and 3D elements.
    - Reduce size of background orbs.

3.  **Horizontal Scroll Areas**
    - If Tech Stack is wide, make it scrollable with `snap-x`.

## Todo List
- [x] Build `MobileNav` with animation.
- [x] Verify Hero scaling on <375px screens.
- [x] Check touch targets for all interactive elements.

## Success Criteria
- [x] Menu opens/closes smoothly on mobile.
- [x] No horizontal overflow issues.
- [x] Text is readable (16px+ base size).

## Next Steps
- Proceed to [Phase 7: Optimization & Launch](./phase-07-performance-deploy.md).
