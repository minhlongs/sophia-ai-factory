# Project Changelog

## [1.0.0] - 2026-02-06

### Added
- **MD3 Redesign**: Complete overhaul of the design system to fully adhere to Material Design 3 standards (100% compliance).
- **Navigation System**: Implemented Top App Bar with scroll behavior, Navigation Drawer for mobile, Bottom Navigation, and Tabs.
- **Dark Mode**: Added full dark mode support with `next-themes` and MD3 dark color tokens.
- **Accessibility**: Achieved WCAG 2.1 AA compliance with focus rings, skip links, ARIA labels, and reduced motion support.
- **Performance**: Optimized images (AVIF/WebP), fonts (preconnect), and metadata for <3s load times.
- **SEO**: Added comprehensive SEO metadata, sitemap.xml, robots.txt, and OpenGraph tags.
- **Components**: Added `FilterChips`, `Snackbar`, `Dialog`, `Progress` indicators, and `ThemeToggle`.

### Changed
- **Typography**: Refined type scale to strictly match MD3 specs (Display/Headline/Title/Body/Label).
- **Colors**: Updated color palette to use CSS variables for dynamic Imperial Green & Gold Leaf theme switching.
- **Layout**: Migrated all pages to use the new `MainLayout` with responsive navigation patterns.
- **Build**: Upgraded to Next.js 16.1.6 with Turbopack for faster builds (4.1s).

## [0.1.0] - 2026-02-05

### Added
- **Project Scaffolding**: Initialized Next.js 15 application with TypeScript and Tailwind CSS.
- **Design System**: Implemented Material Design 3 (MD3) theme with "Imperial Green" and "Gold Leaf" brand colors.
- **Documentation**: Added PDR, Architecture, Roadmap, Codebase Summary, and Design Guidelines in `docs/`.
- **Layouts**: Created responsive Root Layout, Header with Navigation Drawer, and Footer.
- **Home Page**: Implemented Landing Page with Hero, Story, Featured Products, and Benefits sections.
- **Franchise Portal**: Created Franchise landing page (`/franchise`) with model showcase and application form.
- **Product System**: Added static product data, Product Listing, and Detail pages.
- **Cart System**: Implemented Shopping Cart using React Context, LocalStorage persistence, and UI Drawer.
- **Checkout**: Added Checkout page and Order Success confirmation page.
- **UI Components**: Built atomic MD3 components:
  - `Button` (Filled, Outlined, Text)
  - `Card` (Elevated, Filled)
  - `Input`, `Select`, `Textarea`
  - `Typography` (Playfair Display / Inter)

### Changed
- **Linting**: Fixed all ESLint errors including empty object types, unescaped entities, and React Hook dependencies.
- **Performance**: Optimized font loading with `next/font/google` and `display=swap`.

### Fixed
- **React Hooks**: Resolved `react-hooks/set-state-in-effect` warnings in CartContext and CartDrawer by deferring state updates.
