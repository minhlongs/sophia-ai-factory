# Phase 7: Performance Optimization

## Context Links
- [Next.js Performance Report](../reports/researcher-nextjs-performance-260205-2120.md)
- [Web Vitals](https://web.dev/vitals/)

## Overview
- **Priority**: P2
- **Status**: Pending
- **Description**: Optimize assets and code to achieve <3s load time on 4G networks and Lighthouse 90+.

## Key Insights
- **Images**: Largest contributor to weight. Use AVIF and correct sizing.
- **Fonts**: `next/font` handles most optimization.
- **CLS**: Ensure dimensions are set for all media.

## Requirements
1.  **LCP < 2.5s**: Optimize Hero image.
2.  **CLS < 0.1**: Layout stability.
3.  **TBT < 200ms**: Minimize JS execution.

## Architecture
- **Next.js Config**: Enable image optimization features.
- **Component Level**: Use `<Image>` component properties correctly.

## Related Code Files
- Modify: `next.config.ts`
- Modify: `src/app/page.tsx` (Hero image priority)

## Implementation Steps
1.  **Image Optimization**:
    - Update `next.config.ts` to allow AVIF.
    - Audit all `<Image>` tags. Add `sizes` prop to responsive images.
    - Add `priority` to LCP images (Hero).
2.  **Font Loading**: Verify `next/font` variable injection is working and fonts are preloaded.
3.  **Bundle Analysis**: Run `@next/bundle-analyzer` to check for large dependencies.
4.  **Lazy Loading**: Use `next/dynamic` for heavy components below the fold (e.g., if there's a map on the Franchise page).

## Todo List
- [ ] Configure `next.config.ts` for AVIF
- [ ] Audit `<Image>` usage (sizes, priority)
- [ ] Verify Font loading strategy
- [ ] Analyze Bundle size

## Success Criteria
- [ ] Lighthouse Performance Score > 90.
- [ ] Hero image loads instantly.

## Risk Assessment
- **Risk**: 4K images slowing down mobile.
  - **Mitigation**: Strictly enforce `sizes` prop to ensure mobile devices download smaller variants.

## Next Steps
- Phase 8: Testing & Validation.
