# Technical Debt & Architecture Risks Audit

This document details the accumulated technical debt, obsolete structures, configuration drift, and architectural layer violations in the **Sophia AI Factory** codebase.

---

## 1. Workspace Remnants & Clutter

- **Root Workspace package.json:** The repository root contains a legacy Next.js workspace setup in [package.json](file:///Users/macbook/projects/sophia-ai-factory/package.json) running Next.js 15.5.14 and React 18.3.1. It retains obsolete package dependencies (such as `@polar-sh/nextjs` and `stripe`). Running npm/npx/wrangler command contexts at the root instead of the sub-app subdirectory causes execution errors and dependency conflicts.
- **Root wrangler.jsonc:** The file [wrangler.jsonc](file:///Users/macbook/projects/sophia-ai-factory/wrangler.jsonc) at the root points to build outputs in the sub-app folder but does not configure `migrations_dir`, which causes database migrations to default to the root folders instead of [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/).
- **Duplicate SQL Migration Directories:** Two identical folders containing 151 SQLite migration files exist in the repository: one in the root [migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/) and the other in the sub-app [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/). This increases the risk of database schema desynchronization during schema updates.
- **Legacy Supabase SQL Folders:** The folder [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/) contains PostgreSQL migration files from the deprecated database engine, which was replaced by Cloudflare D1 SQLite. However, note that Supabase is NOT fully obsoleted and is still actively used for JWKS token verification in the RaaS licensing layer and gateway endpoints.
- **Empty App Folder:** The directory [apps/sophia-video-bot/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/) contains a python project file [pyproject.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/pyproject.toml) but has no source files.
- **Stale File Index:** The index file [all_files.txt](file:///Users/macbook/projects/sophia-ai-factory/all_files.txt) is outdated, referencing dozens of non-existent code paths (e.g. `lib/clients/polar-client.ts` and `lib/payments/polar-subscription-service.ts`) deleted during the migration to NOWPayments and the 4-layer refactor.

---

## 2. Dead Code & Unregistered Background Handlers

### Unregistered Inngest Functions
The entrypoint barrel file [apps/sophia-ai-factory/src/forest/inngest/functions/index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) re-exports several background handlers that are missing from the served functions array in [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts):
- `videoScripting`
- `videoTTS`
- `videoVisual`
- `videoCompose`
- `videoUpload`
- `videoPublish` (Deprecated Phase 06 `video_jobs` pipeline, replaced by HeyGen webhooks)
- `urlRevenueVideoHandler` (Deprecated URL-to-Revenue pipeline)
- `videoGenerate` (Wan 2.1 + Fish Speech video generator)
- `batchVideoFanout` (Batch video triggers)
- `repurposeAnalyze` & `repurposeClipGenerate` (Social repurpose flow)
- `analyticsSync` (Analytics sync scheduler)
- `tokenRefreshCron` (Token rotation)
- `thumbnailAbSelector` (A/B testing selector)
- `sopExecute` (SOP execution engine)

As a result, publishing events like `video/generate.requested` or `sop/execution.requested` will fail to run because the Inngest runner cannot serve them.

### Dead Inngest SOP Executor
The Inngest function `sopExecute` defined in [apps/sophia-ai-factory/src/forest/sops/sop-executor.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts) is unregistered and listens to `'sop/execution.requested'`. However, this event is never published or dispatched anywhere in the codebase.
The active SOP execution flow is managed synchronously by `runSop` inside [apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts), which is invoked by the dashboard server actions.
This leaves the entire directory [apps/sophia-ai-factory/src/forest/sops/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/) (which contains `sop-executor.ts` and its index) as 100% dead code.

### Dead Zod Schemas
The schemas defined in [apps/sophia-ai-factory/src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) contain unused entities:
- `campaignSchema` (lines 3-20)
- `createVideoSchema` (lines 48-54)
- `setupConfigSchema` (lines 56-60)

---

## 3. Cron Configuration & Execution Risks

### Silent Cron Throttling/Drift
Cloudflare Workers cron scheduling requires two steps: registering the schedule in [apps/sophia-ai-factory/wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) and mapping the cron expression to an API route in [apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs). Currently, four cron triggers defined in `wrangler.toml` are NOT mapped in `inject-scheduled-handler.mjs`:
- `"0 7 * * *"` (intended for `llm-cache-purge`)
- `"0 */4 * * *"` (intended for `affiliate-scout`)
- `"10 * * * *"` (intended for `wallet-rebuild`)
- `"*/10 * * * *"` (intended for `heartbeat`)

When these schedules fire on Cloudflare, they log `No handler for cron pattern` and exit without executing their target business logic. This silently breaks automated affiliate discovery, cache expiration, wallet builds, and heartbeat ping monitoring.

### Dead Cron API Routes
Six cron endpoints exist in the source directory [apps/sophia-ai-factory/src/app/api/cron/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/) but are completely unmapped in `inject-scheduled-handler.mjs` and have no triggers in `wrangler.toml`:
- `/api/cron/daily-rollup`
- `/api/cron/hourly-rollup`
- `/api/cron/ab-winner-picker`
- `/api/cron/memory-consolidation`
- `/api/cron/quota-check`
- `/api/cron/status-rollup`

In particular, the routes [apps/sophia-ai-factory/src/app/api/cron/daily-rollup/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/daily-rollup/route.ts) and [apps/sophia-ai-factory/src/app/api/cron/hourly-rollup/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/hourly-rollup/route.ts) contain database aggregation logic that is completely dead, meaning usage event summaries in the DB are never aggregated on a cron schedule.

---

## 4. Architectural & Schema Technical Debt

### D1 vs Supabase Schema Typings Splitting
Centralized schema types for core database tables (like `users`, `subscriptions`, `campaigns`, `videos`, `affiliate_offers`, etc.) are still imported from the legacy Supabase file [apps/sophia-ai-factory/src/lib/supabase/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/types.ts). The new [apps/sophia-ai-factory/src/seed/db/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/types.ts) only contains types for the Agent Factory, SOP Engine, and Creator Memory.
While this dependency remains, Supabase is actively used in production for JWKS token verification in the RaaS licensing layer and gateway endpoints. However, developers may easily mistake the Supabase database schemas/types or the legacy [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/) folder as the primary database source instead of Cloudflare D1.

### 4-Layer Architecture Violations
The project enforces a 4-layer dependency model (`seed` <- `tree` <- `forest` <- `land`). However, several ESLint-exempted imports violate this hierarchy:
- In [apps/sophia-ai-factory/src/tree/handover/auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts) (line 15), a `tree` module imports `enqueueWelcomeEmail` from `forest/outbox/email-outbox`.
- In [apps/sophia-ai-factory/src/tree/handover/handover-email-service.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/handover-email-service.ts) (lines 10-11), a `tree` module imports `renderEmail` and `SENDER_FROM` from `forest/email/...`.
- In [apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts) (line 23), a `tree` module imports `publishToTelegram` from `forest/publishing/...`.

These violations introduce tight coupling and circular dependencies.

---

## 5. Concrete Examples of Technical Debt

### Example 1: Dead Code (Inngest SOP Executor)
* **File:** [apps/sophia-ai-factory/src/forest/sops/sop-executor.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts) (lines 139-369)
* **Before (Intended):** The function `sopExecute` is declared as an Inngest background handler.
* **Current Status:** It is unregistered and dead because the serving route [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts) does not import or register it, and the event `sop/execution.requested` is never emitted.

### Example 2: Duplicate Migrations Directory
* **Files:**
  - [migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/) (Root)
  - [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/) (Sub-app)
* **Before (Intended):** Maintain a single source of truth for D1 database migrations.
* **Current Status:** There are two identical migrations folders containing 151 `.sql` files, creating a risk of schema desynchronization when developers modify one path but forget the other.

### Example 3: Stale Abstractions (Polar.sh Schema References)
* **File:** [apps/sophia-ai-factory/src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) (lines 24-32)
* **Before (Intended):** `webhookHeaderSchema` validates inputs for multi-provider webhooks.
* **Current Status:** Polar.sh integration has been fully replaced by NOWPayments. However, the schema still validates and requires the `Polar-Signature` header, which is obsolete.
