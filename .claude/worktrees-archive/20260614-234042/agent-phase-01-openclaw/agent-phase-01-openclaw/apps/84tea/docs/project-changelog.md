# Project Changelog

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
