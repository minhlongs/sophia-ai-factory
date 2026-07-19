# Phase 5: Premium Components (Pricing & ROI)

## Context
- **Plan:** [Overview](./plan.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Upgrade the high-conversion components: Pricing Cards and ROI Calculator. These need to look trustworthy, premium, and interactive.

## Key Insights
- **Pricing:** Highlight the "Pro" tier with a "Holographic" border effect.
- **ROI Calculator:** Needs to feel like a financial tool—responsive, animated numbers, and visual feedback (color changes).

## Requirements
1.  **Pricing Cards:**
    - "Popular" badge with glow.
    - Holographic/Rainbow border for the featured plan.
    - Checkmark lists with nice icons.
2.  **ROI Calculator:**
    - Sliders for inputs (Traffic, Conversion Rate).
    - Animated counter for "Estimated Revenue".
    - Glass panel container.

## Architecture
- **Components:**
    - `components/sections/Pricing.tsx`
    - `components/sections/ROICalculator.tsx`
- **State Management:** Local React state for Calculator logic.

## Implementation Steps

1.  **Pricing Upgrade**
    - Use `GlassCard` as base.
    - For "Pro" plan: Add an absolute div with `bg-gradient-to-r` behind the card to create a border, or use `border-image` properties.
    - Add "Shine" animation on hover.

2.  **ROI Calculator Logic & UI**
    - Create a slider input with custom styling (neon track).
    - Use `framer-motion`'s `animate` function to tween the Revenue number when inputs change.
    - `const revenue = traffic * conversion * aov`.

## Code Example (Holographic Border)
```tsx
<div className="relative p-[1px] rounded-2xl overflow-hidden group">
  {/* Moving Gradient Border */}
  <div className="absolute inset-0 bg-gradient-to-r from-neon-pink via-neon-purple to-neon-cyan animate-spin-slow opacity-75" />

  <GlassCard className="relative h-full bg-deep-space/90">
    {/* Content */}
  </GlassCard>
</div>
```

## Todo List
- [x] Rebuild Pricing Section with new `GlassCard` variants.
- [x] Implement Holographic border for "Best Value" plan.
- [x] Build interactive ROI Calculator with sliders and animated result.

## Success Criteria
- [x] Pricing cards clearly differentiate tiers.
- [x] ROI Calculator is fun to use and updates instantly.
- [x] "Estimated Revenue" number animates (counts up/down).

## Next Steps
- Proceed to [Phase 6: Mobile Polish](./phase-06-mobile-polish.md).
