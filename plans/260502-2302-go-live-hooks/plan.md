# Plan — Go-Live Admin Hooks B/E/F/H

**Date:** 2026-05-02  
**Status:** in_progress

## Context

4 manual go-live actions from `plans/reports/user-runbook-260502-0756-go-live.md` converted to admin UI hooks so CEO never needs a terminal.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Hook F — HeyGen auto-register webhook | complete |
| 2 | Hook E — Synthetic IPN smoke test | complete |
| 3 | Hook B — Supabase migration console | complete |
| 4 | Hook H — Deploy status page | complete |
| 5 | D1 mig 0061 + manifest script | complete |
| 6 | Sidebar nav + i18n | complete |
| 7 | Build verify | complete |

## Key Files

- `src/lib/heygen/webhook-registrar.ts` — HeyGen API
- `src/app/api/setup-wizard/heygen/auto-register/route.ts` — F hook API
- `src/app/api/admin/synthetic-ipn/route.ts` — E hook API
- `src/app/api/admin/migrations/[filename]/mark-applied/route.ts` — B hook API
- `src/lib/admin/supabase-migrations-manifest.ts` — build-time manifest
- `src/app/[locale]/dashboard/admin/heygen-webhooks/page.tsx` — F UI
- `src/app/[locale]/dashboard/admin/e2e-smoke/page.tsx` — E UI
- `src/app/[locale]/dashboard/admin/migrations/page.tsx` — B UI
- `src/app/[locale]/dashboard/admin/deploy-status/page.tsx` — H UI
- `migrations/0061-supabase-migrations-applied.sql` — D1 table

## Constraints

- No SQL execution from Worker (copy+dashboard pattern for B)
- E uses exact HMAC-SHA512 signing from verifyIpnSignature
- F fail-soft — never throws out of save-credentials
- H honest about GH Actions disabled limitation
