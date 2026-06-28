# Next.js 16+ Performance Optimization Report for 84tea

**Date:** 260205
**Target:** Lighthouse 90+ | MD3 Compliance | <3s Load Time (4G)

## 1. Next.js 16 App Router & Server Components
- **React Server Components (RSC):** Move all data fetching and heavy logic to Server Components. Client Components should be leaf nodes only (interactive UI).
- **Streaming & Suspense:** Wrap independent data-fetching components in `<Suspense>` boundaries. This improves TTFB and FCP by showing shell immediately.
- **React Compiler:** Enabled in `next.config.ts` (`reactCompiler: true`). Auto-memoization reduces re-renders without manual `useMemo`.
- **Static vs Dynamic:** Maximize Static Rendering (default). Use `generateStaticParams` for dynamic routes (products/blogs) to pre-render at build time.

## 2. Image Optimization Strategy (4K Assets)
- **Component:** Use `next/image` strictly.
- **Formats:** Enable AVIF (smaller/better than WebP) in `next.config.ts`.
- **4K Handling:**
  - Define `deviceSizes` in config to generate smaller variants (640, 750, ..., 3840).
  - Use `sizes` prop explicitly (e.g., `(max-width: 768px) 100vw, 50vw`) to prevent downloading 4K on mobile.
  - Set `quality={80}` (default 75 is often fine, test visual fidelity).
- **LCP Optimization:** Add `priority` prop to the hero image (LCP element). This preloads the image.

## 3. Font Optimization (`next/font` vs `@fontsource`)
- **Recommendation:** Use **`next/font`** (Google) instead of `@fontsource`.
  - **Why:** `next/font` automatically optimizes font files, subsets (removes unused glyphs), and eliminates layout shift (CLS) by using size-adjust. It hosts files locally at build time.
  - **Implementation:**
    ```typescript
    import { Inter, Playfair_Display } from 'next/font/google'
    const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
    ```
- **Performance:** Zero layout shift (CLS = 0) is easier to achieve with `next/font`.

## 4. Bundle & CSS Optimization (Tailwind v4)
- **Tailwind v4:** You are using v4 (`@tailwindcss/postcss`). It has a Rust-based engine, generating smaller CSS bundles automatically. No manual purge configuration needed.
- **Code Splitting:**
  - Use `next/dynamic` for heavy client components below the fold (e.g., Maps, complex charts).
  - Split large libraries (like 3D viewers) into separate chunks.
- **Tree Shaking:** Ensure imports are specific (e.g., `import { Button } from 'lib'` instead of `import * as lib`).

## 5. Dark Mode & MD3
- **Flicker Prevention:** Use `next-themes` provider.
- **Layout Shift:** Add `suppressHydrationWarning` to the `<html>` tag to prevent React hydration mismatch errors with theme attributes.
- **MD3 Tokens:** Map Tailwind v4 CSS variables to MD3 tokens in global CSS for zero-runtime cost.

## 6. Lighthouse & Metrics Checklist
- **LCP (Largest Contentful Paint) < 2.5s:** Preload Hero images, minimize main thread blocking.
- **CLS (Cumulative Layout Shift) < 0.1:** Explicit dimensions on images/videos, `next/font`.
- **INP (Interaction to Next Paint) < 200ms:** React Compiler helps here. Avoid long tasks on main thread.
- **Config:**
  ```typescript
  // next.config.ts
  const nextConfig = {
    images: { formats: ['image/avif', 'image/webp'] },
    experimental: { optimizePackageImports: ['lucide-react', 'lodash'] } // Auto-tree-shake
  }
  ```

## 7. Performance Monitoring
- **Vercel Analytics:** Zero-config real-world user metrics (RUM).
- **Bundle Analyzer:** Use `@next/bundle-analyzer` to spot accidental large dependencies.

**Unresolved Questions:**
- Do we have specific 3D assets for the "Tea Culture" experience that need WebGL optimization?
- Are we using a CMS for tea products, or hardcoded JSON? (Impacts `generateStaticParams`).
