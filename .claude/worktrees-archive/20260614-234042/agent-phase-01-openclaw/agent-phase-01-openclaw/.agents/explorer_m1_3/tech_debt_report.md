# Technical Debt & Risk Audit Report — Sophia AI Factory

**Date:** 2026-05-30
**Auditor:** Technical Debt & Risk Auditor (Explorer 3)
**Scope:** `/Users/macbook/projects/sophia-ai-factory/` codebase, configurations, database migrations, and operational processes.

---

## 1. Migration Remnants & Workspace Clutter

### Stale Root Configuration & Package Files (Confidence: High)
* **Description:** The root workspace contains a complete Next.js package structure that is a remnant from before the project was modularized into the `apps/sophia-ai-factory/` subfolder. This includes a stale `package.json` (running Next.js 15.5.14 and React 18.3.1, along with deprecated dependencies like `@polar-sh/nextjs` and `stripe`), `package-lock.json`, `pnpm-lock.yaml`, `node_modules`, `wrangler.jsonc`, `.env.example`, and `open-next.config.ts`.
* **Risk:** High operational hazard. If a developer runs wrangler or npm commands from the root instead of the sub-app folder, it will execute against stale configurations and legacy packages. Specifically, the root [wrangler.jsonc](file:///Users/macbook/projects/sophia-ai-factory/wrangler.jsonc) points to the build artifacts inside the sub-app, but does not define `migrations_dir`, which will cause database commands to default to the root `migrations/` folder.
* **File References:**
  * [Root package.json](file:///Users/macbook/projects/sophia-ai-factory/package.json)
  * [Root wrangler.jsonc](file:///Users/macbook/projects/sophia-ai-factory/wrangler.jsonc)
  * [Root open-next.config.ts](file:///Users/macbook/projects/sophia-ai-factory/open-next.config.ts)

### Duplicated Migrations Directories (Confidence: High)
* **Description:** There are two identical directories containing 151 SQLite migration files: one in the root [migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/) and another in the sub-app [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/).
* **Risk:** High risk of schema drift. If migrations are updated in one folder but not the other, running migration scripts from different contexts (root vs. sub-app) will result in missing tables or inconsistent schemas in production.
* **File References:**
  * [Root migrations directory](file:///Users/macbook/projects/sophia-ai-factory/migrations/)
  * [Sub-app migrations directory](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/)

### Legacy Postgres/Supabase Migration Remnants (Confidence: High)
* **Description:** The root [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/) directory contains 5 legacy Postgres migration SQL files from the previous database architecture. The project has fully migrated to Cloudflare D1 SQLite.
* **Risk:** Medium risk of developer confusion. New developers or agents might mistake the Supabase folder as the active schema source.
* **File References:**
  * [Root supabase directory](file:///Users/macbook/projects/sophia-ai-factory/supabase/)

### Empty Placeholder App: `sophia-video-bot` (Confidence: High)
* **Description:** The folder `apps/sophia-video-bot` contains only a single `pyproject.toml` file but no Python source code or execution modules.
* **Risk:** Low risk of execution error, but high clutter. It represents an unfinished or abandoned component.
* **File References:**
  * [sophia-video-bot pyproject.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/pyproject.toml)

### Stale File Index: `all_files.txt` (Confidence: High)
* **Description:** The file [all_files.txt](file:///Users/macbook/projects/sophia-ai-factory/all_files.txt) contains an outdated index of 290 paths (e.g. `lib/clients/polar-client.ts`, `lib/payments/polar-subscription-service.ts`) that do not exist anymore. These files were deleted or renamed when Polar.sh and Stripe were removed and the project refactored into the 4-layer architecture.
* **Risk:** Medium risk of confusing automated agents and developers who use this index as a source of truth for the codebase layout.
* **File References:**
  * [all_files.txt](file:///Users/macbook/projects/sophia-ai-factory/all_files.txt)

---

## 2. Dead Code & Unregistered Background Functions

### Unregistered Inngest Functions (Confidence: High)
* **Description:** The barrel file [src/forest/inngest/functions/index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) re-exports several Inngest background functions that are never registered in the canonical Inngest serve handler [src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).
* **Inactive Functions:**
  * `videoScripting`
  * `videoTTS`
  * `videoVisual`
  * `videoCompose`
  * `videoUpload`
  * `videoPublish` (Deprecated Phase 06 `video_jobs` pipeline, superseded by HeyGen webhook flow)
  * `urlRevenueVideoHandler` (Deprecated URL-to-Revenue pipeline)
  * `videoGenerate` (Deprecated Inngest video generator)
  * `batchVideoFanout` (Unregistered batch generation)
  * `repurposeAnalyze` & `repurposeClipGenerate` (Unregistered repurpose workflow)
  * `analyticsSync` (Unregistered analytics sync cron)
  * `tokenRefreshCron` (Unregistered token refresh)
  * `thumbnailAbSelector` (Unregistered A/B selector cron)
  * `sopExecute` (Unregistered SOP execution engine)
* **Risk:** High maintenance overhead. Almost 15 complex files of background logic exist in the filesystem, consuming storage and compiler time, but are completely inactive because Inngest cannot serve them.
* **File References:**
  * [Inngest route registration](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts)
  * [Inngest functions index](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts)

### Dead Inngest SOP Executor (Confidence: High)
* **Description:** The Inngest function `sopExecute` defined in [sop-executor.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts) is unregistered and listens to `'sop/execution.requested'`. However, this event is never published or dispatched anywhere in the codebase.
* **Active Codeflow:** The active SOP execution flow is managed synchronously by `runSop` inside [sop-runner.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts), which is invoked by the dashboard server actions.
* **Risk:** High. The entire folder [src/forest/sops/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/) (which contains `sop-executor.ts` and its index) is 100% dead code.
* **File References:**
  * [Dead Inngest SOP Executor](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts)
  * [Active SOP Runner](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts)

### Dead/Unused Zod Schemas (Confidence: High)
* **Description:** Three Zod schemas defined in [src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) are never imported or used in the project:
  * `campaignSchema` (lines 3-20)
  * `createVideoSchema` (lines 48-54)
  * `setupConfigSchema` (lines 56-60)
* **Risk:** Low risk, but represents dead code clutter.
* **File References:**
  * [src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts)

---

## 3. Cron Configuration & Execution Risks

### Silent Cron Throttling/Drift (Confidence: High)
* **Description:** Cloudflare Workers cron scheduling requires two steps: registering the schedule in [wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) and mapping the cron expression to an API route in [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs). Currently, four cron triggers defined in `wrangler.toml` are NOT mapped in `inject-scheduled-handler.mjs`:
  * `"0 7 * * *"` (intended for `llm-cache-purge`)
  * `"0 */4 * * *"` (intended for `affiliate-scout`)
  * `"10 * * * *"` (intended for `wallet-rebuild`)
  * `"*/10 * * * *"` (intended for `heartbeat`)
* **Risk:** High operational risk. When these cron schedules fire on Cloudflare, they log `No handler for cron pattern` and exit without executing their target business logic. This silently breaks automated affiliate discovery, cache expiration, wallet builds, and heartbeat ping monitoring.
* **File References:**
  * [wrangler.toml triggers](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml)
  * [inject-scheduled-handler.mjs mapping](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs)

### Dead Cron API Routes (Confidence: High)
* **Description:** Six cron endpoints exist in the source directory [src/app/api/cron/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/) but are completely unmapped in `inject-scheduled-handler.mjs` and have no triggers in `wrangler.toml`:
  * `/api/cron/daily-rollup`
  * `/api/cron/hourly-rollup`
  * `/api/cron/ab-winner-picker`
  * `/api/cron/memory-consolidation`
  * `/api/cron/quota-check`
  * `/api/cron/status-rollup`
* **Risk:** High. In particular, `daily-rollup` and `hourly-rollup` contain database aggregation logic that is completely dead, meaning usage event summaries in the DB are never aggregated on a cron schedule.
* **File References:**
  * [daily-rollup route](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/daily-rollup/route.ts)
  * [hourly-rollup route](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/hourly-rollup/route.ts)

---

## 4. Architectural & Schema Technical Debt

### D1 vs Supabase Schema Typings Splitting (Confidence: High)
* **Description:** Centralized schema types for core database tables (like `users`, `subscriptions`, `campaigns`, `videos`, `affiliate_offers`, etc.) are still imported from the legacy Supabase file [src/lib/supabase/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/types.ts). The new [src/seed/db/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/types.ts) only contains types for the Agent Factory, SOP Engine, and Creator Memory.
* **Risk:** High risk of confusion. It perpetuates a strong dependency on the legacy `lib/supabase` directory (which contains compatibility shims that redirect to D1 under the hood). Developers may easily mistake the Supabase types or folder as the active production database source.
* **File References:**
  * [Legacy Supabase types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/types.ts)
  * [D1 seed db types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/types.ts)

### 4-Layer Architecture Violations (Confidence: High)
* **Description:** The project enforces a 4-layer dependency model (`seed` <- `tree` <- `forest` <- `land`). However, several ESLint-exempted imports violate this hierarchy:
  * In [auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts) (line 15), a `tree` module imports `enqueueWelcomeEmail` from `forest/outbox/email-outbox`.
  * In [handover-email-service.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/handover-email-service.ts) (lines 10-11), a `tree` module imports `renderEmail` and `SENDER_FROM` from `forest/email/...`.
  * In [dispatch-with-retry-hints.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts) (line 23), a `tree` module imports `publishToTelegram` from `forest/publishing/...`.
* **Risk:** Increases coupling between layers, breaking the clean ESM separation of concerns.
* **File References:**
  * [auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts)
  * [handover-email-service.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/handover-email-service.ts)
  * [dispatch-with-retry-hints.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts)

### Stale Polar Webhook Validation (Confidence: High)
* **Description:** The `webhookHeaderSchema` in [src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) still contains and requires the `Polar-Signature` header, which is obsolete after the Polar.sh payment provider was fully deprecated and removed.
* **Risk:** Low risk, but represents a stale abstraction in request validation logic.
* **File References:**
  * [webhookHeaderSchema in src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts)

---

## 5. Concrete Examples of Technical Debt

### Example 1: Dead Code (Inngest SOP Executor)
* **File:** [src/forest/sops/sop-executor.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts) (lines 139-369)
* **Before:** The function `sopExecute` is declared as an Inngest background handler.
* **After/Status:** It is unregistered and dead because the serving route [src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts) does not import or register it, and the event `sop/execution.requested` is never emitted.

### Example 2: Duplicate Migrations Directory
* **Files:**
  * [Root migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/)
  * [Sub-app apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/)
* **Before:** There are two identical migrations folders at different paths containing 151 `.sql` files.
* **After/Status:** Keeping a duplicate copy of SQL migrations increases the risk of schema desynchronization when developers modify one path but forget the other.

### Example 3: Stale Abstractions (Polar.sh Schema References)
* **File:** [src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) (lines 24-32)
* **Before:** `webhookHeaderSchema` validates `Polar-Signature` alongside `webhook-signature`.
* **After/Status:** Stale abstraction. Polar integration has been fully replaced by NOWPayments. The schema remains un-refactored.

---

## 6. Operational Risks & Information Gaps

* **Cron Drift:** The mismatch between Cloudflare triggers and `CRON_ROUTES` mappings is the highest operational risk. Important automation tasks are scheduled on Cloudflare but silently fail at the routing gate.
* **Package-Manager Ambiguity:** The presence of both root lockfiles (`pnpm-lock.yaml` and `package-lock.json`) combined with monorepo setups causes package-manager ambiguity. Development docs mention `npm` commands, but `pnpm` workspaces exist.
* **84tea App Ownership:** `apps/84tea` is an undocumented Next.js application sitting in the monorepo with no tests or deployment history, presenting an maintenance risk.
* **Sidecar Service Connectivity:** Python-based sidecar services (`coqui-tts`, `moviepy-render`, `runpod-hunyuan`) are defined as fly/runpod Docker configs, but their production connection parameters and uptime status are undocumented in the current runbooks.
