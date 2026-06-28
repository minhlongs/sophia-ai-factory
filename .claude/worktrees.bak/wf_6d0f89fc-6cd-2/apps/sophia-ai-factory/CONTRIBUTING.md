# Contributing to Sophia AI Factory

This document is for developers who want to modify the source code. If you are a user, please see `HANDOFF.md`.

> **📖 Canonical Developer SOPs:** [`docs/dev-sops.md`](./docs/dev-sops.md) — 10 SOPs covering setup, testing, routes, layers, deploy, git, debug, structure, CI gates, security.

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: React Server Components + Client Hooks
- **Deploy**: Cloudflare Workers via CF-direct (`npm run deploy:full`)
- **DB**: Cloudflare D1 (`createServerClient()` from `@/lib/db/client`, sync)
- **Auth**: Better Auth (`getCurrentUser()` from `@/lib/better-auth-session`)
- **Payments**: NOWPayments (primary), PayOS (Vietnam backup). Polar.sh + PayPal BANNED.

## Project Structure (4-Layer Architecture)

```
src/
├── seed/    # Foundational primitives (types, config, db, auth, logger)
├── tree/    # Domain reusable (byok, telegram, handover, audit)
├── forest/  # Infra orchestrators (inngest, raas, quota, metering)
├── land/    # Business workflows (billing, payouts, affiliates, promo)
├── app/     # Next.js App Router (routes + api/)
└── lib/     # Canonical aliases (better-auth-session, db/client) + legacy
```

Import direction: `seed ← tree ← forest ← land`. See [`.claude/rules/sophia-layer-architecture.md`](./.claude/rules/sophia-layer-architecture.md).

## Setup for Development
1. `npm install`
2. `cp .dev.vars.example .dev.vars` (fill secrets)
3. `npx wrangler login`
4. `npm run dev` → http://localhost:3000
5. `npm test -- --run` to verify

Full setup: [SOP 1 in `docs/dev-sops.md`](./docs/dev-sops.md#sop-1-environment-setup).

## Code Standards
- `kebab-case` filenames, < 200 lines per file
- Zero `:any`, zero `console.log` in prod code
- Zod validate ALL API inputs
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase)
- **Banned imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`

Full standards: [`docs/code-standards.md`](./docs/code-standards.md) + [SOP 10 in dev-sops](./docs/dev-sops.md#sop-10-security-checklist).

## Environment Variables
See `.env.example` (if available) or the Setup Wizard's output in `.env.local`.

## Recent Improvements (April 2026)

### Tech Debt Elimination (Triệt Tiêu Nợ Kỹ Thuật) — Phases 40–48
- Modularized 9 critical files (4,174 lines) into 36 focused sub-modules
- Files refactored:
  - `src/app/api/admin/usage/reconciliation/route.ts` (731L → 5 modules)
  - `src/app/api/internal/usage/query/route.ts` (533L → 3 modules)
  - `src/middleware/tenant-isolation.ts` (517L → 5 modules)
  - `src/app/api/cron/workflow-stepper/route.ts` (485L → 4 modules)
  - `src/lib/usage-metering/kv-metering-log-sync.ts` (479L → 4 modules)
  - `src/lib/auth/enriched-jwt.ts` (465L → 4 modules)
  - `src/lib/usage-metering/realtime-tracker.ts` (461L → 4 modules)
  - `src/lib/security/api-key-validator.ts` (459L → 4 modules)
  - `src/lib/usage-export/export-service.ts` (445L → 3 modules)
- Security fixes: Removed NEXT_PUBLIC_JWT_SECRET from committed code
- Logic fixes: Replaced `|| true` with `?? true` for proper null coalescing
- Tests: All 1,321 tests still pass | 0 circular imports detected
- See `/plans/260425-1200-tiet-tieu-no-ky-thuat-phase-40-48/` for detailed phase summaries
