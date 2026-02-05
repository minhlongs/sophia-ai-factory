# Phase 1: MD3 Foundation Setup

## Context Links
- [MD3 Research Report](../reports/researcher-md3-tailwind-260205-2120.md)
- [Project CLAUDE.md](../../CLAUDE.md)
- [Material Design 3 Guidelines](https://m3.material.io/)

## Overview
- **Priority**: P1 (Critical)
- **Status**: Completed
- **Description**: Establish the technical foundation for MD3 by implementing CSS variables for color tokens, configuring Tailwind to map these tokens, setting up the typography scale using `next/font`, and creating the base layout structure.

## Key Insights
- **CSS Variables**: Essential for dynamic theming and dark mode support without runtime overhead.
- **Next/Font**: Preferred over `@fontsource` for better performance and zero layout shift.
- **Tailwind v4**: Using v4 capabilities for optimized CSS generation.

## Requirements
1.  **Color System**: Implement all MD3 color roles (Primary, Secondary, Tertiary, Surface, Error, etc.) as CSS variables.
2.  **Typography**: Configure `Playfair Display` and `Inter` with MD3 type scale (Display, Headline, Title, Body, Label).
3.  **Tailwind Config**: Map Tailwind colors and fonts to the CSS variables.
4.  **Layout**: Create a root layout that provides the theme and font classes.

## Architecture
- **Global CSS**: `src/app/globals.css` will house the `:root` and `.dark` variable definitions.
- **Tailwind Config**: `tailwind.config.ts` extends the theme to use `var(--md-sys-...)`.
- **Root Layout**: `src/app/layout.tsx` applies fonts and theme provider.

## Related Code Files
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts` (or `postcss.config.mjs` if using v4 native)
- Modify: `src/app/layout.tsx`
- Create: `src/lib/fonts.ts` (centralized font configuration)

## Implementation Steps
1.  **Define Fonts**: Create `src/lib/fonts.ts` to export `Playfair_Display` and `Inter` using `next/font/google`.
2.  **CSS Tokens**: Update `src/app/globals.css` with the complete set of MD3 color tokens for Light Mode (Imperial Green theme).
3.  **Tailwind Config**: Update `tailwind.config.ts` to map colors (e.g., `primary: 'var(--md-sys-color-primary)'`) and typography/font-family.
4.  **Breakpoints**: Configure Tailwind screens to match MD3 breakpoints (compact, medium, expanded, large, xl).
5.  **Root Layout**: Integrate `next-themes` provider and apply font variables to the `<body>` tag.
6.  **Reset**: Ensure CSS reset (Tailwind base) is correctly applied.

## Todo List
- [x] Create `src/lib/fonts.ts`
- [x] Define MD3 Light Mode tokens in `src/app/globals.css`
- [x] Configure Tailwind colors and fonts
- [x] Define Tailwind breakpoints
- [x] Setup `ThemeProvider` in `src/app/layout.tsx`
- [x] Verify font loading and variable availability

## Success Criteria
- [x] `bg-primary` results in `#1b5e20`
- [x] Fonts render as Playfair Display (headings) and Inter (body)
- [x] Mobile/Desktop breakpoints trigger correctly

## Risk Assessment
- **Risk**: Color contrast issues on custom brand colors.
  - **Mitigation**: Use Material Theme Builder to verify contrast ratios generated from the seed color.

## Security Considerations
- None specific for CSS/Foundation.

## Next Steps
- Proceed to Phase 2: Core Components.
