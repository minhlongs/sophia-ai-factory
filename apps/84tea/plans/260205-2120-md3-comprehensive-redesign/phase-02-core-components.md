# Phase 2: Core MD3 Components

## Context Links
- [MD3 Components](https://m3.material.io/components)
- [Phase 1 Foundation](./phase-01-md3-foundation.md)

## Overview
- **Priority**: P1 (Critical)
- **Status**: Completed
- **Description**: Build the library of atomic, reusable MD3 components that will be used to construct pages. Focus on strict adherence to MD3 states (hover, focus, active, disabled) and styling.

## Key Insights
- **State Layers**: MD3 uses opacity overlays for states. Tailwind `bg-opacity` or `before:absolute` overlays are needed.
- **Ripple Effect**: While optional, a simple CSS ripple or React-based ripple adds authentic MD feel.
- **Accessibility**: All interactive components need focus rings and aria attributes.

## Requirements
1.  **Buttons**: Filled, Tonal, Outlined, Text, FAB.
2.  **Cards**: Elevated, Filled, Outlined (with interactive states).
3.  **Inputs**: Filled and Outlined Text Fields with floating labels.
4.  **Feedback**: Dialogs (Alert/Confirm), Snackbars, Progress Indicators.

## Architecture
- **Component Directory**: `src/components/ui/`
- **Pattern**: Composition (Slots) over rigid props where possible, but strictly typed variants.
- **Styling**: `cva` (class-variance-authority) or simple `clsx` for variant management.

## Related Code Files
- Create/Update: `src/components/ui/button.tsx`
- Create/Update: `src/components/ui/card.tsx`
- Create/Update: `src/components/ui/input.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/snackbar.tsx`
- Create: `src/components/ui/progress.tsx`

## Implementation Steps
1.  **Button Component**: Implement variants using `cva`. Add state layers (hover/active opacity). Ensure icons support (Material Symbols).
2.  **Card Component**: Implement Elevated, Filled, Outlined variants. Add hover elevation transition for interactive cards.
3.  **Input Component**: Implement Text Field with floating label animation (peer-focus pattern in Tailwind).
4.  **Dialog Component**: specific Modal/Dialog implementation using HTML `<dialog>` or Headless UI logic for accessibility.
5.  **Progress**: Circular and Linear progress indicators using brand colors.
6.  **Icons**: Integrate Material Symbols (via font or SVG) helper.

## Todo List
- [x] Implement `Button` (Filled, Tonal, Outlined, Text)
- [x] Implement `FAB`
- [x] Implement `Card` (Elevated, Filled, Outlined)
- [x] Implement `Input` (TextField with floating label)
- [x] Implement `Dialog` foundation
- [x] Implement `Snackbar` (Toast)
- [x] Implement `Progress` (Circular/Linear)

## Success Criteria
- [x] Buttons match MD3 specs (height, padding, radius, font).
- [x] Inputs animate label on focus/value.
- [x] Components are accessible via keyboard.

## Risk Assessment
- **Risk**: Complexity of "Floating Label" in pure CSS.
  - **Mitigation**: Use established Tailwind patterns (`peer-placeholder-shown`) to handle floating labels without heavy JS.

## Next Steps
- Phase 3: Navigation Components.
