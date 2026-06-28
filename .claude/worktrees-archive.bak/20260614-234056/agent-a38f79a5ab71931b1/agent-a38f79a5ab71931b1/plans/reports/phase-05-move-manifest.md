# Phase 05 — Move Manifest (Forest Layer)
Generated: 2026-05-03 | Total moved: 359 files (+ .gitkeep = 360 in forest)

## Summary

| Group | Count |
|-------|-------|
| src/forest/agents | 11 |
| src/forest/email (+ __tests__ + templates) | 12 |
| src/forest/api-keys | 1 |
| src/forest/outbox | 1 |
| src/forest/quota (+ __tests__) | 19 |
| src/forest/usage-metering (+ rollup/ + types/) | 38 |
| src/forest/missions (+ handlers/) | 22 |
| src/forest/raas (+ __tests__) | 12 |
| src/forest/inngest (+ functions/) | 16 |
| src/forest/raas-*.ts (loose lib root files) | 12 |
| src/forest/components (all subdirs) | 158 |
| src/forest/hooks (+ analytics/) | 8 |
| src/forest/middleware (rate-limit + tenant-isolation) | 13 |
| src/forest/worker (+ lib/ + middleware/) | 33 |

## Key Decisions
- `src/middleware.ts` (root) — STAYED per Next.js convention
- `src/lib/raas-*.ts` (loose files in lib root) → `src/forest/raas-*.ts`
- Inngest uses explicit import-based function registration (NOT file-path glob) — SAFE to move
- `src/lib/onboarding/` — does not exist, skip
- `lib/billing/email/*`, `lib/billing/*` — land layer, NOT moved

## Manual Fixes Applied (codemod couldn't handle)

### Relative imports in entry files
- `src/middleware.ts`: `./lib/usage-metering` → `@/forest/usage-metering`
- `src/middleware-api-handler.ts`: `./lib/raas-gate` → `@/forest/raas-gate`
- `src/middleware-api-handler.ts`: `./lib/usage-metering` → `@/forest/usage-metering`
- `src/middleware-api-handler.ts`: `./middleware/tenant-isolation` → `@/forest/middleware/tenant-isolation`
- `src/lib/core/index.ts`: `../inngest/client` → `@/forest/inngest/client`

### Barrel imports (no trailing slash, missed by codemod)
- `src/app/api/usage/mock/route.ts`: `@/lib/usage-metering` → `@/forest/usage-metering`
- `src/lib/heygen/heygen-client.ts`: `@/lib/usage-metering` → `@/forest/usage-metering`
- `src/lib/ai/text-to-speech-generator-elevenlabs.ts`: same
- `src/lib/ai/script-generator.ts`: same
- `src/forest/inngest/functions/index.ts`: `@/lib/quota/storage-tracker-cron` → `@/forest/quota/storage-tracker-cron`

### Relative redis imports in moved raas-*.ts files
- `src/forest/raas-service.ts`: `./redis` → `@/lib/redis`
- `src/forest/raas-service-types-and-constants.ts`: same
- `src/forest/raas-service.test.ts`: same
- `src/forest/raas-service-key-operations.ts`: same

### vi.mock() path fixes in test files
- `src/seed/auth/jwt-claims-enrichment.test.ts`: quota-checker
- `src/seed/auth/enriched-jwt.test.ts`: quota-checker
- `src/tree/handover/__tests__/auto-handover.test.ts`: outbox/email-outbox
- `src/tree/telegram/telegram-bot.test.ts`: inngest/client
- `src/tree/telegram/telegram-bot-campaign-handlers.test.ts`: inngest/client
- `src/app/actions/campaigns-tier-integration.test.ts`: inngest/client
- `src/lib/openclaw/__tests__/schedule.test.ts`: inngest/client
- `src/app/api/webhooks/clickbank/route.test.ts`: inngest/functions/generate-campaign-db
- `src/seed/auth/enforce-tier-quota.test.ts`: quota/video-quota
- `src/app/api/heygen/api-routes.test.ts`: quota/video-quota
- `src/app/api/v1/usage/batch/batch-ingestion-api.test.ts`: usage-metering/aggregator
- `src/lib/sop/executor/sop-runner.test.ts`: missions/dispatcher
- `src/lib/ai/script-generator.test.ts`: usage-metering/context
- `src/lib/analytics/types.ts`: usage-metering/types (regular import)
- 7x `@/middleware/rate-limit-wrapper` vi.mock → `@/forest/middleware/rate-limit-wrapper`
- 2x `@/components/*` vi.mock → `@/forest/components/*`

### TypeScript type fixes
- `src/forest/worker/middleware/raas-auth-middleware.ts`: `Env` type conflict between Cloudflare global
  and local worker `Env` interface — fixed with `import type { Env as WorkerEnv } from '../index'`
  and cast `env as unknown as Env` for validators that use Cloudflare global Env

## Codemod Stats
- Files changed: 177 (by ts-morph codemod)
- Imports rewritten: 267 (by ts-morph codemod)
- Additional manual fixes: ~40 files

## Phase 03/04 Deferrals Resolved
- `@/lib/email/sender` dynamic import: NOT needed (sender.ts imported via forest/email alias)
- `@/lib/quota/quota-checker` in seed/auth tests: Fixed via vi.mock path update

## Build Result
- `npm run build`: PASS (0 TS errors)
- `npm test --run`: PASS (2546 / 0 fail, 258 test files + 1 skipped)
- Routes: unchanged (Next.js app/ route files untouched)
