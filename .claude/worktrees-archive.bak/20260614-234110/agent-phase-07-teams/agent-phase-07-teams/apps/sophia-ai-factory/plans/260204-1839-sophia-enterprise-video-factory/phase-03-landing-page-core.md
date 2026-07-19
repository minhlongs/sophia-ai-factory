# Phase 3: Landing Page (Hero & Core Experience)

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Build the high-impact "MAX WOW" sections of the landing page.

## Overview
- **Priority**: P1
- **Status**: Pending
- **Description**: Implement the top-of-funnel experience. This includes a visually stunning Hero section with deep space particles/glow, an animated Workflow section showing how the AI Factory works, and a Features grid using bento-box style layout.

## Key Insights
- **Motion**: Use Framer Motion for entrance animations (fade-up, stagger).
- **Visuals**: High contrast neon on dark backgrounds. "Glass" cards for content.
- **Responsiveness**: Mobile-first, stacking grids on small screens.

## Requirements
1.  **Hero Section**:
    -   Headline: "AI Video Factory: Turn Content into Empire".
    -   Subhead: "Automated. Scalable. Profitable."
    -   CTA: "Start Free" (Glow button) & "Watch Demo".
    -   Visual: Abstract 3D/Particle background (CSS/Canvas or Video).
2.  **Workflow Section**:
    -   Steps: 1. Select Niche -> 2. AI Generate -> 3. Publish -> 4. Profit.
    -   Animation: Connecting lines/dots flowing between steps.
3.  **Features Section**:
    -   Bento Grid layout.
    -   Cards: "Multi-Channel", "Auto-Affiliate", "KOL Voice Cloning".

## Architecture
- **Page**: `app/page.tsx` (Composes sections).
- **Sections**: `app/components/sections/hero.tsx`, `app/components/sections/workflow.tsx`, `app/components/sections/features.tsx`.
- **Assets**: Images/Icons in `public/`.

## Related Code Files
- `app/page.tsx`
- `app/components/sections/hero.tsx`
- `app/components/sections/workflow.tsx`
- `app/components/sections/features.tsx`
- `app/components/ui/section-heading.tsx` (Reusable)

## Implementation Steps
1.  **Create Layout Shell**: Update `app/page.tsx` to include the Navbar (placeholder) and Footer (placeholder).
2.  **Build Hero Section**:
    -   Implement layout.
    -   Add background effects (radial gradients, floating elements).
    -   Add Motion elements (title slide-up).
3.  **Build Workflow Section**:
    -   Create "Step Card" component.
    -   Implement the 4-step flow with animated connectors.
4.  **Build Features Section**:
    -   Implement Bento Grid (CSS Grid).
    -   Create Feature Cards with hover effects (border glow).
5.  **Refine Mobile View**: Ensure padding/font-sizes scale down.

## Todo List
- [ ] Create `app/components/ui/section-heading.tsx`.
- [ ] Implement `app/components/sections/hero.tsx`.
- [ ] Implement `app/components/sections/workflow.tsx`.
- [ ] Implement `app/components/sections/features.tsx`.
- [ ] Integrate sections into `app/page.tsx`.
- [ ] Verify responsiveness.

## Success Criteria
- [ ] Hero section loads instantly (LCP optimized).
- [ ] Animations run smoothly (60fps).
- [ ] Design matches "Deep Space" aesthetic.

## Risk Assessment
- **Risk**: Heavy animations causing layout shift or jank.
- **Mitigation**: Use `transform` and `opacity` only for animations. Use `will-change` sparingly.

## Next Steps
- Proceed to Phase 4: Landing Page Conversion.
