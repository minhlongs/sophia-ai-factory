# Phase 2: Design System Setup (MD3)

**Status:** Completed
**Priority:** Critical
**Dependency:** Phase 1

## Overview
Implement the Material Design 3 (MD3) Design System using Tailwind CSS variables and utility classes, strictly following the 84tea Brand Guidelines.

## Key Design Tokens
- **Primary:** Imperial Green (`#1b5e20`)
- **Secondary:** Gold Leaf (`#c5a962`)
- **Tertiary:** Deep Rosewood (`#4e342e`)
- **Surface:** Ivory Silk (`#fbf8f3`)
- **Fonts:** Playfair Display (Display/Headlines), Inter (Body)

## Implementation Steps

1.  **Define CSS Variables**
    - [x] Update `src/app/globals.css` with the full MD3 color palette.
    - [x] Define Typography scale variables.

2.  **Update Tailwind Config**
    - [x] Map Tailwind colors to CSS variables (via CSS @theme).
    - [x] Extend font families.

3.  **Create "CN" Utility**
    - [x] Create `src/lib/utils.ts`.

4.  **Implement Core Components**
    - [x] `src/components/ui/button.tsx`
    - [x] `src/components/ui/card.tsx`
    - [x] `src/components/ui/typography.tsx`
    - [x] `src/components/ui/logo.tsx`

## Validation
- [x] Primary button uses `#1b5e20` and white text.
- [x] Background is `#fbf8f3`.
- [x] Headings use Playfair Display.
