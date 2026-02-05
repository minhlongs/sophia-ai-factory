# Phase 6: Accessibility (a11y)

## Context Links
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MD3 Accessibility](https://m3.material.io/foundations/accessibility/overview)

## Overview
- **Priority**: P1 (Critical for franchise standards)
- **Status**: Pending
- **Description**: Ensure the site meets WCAG AA standards. This involves semantic HTML, ARIA labels, keyboard navigation, and color contrast.

## Key Insights
- **Focus Rings**: Often removed by resets. Must be restored (customized).
- **Screen Readers**: Interactive elements (Icons) need `aria-label`.

## Requirements
1.  **Keyboard Nav**: All interactive elements reachable and usable via Tab/Enter/Space.
2.  **Visual Focus**: Clear focus indicator (`outline-primary`).
3.  **Screen Readers**: Images have `alt`, Icon Buttons have `aria-label`.
4.  **Contrast**: Text meets 4.5:1 ratio.

## Architecture
- **Audit Tool**: `eslint-plugin-jsx-a11y` and browser DevTools.

## Related Code Files
- Audit all components in `src/components/`
- Modify `src/app/globals.css` (global focus style)

## Implementation Steps
1.  **Global Focus**: Add a default `:focus-visible` style in `globals.css` using the primary color.
2.  **Component Audit**: Go through Buttons, Inputs, Cards. Ensure `aria-label` is present where text is missing.
3.  **Semantic HTML**: Ensure Headings (`h1`-`h6`) are hierarchical. Use `<main>`, `<nav>`, `<footer>`, `<aside>` correctly.
4.  **Skip Link**: Add a "Skip to Content" link for keyboard users.
5.  **Motion**: Respect `prefers-reduced-motion` media query for animations.

## Todo List
- [ ] Implement global focus ring
- [ ] Add "Skip to Content" link
- [ ] Audit and fix `aria-label` on Icon Buttons
- [ ] Check Heading hierarchy
- [ ] Verify contrast ratios (Light & Dark)

## Success Criteria
- [ ] Zero `axe-core` violations in DevTools.
- [ ] Full keyboard navigability.

## Risk Assessment
- **Risk**: Custom components (like Filters) being inaccessible.
  - **Mitigation**: Use Headless UI or Radix primitives if custom logic is too complex to build accessibly from scratch.

## Next Steps
- Phase 7: Performance Optimization.
