# Phase 4: Page Redesign

## Context Links
- [Current Page Structure](../../src/app/)
- [Brand Guidelines](../../CLAUDE.md)

## Overview
- **Priority**: P2
- **Status**: Pending
- **Description**: Apply the MD3 foundation and components to the actual content pages: Homepage, Product Catalog, Product Details, and Franchise Info.

## Key Insights
- **Homepage**: Needs a strong Hero section (Display Large typography), Featured Products (Cards), and Brand Story (Typography).
- **Products**: Grid layout with MD3 cards. Filter drawer/sidebar.
- **Franchise**: Informational layout with clear typography hierarchy and "Call to Action" FABs or Buttons.

## Requirements
1.  **Homepage**: Hero banner, Best Sellers carousel, "Why 84tea" section.
2.  **Product List**: Responsive grid of Product Cards. Filter UI (Chips or Drawer).
3.  **Product Detail**: Gallery, Price (Headline), Add to Cart (FAB/Filled Button), Description (Body).
4.  **Franchise**: Long-form content using MD3 typography scale. Form for inquiry.

## Architecture
- **Page Components**: Refactor existing `page.tsx` files to use new UI components.
- **Layouts**: Use CSS Grid/Flexbox with Tailwind for responsive layouts.

## Related Code Files
- Modify: `src/app/page.tsx` (Home)
- Modify: `src/app/products/page.tsx` (List)
- Modify: `src/app/products/[slug]/page.tsx` (Detail)
- Modify: `src/app/franchise/page.tsx`

## Implementation Steps
1.  **Homepage Redesign**:
    - Rebuild Hero using `Display Large` font and Imperial Green/Gold palette.
    - Implement "Featured" section using `Elevated Card` carousel.
2.  **Product List**:
    - Create responsive grid (`grid-cols-1 md:grid-cols-3`).
    - Implement Filter Chips (MD3 Filter Chips).
3.  **Product Detail**:
    - Layout: Image left, Info right (Desktop). Stacked (Mobile).
    - Sticky "Add to Cart" bottom bar for mobile.
4.  **Franchise Page**:
    - Use `Outlined Card` for comparison tables (Kiosk vs Lounge).
    - Implement Inquiry Form using new `Input` components.

## Todo List
- [ ] Redesign Homepage Hero & Sections
- [ ] Redesign Product List & Filters
- [ ] Redesign Product Detail Page
- [ ] Redesign Franchise Page & Form
- [ ] Update Cart/Checkout UI (basic alignment)

## Success Criteria
- [ ] Pages match the "Ivory Silk" and "Imperial Green" aesthetic.
- [ ] Typography hierarchy is evident (Display > Headline > Body).
- [ ] Responsive behavior works across all breakpoints.

## Risk Assessment
- **Risk**: Content overflow on small screens.
  - **Mitigation**: Test rigorously on `compact` breakpoint (320px-375px width).

## Next Steps
- Phase 5: Dark Mode.
