# Handoff Report — Explorer 3 (Technical Debt & Risk Auditor)

**Timestamp:** 2026-05-30T07:24:25Z
**Role:** Technical Debt & Risk Auditor (Explorer 3)
**Working Directory:** `/Users/macbook/projects/sophia-ai-factory/.agents/explorer_m1_3/`
**Target Report:** `/Users/macbook/projects/sophia-ai-factory/.agents/explorer_m1_3/tech_debt_report.md`

---

## 1. Observation

Direct observations of workspace clutter, dead code, and cron drift:

* **Stale workspace files:** The workspace root `/Users/macbook/projects/sophia-ai-factory/` contains duplicate files and configurations from a legacy, pre-monorepo setup:
  * [Root package.json](file:///Users/macbook/projects/sophia-ai-factory/package.json) (runs Next 15, depends on deprecated `@polar-sh/nextjs` and `stripe`)
  * [Root wrangler.jsonc](file:///Users/macbook/projects/sophia-ai-factory/wrangler.jsonc) (points to sub-app worker, but lacks `migrations_dir` binding)
  * Duplicate migrations: [Root migrations/](file:///Users/macbook/projects/sophia-ai-factory/migrations/) vs [Sub-app migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/) both contain 151 identical SQL files.
* **Misleading File Index:** [all_files.txt](file:///Users/macbook/projects/sophia-ai-factory/all_files.txt) is a stale snapshot listing non-existent files like `lib/clients/polar-client.ts` (line 179) and `lib/payments/polar-subscription-service.ts` (line 183).
* **Dead / Unregistered Inngest Functions:** [src/forest/inngest/functions/index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) exports functions (like `sopExecute` at line 42, `videoScripting` at line 10, and `videoGenerate` at line 36) that are missing from the served functions array in [src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).
  * `sopExecute` (in [sop-executor.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/sops/sop-executor.ts)) is completely dead: it listens to `'sop/execution.requested'`, which is never published. The active flow uses `runSop` in [sop-runner.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/sop/executor/sop-runner.ts).
* **Cron Drift:** Four triggers in [wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) (line 66) have no matching routing keys in the `CRON_ROUTES` map of [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs):
  * `"0 7 * * *"` (`llm-cache-purge`)
  * `"0 */4 * * *"` (`affiliate-scout`)
  * `"10 * * * *"` (`wallet-rebuild`)
  * `"*/10 * * * *"` (`heartbeat`)
* **Dead Cron API Routes:** Six cron routes in [src/app/api/cron/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/) have no triggers in `wrangler.toml` and are unmapped in `inject-scheduled-handler.mjs` (e.g. `daily-rollup` and `hourly-rollup`).
* **Stale Zod Schemas:** [src/lib/schemas.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/schemas.ts) defines unused schemas (`campaignSchema`, `createVideoSchema`, `setupConfigSchema`) and accepts the deprecated `Polar-Signature`.
* **Database Typings Technical Debt:** Tables like `users` and `subscriptions` continue to import their schema types from the legacy file [src/lib/supabase/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/supabase/types.ts), creating a false sense of reliance on Supabase.
* **4-Layer Architecture Violations:**
  * [auto-handover.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/auto-handover.ts) (line 15) imports `enqueueWelcomeEmail` from `@/forest/outbox/email-outbox`.
  * [handover-email-service.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/handover-email-service.ts) (lines 10-11) imports `renderEmail` and `SENDER_FROM` from `@/forest/email/...`.
  * [dispatch-with-retry-hints.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts) (line 23) imports `publishToTelegram` from `@/forest/publishing/...`.

---

## 2. Logic Chain

1. **Stale root files & duplicated migrations** -> Developers or deployment systems executing commands from the workspace root may accidentally use outdated package contexts or apply migrations to/from the wrong directories.
2. **Unregistered Inngest functions + dead `sopExecute`** -> A large chunk of background code is served as dead code. This wastes file footprint and creates high maintenance overhead.
3. **Unmapped cron triggers** -> Cron triggers fire in Cloudflare but silently exit at the API router level, breaking automated cache purging, heartbeat pinging, wallet rebuilding, and affiliate network scraping.
4. **Stale/unused schemas + split schema typing** -> Typings and validations retain dependencies on the rejected Polar.sh and Supabase frameworks, confusing developers about the true schema source of truth (which is Cloudflare D1).
5. **Layer violations** -> Tree-level modules (reusable domains) import from forest-level modules (orchestrators), creating circular dependencies and violating the modular ESM 4-layer design doctrine.

---

## 3. Caveats

* Only local filesystem code and configurations were audited. Live Cloudflare dashboard secrets and actual D1 remote database rows were not inspected.
* External sidecar service connectivity parameters (TTS/MoviePy rendering) were not fully mapped due to missing operator environment variables in local `.env.example`.

---

## 4. Conclusion

The technical debt in Sophia AI Factory consists of:
1. **Workspace clutter:** Stale Next.js app roots, duplicate migration folders, and obsolete file indexes.
2. **Execution drift:** Scheduled crons in Cloudflare triggers failing silently at the worker routing gate.
3. **Dead logic:** Inactive Inngest background functions and dead database rollups.
4. **Architectural violations:** Tree-to-forest imports and split schema typings.

Resolving these issues requires cleaning up root workspace files, expanding the `CRON_ROUTES` map in [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs), cleaning up unregistered Inngest functions, and migrating schema types to [src/seed/db/types.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/types.ts).

---

## 5. Verification Method

* Run `npm run type-check` and `npm run lint` in `apps/sophia-ai-factory` to ensure the project compiles without errors.
* Build the application using `npm run deploy:build` and check the stdout logs to verify warnings generated by [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs) regarding unmapped/missing cron routes.
