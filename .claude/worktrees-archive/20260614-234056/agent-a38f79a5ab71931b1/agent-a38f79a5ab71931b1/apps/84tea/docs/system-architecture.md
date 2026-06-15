# System Architecture

## 1. High-Level Overview
The 84tea platform is built as a monolithic Next.js application (for MVP) designed for edge deployment. It prioritizes static generation (SSG) for content-heavy pages and client-side interactivity for the cart/checkout flow.

```mermaid
graph TD
    User[User] --> CDN[Edge Network (Vercel)]
    CDN --> NextJS[Next.js App Server]

    subgraph Frontend
        NextJS --> Pages[Pages / Layouts]
        NextJS --> Components[MD3 Components]
        NextJS --> Context[Cart Context]
    end

    subgraph Data
        Pages --> StaticData[JSON Data (Products/Brand)]
        Context --> LocalStorage[Browser LocalStorage]
    end

    subgraph External
        NextJS --> Analytics[Vercel Analytics]
        NextJS --> EmailService[Email Service (Future)]
    end
```

## 2. Frontend Architecture
- **Framework:** Next.js 15 (App Router).
- **Rendering Strategy:**
  - **Static Site Generation (SSG):** Landing page, About, Franchise info, Product details (for SEO and performance).
  - **Client-Side Rendering (CSR):** Cart drawer, Checkout flow, Interactive filters (using `'use client'` directives).
- **State Management:** React Context API (`CartContext`) for shopping cart state, persisted to `localStorage`.

## 3. Styling Architecture
- **Engine:** Tailwind CSS.
- **Design System:** Material Design 3 (MD3).
- **Implementation:**
  - **CSS Variables:** Defined in `globals.css` (e.g., `--md-sys-color-primary`).
  - **Tailwind Config:** Maps utility classes to CSS variables (e.g., `bg-primary` -> `var(--md-sys-color-primary)`).
  - **Theming:** Supports Light/Dark mode via CSS variable switching (currently optimized for Light mode Brand identity).

## 4. Directory Structure
- `src/app`: Routes and Layouts.
- `src/components`: Reusable UI components.
  - `ui/`: Primitives (Button, Input, Typography).
  - `layout/`: Global structural components (Header, Footer).
  - `features/`: Domain-specific components (Cart, Franchise, Products).
- `src/lib`: Utilities, Context, and Hooks.
- `src/data`: Static JSON content.

## 5. Performance Optimization
- **Fonts:** `next/font/google` for self-hosted, zero-layout-shift fonts.
- **Images:** `next/image` for automatic optimization (WebP/AVIF) and lazy loading.
- **Code Splitting:** Automatic by Next.js App Router.
- **Icons:** Material Symbols font (Google Fonts) with `display=swap`.

## 6. Security
- **Input Validation:** TypeScript interfaces for all data structures.
- **Sanitization:** React automatically escapes content (JSX) to prevent XSS.
- **Headers:** Standard security headers (HSTS, X-Frame-Options) via `next.config.ts` (to be configured).
