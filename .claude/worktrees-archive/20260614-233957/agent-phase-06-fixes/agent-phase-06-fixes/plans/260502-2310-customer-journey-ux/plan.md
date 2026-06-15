# Customer Journey UX Polish — Plan

**Status:** In Progress
**Branch:** main
**App dir:** apps/sophia-ai-factory/

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 01 | Migration 0062 (onboarding_completed_at) | pending |
| 02 | Dashboard home — hero greeting + empty/returning states | pending |
| 03 | Account/billing page — 3 tabs + API routes | pending |
| 04 | Empty states sweep — sops/orders/credits | pending |
| 05 | Pricing polish — tier badge, comparison table, FAQ, talk-to-sales | pending |
| 06 | Onboarding tour modal | pending |
| 07 | i18n keys (en + vi) | pending |
| 08 | Build verification | pending |

## Key Constraints
- Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER
- Auth: getCurrentUser() from @/lib/better-auth-session
- DB: createServerClient() (sync, no await)
- Zero :any, zero console.log
- Files ≤ 200 LOC
- Glass: bg-white/80 dark:bg-slate-900/60 backdrop-blur-md
- Icons: Lucide-react only, w-4 h-4 or w-5 h-5
- DO NOT push or deploy

## File Ownership
- migrations/0062-onboarding-completed-at.sql (new)
- src/app/[locale]/dashboard/page.tsx (modify)
- src/app/[locale]/dashboard/components/dashboard-hero-greeting.tsx (new)
- src/app/[locale]/dashboard/components/dashboard-setup-steps.tsx (new)
- src/app/[locale]/dashboard/components/dashboard-returning-user.tsx (new)
- src/app/[locale]/dashboard/account/page.tsx (new)
- src/app/api/user/profile/route.ts (new)
- src/app/api/user/billing-history/route.ts (new)
- src/app/api/user/cancel-subscription/route.ts (new)
- src/app/[locale]/dashboard/components/onboarding-tour-modal.tsx (new)
- src/components/pricing/pricing-comparison-table.tsx (new)
- src/components/pricing/pricing-faq.tsx (new)
- src/app/[locale]/pricing/page.tsx (modify)
- messages/en.json (modify)
- messages/vi.json (modify)
