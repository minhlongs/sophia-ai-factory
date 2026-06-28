# Phase 1: Project Setup & Design System

## Context
- **Plan**: `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/plans/260204-1839-sophia-enterprise-video-factory/plan.md`
- **Goal**: Establish the "Deep Space" visual language and technical foundation.

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: Pending
- **Description**: Initialize the Next.js environment with Tailwind v4, configure the "Deep Space" theme (colors, typography, shadows), and set up the animation library (Framer Motion). Create the atomic UI components (Buttons, Cards, Inputs) that will be used throughout the application.

## Key Insights
- **Glassmorphism 2.0**: Requires careful layering of background blurs, borders, and gradients.
- **Tailwind v4**: Uses CSS variables for theming, simpler config than v3.
- **Performance**: Motion components should be lazy-loaded or used efficiently (LayoutGroup, AnimatePresence).

## Requirements
1.  **Tech Stack**: Next.js 16.1.6, React 19, Tailwind CSS 4, Framer Motion, Lucide React.
2.  **Theme**:
    -   Background: Deep dark blue/black gradients (`bg-slate-950` to `bg-black`).
    -   Accents: Neon Cyan (`#00F0FF`) and Electric Purple (`#7000FF`).
    -   Glass: White with 5-10% opacity, backdrop blur 10px-20px.
3.  **Typography**: Sans-serif, modern, readable (Inter or Geist).
4.  **Components**:
    -   `Button` (Primary, Secondary, Ghost, Glow effect).
    -   `Card` (Glassmorphic container).
    -   `Badge` (Tier indicators).
    -   `Container` (Responsive max-width wrapper).

## Architecture
- **Global CSS**: Define CSS variables for colors to support Tailwind v4 features.
- **Component Library**: `app/components/ui/*` (following shadcn/ui pattern but custom styled).
- **Utils**: `lib/utils.ts` for `cn` (clsx + tailwind-merge).

## Related Code Files
- `app/globals.css`: Theme variables.
- `tailwind.config.ts`: (If needed, or use CSS vars).
- `app/layout.tsx`: Root layout with fonts and providers.
- `lib/utils.ts`: Utility functions.
- `app/components/ui/button.tsx`
- `app/components/ui/card.tsx`
- `app/components/ui/badge.tsx`

## Implementation Steps
1.  **Install Dependencies**: `npm install framer-motion clsx tailwind-merge lucide-react`.
2.  **Configure Theme**: Update `app/globals.css` with CSS variables for the Deep Space palette.
3.  **Setup Utils**: Create `lib/utils.ts` with the standard `cn` helper.
4.  **Create Atomic Components**:
    -   **Button**: Implement variants including a special "Glow" variant for CTAs.
    -   **Card**: Implement the standard Glassmorphic card.
    -   **Badge**: Implement status/tier badges.
5.  **Setup Fonts**: Configure `next/font` in `app/layout.tsx`.
6.  **Verify Setup**: Create a temporary test page showing all components.

## Todo List
- [ ] Install `framer-motion`, `clsx`, `tailwind-merge`, `lucide-react`.
- [ ] Define CSS variables in `app/globals.css` (Colors: Deep Space, Neon Cyan, Electric Purple).
- [ ] Create `lib/utils.ts`.
- [ ] Create `Button` component with "Glow" variant.
- [ ] Create `Card` component (Glassmorphism).
- [ ] Create `Badge` component.
- [ ] Configure Fonts in `app/layout.tsx`.
- [ ] Verify build (`npm run build`).

## Success Criteria
- [ ] App compiles without errors.
- [ ] Tailwind v4 styles apply correctly.
- [ ] Components look like the "Deep Space" design spec.
- [ ] Framer Motion animations work on interaction (hover/tap).

## Risk Assessment
- **Risk**: Tailwind v4 compatibility issues with existing v3 patterns.
- **Mitigation**: Stick to CSS variables and standard CSS syntax where possible.

## Next Steps
- Proceed to Phase 2: Core Infrastructure.
