# Phase 4: Motion System Integration

## Context
- **Plan:** [Overview](./plan.md)
- **Research:** [Framer Motion Effects](../research/researcher-02-framer-motion-effects.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Apply a cohesive motion language across the entire site. Elements should not just "appear"; they should slide, fade, and scale into view as the user scrolls.

## Key Insights
- **Scroll Reveal:** `whileInView` is the key hook.
- **Stagger:** Lists (features, pricing) should cascade in, not appear all at once.
- **Micro-interactions:** Buttons and links need satisfying hover states.

## Requirements
1.  **Global Scroll Reveal:** Create a `FadeIn` wrapper component.
2.  **Staggered Lists:** Apply to Features grid and Tech Stack.
3.  **Parallax:** Subtle parallax on background elements between sections.

## Architecture
- **Wrapper Component:** `components/animations/FadeIn.tsx`
- **Hook:** Custom `useScrollParallax` hook if needed.

## Related Code Files
- Create: `app/components/animations/FadeIn.tsx`
- Modify: `app/components/sections/*.tsx` (Apply wrappers)

## Implementation Steps

1.  **Create `FadeIn` Component**
    - Props: `direction` (up, down, left, right), `delay`, `duration`.
    - Use `motion.div` with `initial="hidden" whileInView="visible" viewport={{ once: true }}`.

2.  **Apply to Sections**
    - Wrap Section headers with `FadeIn direction="up"`.
    - Wrap Feature grids with a staggered variant container.

3.  **Button Interactions**
    - Update `Button` component (or `GlassCard` interactive states) with `whileHover={{ scale: 1.05 }}` and `whileTap={{ scale: 0.95 }}`.

## Code Example (FadeIn.tsx)
```tsx
"use client";
import { motion } from "framer-motion";

export function FadeIn({ children, delay = 0, className }: { children: React.ReactNode, delay?: number, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

## Todo List
- [x] Create `FadeIn` animation wrapper.
- [x] Apply `FadeIn` to `Workflow`, `Features`, and `About` sections.
- [x] Update `Button` component with hover/tap scales.
- [x] Add `StaggerContainer` for grid items.

## Success Criteria
- [x] Scrolling feels fluid and dynamic.
- [x] No "flash of unstyled content" (FOUC).
- [x] Animations trigger at the correct viewport position.

## Next Steps
- Proceed to [Phase 5: Premium Components](./phase-05-premium-components.md).
