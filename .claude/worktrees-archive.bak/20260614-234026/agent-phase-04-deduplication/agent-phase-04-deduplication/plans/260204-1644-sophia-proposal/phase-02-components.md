# Phase 2: UI Components & Design System

## Context
Create the atomic building blocks for the website. The design should be "Cyberpunk": dark backgrounds, glowing borders, gradients, and glassmorphism.

## Component List

### 1. `Button`
- **Variants:**
    - `primary`: Gradient background (Blue -> Purple), glow effect on hover.
    - `secondary`: Transparent background, gradient border, glow text.
    - `ghost`: Simple hover effect.
- **Props:** `variant`, `size`, `className`, `children`, `onClick`.

### 2. `Card`
- **Style:** Glassmorphism (bg-white/5 or bg-black/40), thin border (white/10 or accent color), backdrop blur.
- **Props:** `className`, `children`, `hoverEffect` (boolean).

### 3. `GradientText`
- **Style:** `bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600`.
- **Props:** `children`, `className`.

### 4. `Section` (Wrapper)
- **Style:** `py-16` or `py-24`, `container mx-auto`, `px-4`.
- **Props:** `id`, `className`, `children`.

### 5. `Badge` / `Tag`
- **Style:** Small, rounded-full, border, low opacity background.
- **Usage:** For "Recommended" tier, or feature tags.

## Implementation Steps

1.  Create `app/components/ui/Button.tsx`
2.  Create `app/components/ui/Card.tsx`
3.  Create `app/components/ui/GradientText.tsx`
4.  Create `app/components/ui/Section.tsx`
5.  Create `lib/utils.ts` for `cn` (clsx + tailwind-merge) helper.

## Success Criteria
- [ ] All atomic components implemented
- [ ] Components look consistent with Cyberpunk theme
- [ ] Components are responsive
