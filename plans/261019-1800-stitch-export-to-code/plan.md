# Stitch Screens Export to React/Next.js

> Export 12 Stitch-designed screens to production-ready React/Next.js components for Sophia AI Factory

## Meta

| Field | Value |
|-------|-------|
| Date | 2025-06-20 |
| Task | Export Stitch screens to code for integration |
| Status | in_progress |
| Reference | `/Users/macbook/opc-platform/stitch-*.html` |

## Architecture Decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Data layer | No DB changes (UI components only) | Screens are presentation layer; data fetching uses existing APIs |
| Component location | `src/components/stitch/` | Isolated from core components; easy to remove/replace |
| Styling approach | Extend Tailwind with CSS variables | Matches Sophia's existing theme system (next-themes) |
| Icons | Lucide React (existing) | Consistent with codebase; Material Symbols replaced |
| Design tokens | Convert MD3 → Sophia theme | Maps Stitch colors to Sophia's CSS variable system |
| Auth gate | Use existing auth session | Integrates with `@/seed/auth/better-auth-session` |
| i18n | Add VN/EN keys to messages | Follows Sophia bilingual requirement |

## Screens to Export

1. **Dashboard** (`stitch-dashboard.html`) - Main workspace overview
2. **Auth Login** (`stitch-auth-login.html`) - Login page
3. **Auth Register** (`stitch-auth-register.html`) - Registration page
4. **Pricing** (`stitch-pricing.html`) - Tier selection page
5. **Products** (`stitch-products.html`) - Product management
6. **Subscribers** (`stitch-subscribers.html`) - Subscriber management
7. **Payments** (`stitch-payments.html`) - Payment history/transactions
8. **Affiliates** (`stitch-affiliates.html`) - Affiliate management
9. **Settings** (`stitch-settings.html`) - Workspace settings
10. **Checkout** (`stitch-checkout.html`) - Payment checkout flow
11. **Webhook Config** (`stitch-webhook-config.html`) - Integration config
12. **Admin Panel** (`stitch-admin-panel.html`) - Admin dashboard
13. **Affiliate Portal** (`stitch-affiliate-portal.html`) - Affiliate partner view

## Component Breakdown

### Files to Create

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/components/stitch/design-tokens.ts` | Design system mapping (colors, spacing, typography) | 100 |
| `src/components/stitch/ui/` | Reusable UI primitives (Button, Card, Input, etc.) | 500 |
| `src/components/stitch/layouts/` | Layout components (Sidebar, Header, DashboardLayout) | 300 |
| `src/components/stitch/screens/` | Individual screen components (12 screens) | 2000 |
| `src/app/(auth)/login/page.tsx` | Login page route | 50 |
| `src/app/(auth)/register/page.tsx` | Register page route | 50 |
| `src/app/(app)/dashboard/page.tsx` | Dashboard page route | 50 |
| `src/app/(app)/pricing/page.tsx` | Pricing page route | 50 |
| ... (other screen routes) | | 300 |

### Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `tailwind.config.ts` | Add Stitch color palette as extensions | Minor |
| `src/app/layout.tsx` | May need font imports (Inter) | Minor |
| `messages/en.json` | Add i18n keys for Stitch screens | Medium |
| `messages/vi.json` | Add Vietnamese translations | Medium |

## Data Flow

```
User navigates → Next.js route → StitchScreen component
    → Uses stitch/ui primitives → Renders with Sophia theme
    → Data fetching: use existing API routes or Server Actions
```

## Implementation Steps

### Phase 1: Design System Foundation
1. Create `design-tokens.ts` mapping Stitch MD3 colors to CSS variables
2. Extend Tailwind config with Stitch-specific utilities
3. Create base UI components (Button, Card, Input, Badge, Avatar, etc.)

### Phase 2: Layout Components
1. Create Sidebar component with navigation
2. Create Header/TopAppBar component
3. Create DashboardLayout wrapper
4. Create AuthLayout for login/register pages

### Phase 3: Screen Components (parallelizable)
- Group 1: Auth screens (Login, Register)
- Group 2: Dashboard & Pricing
- Group 3: Management screens (Products, Subscribers, Payments, Affiliates)
- Group 4: Config screens (Settings, Checkout, Webhook, Admin, Affiliate Portal)

### Phase 4: Routes & Integration
1. Create Next.js pages for each screen
2. Set up navigation/routing
3. Add i18n keys (VN/EN)
4. Connect to existing APIs/auth

### Phase 5: Testing & Verification
1. Build verification (`npm run build`)
2. TypeScript check (`npm run type-check`)
3. Lint check (`npm run lint`)
4. Manual testing in dev server

## Security Considerations

- Auth screens use existing `better-auth` session handling
- No hardcoded API keys or secrets
- All data fetching uses existing Sophia API routes
- Protected routes use existing auth middleware
- Payment flows use NOWPayments IPN (existing integration)

## Design Token Mapping

Stitch MD3 → Sophia Tailwind:

```ts
{
  primary: 'var(--primary)',           // #3525cd → primary
  onPrimary: 'var(--primary-foreground)',
  primaryContainer: 'var(--primary-container)', // #4f46e5
  secondary: 'var(--secondary)',       // #544fc0
  surface: 'var(--background)',        // Light: #f8f9ff
  onSurface: 'var(--foreground)',      // #0b1c30
  surfaceContainer: 'var(--card)',     // Card backgrounds
  outline: 'var(--border)',            // Border colors
  error: 'var(--destructive)',         // Error states
}
```

## Next Steps

1. ✅ Create design tokens file
2. ⏳ Build UI primitives (Button, Card, Input, etc.)
3. ⏳ Create layout components
4. ⏳ Export 12 screen components
5. ⏳ Create routes and integrate
6. ⏳ Add i18n support
7. ⏳ Build and test
