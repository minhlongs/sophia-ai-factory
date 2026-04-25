# Contributing to Sophia AI Factory

This document is for developers who want to modify the source code. If you are a user, please see `HANDOFF.md`.

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: React Server Components + Client Hooks

## Project Structure
- `src/app`: App Router pages
- `src/lib`: Utility functions and validators
- `src/components`: Reusable UI components
- `scripts`: CLI setup tools

## Setup for Development
1. Run `npm install`
2. Run `npm run dev`
3. Edit `src/app/page.tsx` for the dashboard.

## Code Standards
- Use `kebab-case` for filenames.
- Keep components under 200 lines.
- Use `zod` for validation.

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
- Security fixes: Removed NEXT_PUBLIC_JWT_SECRET=REDACTED from committed code
- Logic fixes: Replaced `|| true` with `?? true` for proper null coalescing
- Tests: All 1,321 tests still pass | 0 circular imports detected
- See `/plans/260425-1200-tiet-tieu-no-ky-thuat-phase-40-48/` for detailed phase summaries
