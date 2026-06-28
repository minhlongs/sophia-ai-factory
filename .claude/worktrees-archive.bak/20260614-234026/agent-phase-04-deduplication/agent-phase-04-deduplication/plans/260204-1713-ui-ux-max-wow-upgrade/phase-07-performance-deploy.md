# Phase 7: Optimization & Launch

## Context
- **Plan:** [Overview](./plan.md)
- **Target App:** `apps/sophia-proposal`

## Overview
Final polish before launch. Heavy visuals (glass, animations) can kill performance. We must ensure 90+ Lighthouse scores.

## Key Insights
- **Next.js Image:** Use strict sizing and formats (WebP/AVIF).
- **Lazy Motion:** Framer Motion's `LazyMotion` feature reduces bundle size.
- **Font Optimization:** Ensure subsetting is correct.

## Requirements
1.  **Lighthouse Score:** >90 Performance, 100 SEO/Accessibility.
2.  **Metadata:** Complete OpenGraph tags and SEO descriptions.
3.  **Bundle Size:** Keep initial JS under control.

## Implementation Steps

1.  **Framer Motion Optimization**
    - Replace standard `import { motion }` with `LazyMotion` pattern where possible for heavy features.
    - Use `will-change: transform` on animated elements.

2.  **Image Optimization**
    - Verify all `<img>` tags are `next/image`.
    - Add `blurDataURL` for hero images.

3.  **Final Lint & Build**
    - Run `npm run lint`.
    - Run `npm run build` to check for type errors.

4.  **Accessibility Check**
    - Verify contrast ratios (especially grey text on dark bg).
    - Ensure screen reader navigation works (headings hierarchy).

## Todo List
- [x] Run Lighthouse audit.
- [x] Optimize images.
- [x] Verify metadata title/description.
- [x] Final production build test.

## Success Criteria
- [x] Build passes with no errors.
- [x] Site loads fast (LCP < 2.5s).
- [x] Visuals remain "Wow" without lagging.

## Next Steps
- **LAUNCH** 🚀
