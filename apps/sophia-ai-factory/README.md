# Sophia AI Video Factory - Enterprise Edition

Turn content into empire. The ultimate AI video creation workflow with automated affiliate discovery, ROI calculator, and 3-tier pricing system.

## 🚀 Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **React**: 19 with React Compiler
- **TypeScript**: Strict mode enabled
- **Styling**: Tailwind CSS 4 + CSS Variables
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Build Tool**: Turbopack
- **Deployment**: Static Export (Vercel, Cloudflare Pages, etc.)

## ✨ Features

### Landing Page
- **Hero Section**: Gradient glows, animated stats, call-to-action
- **Workflow**: 4-step process visualization
- **Features Grid**: Bento grid layout with glassmorphism
- **Pricing**: 3-tier system (Basic $500, Premium $1,200, Enterprise $3,500)
- **ROI Calculator**: Interactive sliders with real-time revenue calculation
- **FAQ**: Accordion with 8 common questions
- **Navbar**: Responsive navigation with mobile menu

### Affiliate Discovery Engine
- **Tier-Gated Access**: Basic users see 3 preview programs
- **20 Curated Programs**: "Dự án Sạch" with high EPCs
- **Advanced Filtering**: Category and commission range filters
- **Search**: Fuzzy search across name, description, category
- **Sorting**: EPC and commission sorting

### Admin Dashboard
- **Basic Auth**: Middleware-based authentication
- **Dashboard**: Stats overview, tier distribution, recent activity
- **Feature Flags**: Toggle switches for all features
- **Affiliates Table**: Full program listing with search
- **Settings**: Environment configuration

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm start
```

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```bash
# Admin Dashboard Authentication
ADMIN_USER=admin
ADMIN_PASS=sophia2024

# Mock Tier Override (BASIC | PREMIUM | ENTERPRISE)
NEXT_PUBLIC_MOCK_TIER=ENTERPRISE
```

### Feature Flags

Edit `src/config/flags.ts` to enable/disable features:

```typescript
export const FEATURE_FLAGS = {
  enable_affiliate_engine: { ... },
  enable_admin_dashboard: { ... },
  enable_roi_calculator: { ... },
  // etc.
};
```

### Tier Configuration

Edit `src/config/tiers.ts` to modify pricing and features:

```typescript
export const TIER_CONFIGS = {
  BASIC: { price: 500, features: [...] },
  PREMIUM: { price: 1200, features: [...] },
  ENTERPRISE: { price: 3500, features: [...] },
};
```

## 📁 Project Structure

```
src/
├── app/
│   ├── (admin)/admin/          # Admin dashboard (separate layout)
│   │   ├── page.tsx           # Dashboard home
│   │   ├── features/          # Feature flags management
│   │   ├── affiliates/        # Affiliate table
│   │   └── settings/          # Settings page
│   ├── affiliate-discovery/   # Public affiliate discovery page
│   ├── components/
│   │   ├── ui/               # Reusable UI components (Button, Card, Badge)
│   │   ├── sections/         # Landing page sections
│   │   ├── affiliate/        # Affiliate-specific components
│   │   ├── admin/            # Admin-specific components
│   │   └── layout/           # Layout components (Navbar, Footer)
│   ├── api/auth/             # Basic Auth endpoint
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Landing page
│   └── globals.css           # Global styles (Deep Space theme)
├── config/
│   ├── tiers.ts              # Tier configurations
│   └── flags.ts              # Feature flag definitions
├── lib/
│   ├── utils.ts              # Utility functions (cn)
│   ├── auth.ts               # Mock authentication
│   ├── features.ts           # Feature access control
│   └── affiliates.ts         # Affiliate data access
├── data/
│   └── affiliate-programs.json  # 20 affiliate programs
├── types/
│   └── index.ts              # TypeScript definitions
└── middleware.ts             # Basic Auth middleware
```

## 🎨 Design System

### Colors (CSS Variables)

```css
--background: #020817        /* Deep space background */
--neon-cyan: #00f0ff        /* Primary accent */
--neon-purple: #7000ff      /* Secondary accent */
--glass-bg: rgba(255, 255, 255, 0.05)
--glass-border: rgba(255, 255, 255, 0.1)
```

### Components

- **Button**: Primary, Secondary, Ghost, Glow variants
- **Card**: Glassmorphic cards with hover effects
- **Badge**: Tier-based variants (basic, premium, enterprise)
- **Container**: Responsive max-width containers

## 🔒 Authentication

Admin dashboard uses Basic Auth via middleware:

- **Username**: `admin` (configurable via ADMIN_USER)
- **Password**: `sophia2024` (configurable via ADMIN_PASS)
- **Protected Routes**: `/admin/*`

Browser caches credentials - logout clears and redirects to `/`.

## 🚢 Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Static Export (Cloudflare Pages, Netlify, etc.)

```bash
# Build static site
npm run build

# Output directory: out/
# Upload to your hosting provider
```

## 📊 Build Verification

All checks passing:

```bash
# TypeScript check
npx tsc --noEmit          # ✅ 0 errors

# Linting
npm run lint              # ✅ 0 errors, 0 warnings

# Production build
npm run build             # ✅ 9 routes generated
```

## 🎯 Routes

### Public Routes
- `/` - Landing page
- `/affiliate-discovery` - Affiliate programs (tier-gated)

### Admin Routes (Protected)
- `/admin` - Dashboard
- `/admin/features` - Feature flags
- `/admin/affiliates` - Affiliate table
- `/admin/settings` - Settings

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (sm)
- **Tablet**: 768px - 1024px (md)
- **Desktop**: > 1024px (lg)

All grids stack on mobile, navigation uses hamburger menu.

## 🔗 Links

- **Documentation**: `HANDOFF.md` (deployment guide, architecture)
- **License**: MIT
- **Author**: Sophia AI Factory

---

Built with ❤️ by Mekong CLI
