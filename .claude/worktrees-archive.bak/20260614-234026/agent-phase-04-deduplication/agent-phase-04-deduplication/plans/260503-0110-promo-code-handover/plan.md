# Promo Code + Free Trial Handover System

**Status:** In Progress  
**Created:** 2026-05-03

## Phases

| Phase | File | Status |
|-------|------|--------|
| A | Migrations 0066+0067 | [ ] |
| B | Promo engine (types, repo, validator, applier) | [ ] |
| C | Customer UI (pricing page, free trial flow, checkout) | [ ] |
| D | Admin promo manager UI | [ ] |
| E | API routes | [ ] |
| F | Seed verification | [ ] |
| G | Email update (promo welcome variant) | [ ] |
| H | Payment success promo handling | [ ] |
| I | Dashboard free trial banner | [ ] |
| J | Cron expire trials | [ ] |

## Key Files
- `migrations/0066-promo-codes.sql` — schema
- `migrations/0067-seed-promo-codes.sql` — seeds
- `src/lib/promo/` — engine
- `src/app/api/promo/` — API routes
- `src/app/api/admin/promo-codes/` — admin API
- `src/app/[locale]/(admin)/admin/promo-codes/` — admin UI
- `src/app/[locale]/pricing/page.tsx` — pricing with promo input
- `src/app/[locale]/dashboard/components/trial-banner.tsx` — trial banner

## Dependencies
- Reuses `triggerAutoHandover()` from `lib/handover/auto-handover.ts`
- D1 via `getD1Raw()` from `lib/db/client`
- Auth via `getCurrentUser()` from `lib/better-auth-session`
