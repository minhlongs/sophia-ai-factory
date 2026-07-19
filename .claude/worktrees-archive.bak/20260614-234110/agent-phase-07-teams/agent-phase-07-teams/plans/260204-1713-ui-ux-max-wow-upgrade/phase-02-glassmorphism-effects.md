# Phase 2: Glassmorphism 2.0 Effects

## Context
- **Plan:** [Overview](./plan.md)
- **Research:** [Premium UI Trends](../research/researcher-01-premium-ui-trends.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Implement the "Linear-style" glassmorphism aesthetic. This goes beyond simple blur; it requires micro-borders, inner glow, and noise textures to create a tactile, premium feel for cards and containers.

## Key Insights
- **Micro-borders:** 1px white/10 borders define shape without heavy lines.
- **Inner Glow:** A subtle gradient at the top of cards creates a "light source" effect.
- **Backdrop:** High blur (`backdrop-blur-xl`) with low opacity background.

## Requirements
1.  **Glass Card Component:** Reusable component for glass effects.
2.  **Glow Utilities:** CSS or utility classes for inner glows and gradient borders.
3.  **Noise Texture:** Global or component-level noise asset.

## Architecture
- **Component-based:** Create a `GlassCard` wrapper component in `components/ui`.
- **Composition:** Allow `className` prop for flexibility.

## Related Code Files
- Create: `app/components/ui/GlassCard.tsx`
- Modify: `app/components/ui/Container.tsx` (if used for sections)

## Implementation Steps

1.  **Create `GlassCard` Component**
    - Base styles: `relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl`.
    - Add hover effects: `hover:border-white/20 hover:bg-white/10 transition-all duration-300`.

2.  **Implement "Inner Glow"**
    - Use a pseudo-element or absolute child div.
    - `absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent`.

3.  **Add Noise Utility**
    - Add a reusable `.noise-bg` class in `globals.css` or SVG pattern.

4.  **Refactor Existing Cards**
    - Replace current `Card` usage in `Features` and `TechStack` with `GlassCard`.

## Code Example (GlassCard.tsx)
```tsx
import { cn } from "@/app/lib/utils";

export function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-white/10",
      "bg-white/5 backdrop-blur-xl shadow-2xl",
      "transition-all duration-500 hover:border-white/20 hover:bg-white/10 hover:shadow-neon-cyan/20",
      className
    )}>
      {/* Inner Glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-50" />

      {/* Content */}
      <div className="relative z-10 p-6">
        {children}
      </div>

      {/* Radial Gradient Blob on Hover (Optional) */}
      <div className="absolute -inset-full top-0 block h-[200%] w-[200%] rotate-90 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_40%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
}
```

## Todo List
- [x] Create `GlassCard.tsx`.
- [x] Add SVG noise texture to `public/assets` or inline SVG.
- [x] Test glass effect against the new Deep Space background (Phase 1).
- [x] Apply `GlassCard` to at least one section (e.g., Features) to verify look.

## Success Criteria
- [x] Cards look "glassy" but readable.
- [x] Hover states are smooth and subtle.
- [x] Inner glow provides 3D depth.

## Risk Assessment
- **Risk:** Blur filters can be performance-heavy on low-end devices.
- **Mitigation:** Use `backdrop-filter: none` on low-power mode media queries if possible, or keep blur radius reasonable.

## Next Steps
- Proceed to [Phase 3: Hero Animations](./phase-03-hero-animations.md).
