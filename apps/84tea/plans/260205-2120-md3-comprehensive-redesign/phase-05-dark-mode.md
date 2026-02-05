# Phase 5: Dark Mode

## Context Links
- [MD3 Dark Theme](https://m3.material.io/styles/color/the-color-system/dark-theme)
- [Phase 1 Foundation](./phase-01-md3-foundation.md)

## Overview
- **Priority**: P2
- **Status**: Pending
- **Description**: Implement a high-quality Dark Mode using MD3 principles (desaturated colors, lighter surfaces for elevation).

## Key Insights
- **Desaturation**: Primary colors should be less saturated in dark mode to avoid eye strain (`#a5d6a7` instead of `#1b5e20`).
- **Surface Elevation**: In MD3 dark mode, elevation is indicated by lighter surface overlays, not just shadows.

## Requirements
1.  **Color Mapping**: Define `.dark` CSS variables for all roles.
2.  **Toggle**: Component to switch themes (sun/moon icon).
3.  **System Sync**: Default to user's system preference.

## Architecture
- **CSS Variables**: Expand `src/app/globals.css` with `.dark` selector.
- **Next-Themes**: Library already set up in Phase 1, just need to hook up the UI.

## Related Code Files
- Modify: `src/app/globals.css`
- Create: `src/components/ui/theme-toggle.tsx`

## Implementation Steps
1.  **Define Dark Tokens**: Calculate/Generate the dark equivalents for Imperial Green and Gold Leaf.
    - Primary: Light Green (`#a5d6a7`)
    - On Primary: Dark Green (`#00390f`)
    - Surface: Dark Grey (`#121212`) or dark green tint.
2.  **Apply CSS**: Add these to `.dark` block in globals.css.
3.  **Theme Toggle**: Create a button (Icon Button) in the Top App Bar / Drawer to switch modes.
4.  **Elevation Overlay**: (Advanced) Implement a utility to lighten background color based on elevation level in dark mode (optional, or use specific surface colors: surface-1, surface-2).

## Todo List
- [ ] Define Dark Mode color palette
- [ ] Update `globals.css` with dark variables
- [ ] Create `ThemeToggle` component
- [ ] Test contrast in Dark Mode

## Success Criteria
- [ ] Dark mode is readable and comfortable.
- [ ] Brand identity (Green/Gold) is still recognizable.
- [ ] No "flash of incorrect theme" on load.

## Risk Assessment
- **Risk**: Low contrast text in dark mode.
  - **Mitigation**: Strictly follow MD3 "On Surface" color tokens which guarantee contrast.

## Next Steps
- Phase 6: Accessibility.
