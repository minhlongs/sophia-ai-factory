# Codebase Summary

## 1. Directory Structure

### `src/app` (App Router)
Main application routes and layouts.
- `layout.tsx`: Root layout with MD3 providers, fonts (Playfair/Inter), and CartProvider.
- `page.tsx`: Landing page composition.
- `globals.css`: Tailwind directives and CSS variables for MD3 theme.
- **Routes:**
  - `/products`: Product listing and detail pages (`[slug]`).
  - `/franchise`: Franchise info (`page.tsx`) and application form (`apply/page.tsx`).
  - `/checkout`: Checkout process (`page.tsx`) and success page (`success/page.tsx`).
  - `/about`, `/contact`, `/shipping`, `/refund`, `/privacy`, `/terms`: Static information pages.
  - `/ops`, `/training`: Operational and training resources (placeholders).

### `src/components` (UI Library)
- **`ui/`**: Atomic MD3 components.
  - `button.tsx`: Material Design buttons (Filled, Outlined, Text).
  - `card.tsx`: Surface containers with elevation.
  - `typography.tsx`: Text components mapping to MD3 type scale.
  - `input.tsx`, `select.tsx`, `textarea.tsx`: Form controls.
  - `logo.tsx`: Brand logo component.
- **`layout/`**: Structural components.
  - `header-navigation.tsx`: Responsive top bar and drawer trigger.
  - `footer-section.tsx`: Site footer.
- **`home/`**: Landing page sections.
  - `hero-section.tsx`: Main visual entry point.
  - `story-section.tsx`: Brand narrative.
  - `featured-products.tsx`: Highlighted items.
  - `benefits-section.tsx`, `process-section.tsx`: Informational grids.
- **`products/`**: E-commerce components.
  - `product-card.tsx`: Individual product display.
  - `product-filter.tsx`: Category filtering.
  - `product-gallery.tsx`: Image carousel.
  - `product-actions.tsx`: Add to cart logic.
- **`franchise/`**: Franchise portal components.
  - `franchise-hero.tsx`, `franchise-models.tsx`, `franchise-benefits.tsx`.
  - `franchise-form.tsx`: Application submission form.
- **`cart/`**: Shopping cart features.
  - `cart-drawer.tsx`: Slide-out cart UI.
  - `cart-button.tsx`: Floating trigger.

### `src/lib` (Utilities & Logic)
- `cart-context.tsx`: React Context for cart state management (localStorage persistence).
- `products-data.ts` / `data/products.ts`: Mock data and types for products.
- `utils.ts`: Helper functions (e.g., `cn` for class merging).

### `src/data` (Static Content)
- `brand.json`: Brand constants (name, tagline, contact info).
- `products.json`: Raw product data.

## 2. Key Technologies
- **Next.js 15**: App Router framework.
- **Tailwind CSS**: Utility-first styling.
- **Material Design 3**: Design system methodology.
- **TypeScript**: Static typing.
- **Lucide React**: Icons (supplementary).
- **Material Symbols**: Main icon set (via Google Fonts).

## 3. Configuration Files
- `tailwind.config.ts`: Custom theme extension for MD3 colors/fonts.
- `next.config.ts`: Next.js configuration.
- `tsconfig.json`: TypeScript compiler options.
- `eslint.config.mjs`: Linting rules.
