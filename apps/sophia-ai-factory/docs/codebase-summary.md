# Codebase Summary

**Last Updated:** 2026-05-15
**Version:** 1.28.0 (Wave 27: RaaS Global Multi-Channel — 10 affiliate networks + geo-publishing + compliance)

**Wave 27 (2026-05-15)** — RaaS Global Multi-Channel Feature Batch (8 phases, commit `93b190e0`):

**Affiliate network expansion:** `src/land/affiliates/networks/` now supports 10 networks:
- **Crypto exchanges (Phase 01):** Binance, Bybit, Bitget, Coinbase (BYOK affiliate linking)
- **SaaS scouts (Phase 02):** ShareASale, Awin, Rakuten + 3 legacy (CJ, Impact, FlexOffers) = 6 total SaaS
- Network schema: `affiliate_networks(id, name, category, requires_byok, network_config_json)`
- Setup Wizard UI discoverable; per-network BYOK credential handling via encrypted store

**Anti-scam + EPC scoring (Phase 03):** `src/lib/affiliates/scout/scoring-engine.ts` — 6-factor weighted model:
- Domain age (whois), SSL validity, EPC 90d trend, network approval, crypto volume (exchanges), scam-domain blacklist
- Endpoint: `POST /api/scout/networks/{networkId}/score/{domainId}` (RAAS tier gate)
- Output schema: `{score: 0-100, riskFactors: string[], epc: {current, trend, 90d_avg}}`

**One-click bundle publishing (Phase 04):** `src/forest/publishing/bundle-publisher.ts` + UI `/dashboard/campaigns/publish-bundle`:
- **4 presets:** Vietnam (VN+VND), Global (EN+multi-currency), Professional (B2B), Maximum (all 13 channels)
- Orchestrates: caption/hashtag translation → thumbnail variants → channel scheduling → tracking pixel injection
- Endpoint: `POST /api/publish/bundle` (orchestrator consumes Phase 05 + 10 outputs)

**Geo-aware caption/hashtag translation (Phase 05):** `src/forest/publishing/caption-translator.ts`:
- BYOK OpenRouter (user's own API key) → Qwen/Claude for locale-specific translation
- Channel locale mapping: TikTok.vn→VI, YouTube.vn→VI, Instagram.kr→KO, etc.
- KV cache (`NEXT_KV_CACHE`) prevents re-translation on retry
- Schema: `{channel, locale, caption, hashtags, translatedAt, cacheHit}`

**Unified revenue dashboard (Phase 07):** `src/land/billing/revenue-dashboard.tsx`:
- Stacked Recharts: SaaS (MRR by tier) + Crypto (NOWPayments USDT) + Product (affiliate commissions)
- Drill-down per stream → transaction log; bilingual (VI+EN); currency formatting (VND/USD)

**Crypto disclaimer per jurisdiction (Phase 08):** `src/seed/compliance/crypto-disclaimer-*.ts`:
- 5 jurisdictions: US, EU, VN, SG, JP (region-specific legal text)
- DB: `tenant_settings.crypto_jurisdiction` (migration 0110)
- Injections: KYC banner (identity verify link), video overlay (<100ms Remotion), checkout disclaimer
- Route: `GET /api/compliance/crypto-disclaimer/{jurisdiction}` (public, cacheable)

**Per-channel cooldown + burst protection (Phase 10):** `src/forest/publishing/channel-cooldown.ts`:
- 13 channels: TikTok (4h/3-per-day), Instagram (24h), YouTube (12h), LinkedIn, Twitter, Telegram, Snapchat, Pinterest, Reddit, Discord, Bluesky, Threads, BeReal
- Strategy: **defer-not-reject** — reschedule to next available window; DB: `channel_publishing_queue(channel, user_id, scheduledFor, cooldown_expiry, status)`

**Tests added:** 47 new tests (bundle-publisher, scoring-engine, channel-cooldown, geo-translator). Total 1450+ pass. Build 0 errors. Deploy CF-direct verified.

**Deferred:** Phase 06 (A/B title/thumbnail runner — pending threshold decision), Phase 09 (help videos — pending founder recording).

**Wave 26 (2026-05-12)** — Mekong SOP Gap Bridge (3 phases):

**Phase 1 — Unified Developer SOPs** (docs/dev-sops.md, 277 LOC):
- Created canonical SOP doc adapted from mekong-cli for sophia's stack (Next.js 16 + CF Workers + Better Auth + D1)
- 10 sections: Environment Setup, Test Suite, Add API Route, Modify Layers, CF-direct Deploy, Git Workflow, Debug, Project Structure, CI Gates, Security Checklist
- Cross-links existing runbooks (payout-operations, load-testing, contributor-handover)
- CONTRIBUTING.md + README.md updated with dev-sops.md link

**Phase 2 — 5 CI Enforcement Gates** (husky + npm scripts, 0 GitHub Actions changes):
- **G1 typecheck:** `npm run ci:typecheck` (tsc --noEmit)
- **G2 lint:** `npm run ci:lint` (eslint --max-warnings=0)
- **G3 test:** `npm run ci:test` (vitest run)
- **G4 secrets:** `npm run ci:secrets` (secretlint on src/)
- **G5 audit:** `npm run ci:audit` (npm audit --audit-level=high)
- Wired via `.husky/pre-commit` (lint-staged on TSX) + `.husky/pre-push` (full test + audit)
- `npm run ci` chains all 5 gates sequentially
- Pre-existing lint debt flagged: 275 errors + 368 warnings (baseline cleanup deferred to Wave 27)

**Phase 3 — DI Inversion for seed→forest/tree Layer Boundary:**
- NEW `src/seed/types/{quota-limit.ts, quota-provider.ts}` — canonical interfaces
- MOD `src/seed/auth/enriched-jwt.ts` — `createEnrichedJwt()` accepts optional `quotaProvider?: QuotaProvider` DI param (defensive EMPTY_QUOTA fallback with logger.warn)
- MOD `src/seed/auth/better-auth-server.ts` — removed static forest/tree imports, converted to lazy `await import(...)` in callbacks
- ESLint `eslint.config.mjs` — removed 3 of 4 exemptions (`enriched-jwt`, `enriched-jwt-types`, `better-auth-server`); `enforce-tier-quota` still deferred
- Result: `grep -rn "from ['\"]@/forest" src/seed/auth/` returns 0 results
- Tests: 36/36 enriched-jwt tests passing, 0 new ESLint violations on fixed files

**Follow-ups (low priority):**
- Phase 4 PEV port deferred per YAGNI (sophia uses Inngest, no multi-step orchestration)
- G2 lint baseline cleanup (275 errors) → Wave 27
- `enforce-tier-quota.ts` exemption still deferred (security cluster work)

**Wave 8 (2026-05-12)** — Consolidate proposal surfaces (monorepo cleanup):

*Monorepo consolidation:*
- Delete `apps/sophia-backend` (1003 LOC FastAPI, never integrated; commit `0f61a7f5`)
- Port real proposal generation from `apps/sophia-proposal` into `src/seed/ai/` (645 new LOC modules: `proposal-generator.ts`, `proposal-quality-check.ts`, `proposal-templates.ts`, validators; commit `a241a68e`)
- Delete `apps/sophia-proposal` (459 files, 10,459 LOC deprecated; commit `2d54bbe9`)
- API route `POST /api/proposals` now ACTIVE (was 27-LOC 501 stub), uses shared lib + OpenRouter gateway
- Layer: `seed/ai/` new canonical home for AI foundational primitives (importable by all layers)
- Net LOC change: **-11,089** (repo consolidation)
- Tests: 4110/4110 pass. Build: 0 TS errors. Deploy: CF-direct.

**Wave 7 (2026-05-11)** — Phase 03 Stripe Connect KYC + GAP plan close-out:

*Payouts (Phase 03 — ALL code complete, user-action gated for Stripe secrets):*
- Migration 0106 restored 3 silent-failing tables (`commission_ledger`, `payout_batches`, `payout_methods`) on remote D1 — INC-2026-01 root cause was canonical-folder drift (commit `57024fa7`)
- `payout-batcher` weekly cron now routes per affiliate: Stripe Transfer (fiat USD) when `user_payout_settings.stripe_payout_enabled=1`, else NOWPayments USDT (`17b4b6b5`). New `resolve-payout-method.ts`.
- `/api/affiliate/payouts` schema mismatch fixed (`total_usd` column → `total_cents` storage, both exposed in JSON) — INC-2026-03 (`8762c26e`)
- New `/dashboard/affiliate/payouts` UI with Stripe Connect onboard CTA + USDT methods CRUD (`06346316`)

*Operational documentation:*
- `docs/payout-operations-runbook.md` — dual-rail on-call playbook (6 incidents × triage + 4 rollback procedures)
- `docs/load-testing-runbook.md` — Playwright E2E + k6 4-profile reference, baseline 100/106 green + k6 0% error / p95 3.46s
- `docs/contributor-handover.md` — developer onboarding companion to `HANDOFF.md` (11 sections, 4-layer arch + deploy doctrine + 6 pitfalls + secret rotation matrix)
- `docs/postmortems/` — 3 retroactive write-ups (INC-2026-01 schema drift, INC-2026-02 GitHub Actions disabled → CF-direct doctrine, INC-2026-03 cents/USD column drift)

*Automated prevention layers (run on every `npm test`):*
- `scripts/check-migration-coverage.sh` — every D1 `CREATE TABLE` in `src/**/*.sql` must have a canonical `migrations/` match. Postgres/Supabase SQL filtered via syntax heuristic. (`9b2dc173`)
- `scripts/check-edge-runtime-safety.sh` — any `process.on/exit/kill/abort` in `src/**/*.ts` must be wrapped in an exported function plus `@edge-runtime-allowed` annotation. Caught 1 latent bug (`overage-logger-buffer.ts` had same broken pattern as `batch-buffer.ts`). (`644638b6`)
- `.github/PULL_REQUEST_TEMPLATE.md` — codifies INC-2026-01/02/03 lessons as PR checklist gates (`9453b3ce`)

*Phase 02 unblock:*
- `tests/e2e/_fixtures/auth-{helpers,fixture}.ts` + `scripts/e2e-bootstrap-user.ts` — reusable Better Auth signin via Playwright. Auto-skip when `E2E_TEST_USER_PASSWORD` absent so default unauth runs stay green. (`81212344`)
- Dev server boot fix: `process.on` hooks extracted to opt-in `installShutdownHandlers()` to satisfy Next.js Edge Runtime static analyzer (`58c7192b`)

*Phase 05/08 closeout:*
- Email-drip cron route gained smoke tests (auth gate, idempotent skip, sweep counts) — `3c57b8a8`
- Dead SQL files (`0038-revenue-split.sql` + alias) carry explicit "DEPRECATED — DO NOT RESTORE" banner referencing the canonical replacement (`3d375d53`)

**Wave 6 (2026-05-08)** — see `docs/project-changelog.md` for: MCU monthly reset cron fix, agent-chat credit pre-deduct, API key rate limit, magic-link i18n, FREE100 emailVerified gate.

## Project Structure Overview

Sophia AI Video Factory is a Next.js 16 application structured around the App Router. It integrates with Airtable (data), n8n (automation), and various AI providers (OpenRouter, ElevenLabs, D-ID).

<!-- Tiếng Việt: Cấu trúc thư mục đã được tái cấu trúc theo mô hình Mekong 4 tầng kể từ 2026-05-03. -->
<!-- EN: Directory layout restructured into Mekong 4-layer model as of 2026-05-03. See docs/system-architecture.md for layer rules. -->

```
.
├── apps/sophia-ai-factory/    # Main application root
│   ├── docs/                  # Project documentation
│   ├── openclaw/              # OpenClaw affiliate engine integration
│   ├── plans/                 # Development plans and reports
│   ├── public/                # Static assets
│   ├── scripts/               # Utility scripts (setup, verification)
│   ├── workflows/             # n8n workflow JSON exports
│   └── src/                   # Source code (Mekong 4-layer architecture)
│       ├── seed/              # Layer 1 — infra primitives (no domain)
│       │   ├── ai/            # AI foundational libs (proposal generator, quality check, templates)
│       │   ├── db/            # D1 database client + queries
│       │   ├── utils/         # Shared utilities (to-error, formatters)
│       │   ├── security/      # API key validation, cron auth, HMAC
│       │   ├── types/         # Shared TypeScript interfaces + contracts
│       │   ├── config/        # Feature flags, tier config, environment
│       │   │   └── channels/  # Supported channel providers (supported-providers.ts)
│       │   ├── auth/          # Better Auth server, JWT enrichment
│       │   │   └── sign-out-button.tsx # Client sign-out component
│       │   ├── health/        # Health check endpoints
│       │   ├── validators/    # Zod schemas (proposal, etc.)
│       │   └── components/ui/ # Pure Tailwind primitives (shadcn/ui)
│       ├── tree/              # Layer 2 — single-tenant CEO ops
│       │   ├── admin/         # Admin panel components
│       │   ├── audit/         # Audit log writer
│       │   ├── byok/          # Bring-Your-Own-Key management
│       │   ├── clients/       # External API client wrappers
│       │   ├── credentials/   # Encrypted credential storage
│       │   ├── crypto/        # Encryption utilities
│       │   ├── gateway/       # External API gateway + circuit breaker
│       │   ├── handover/      # CEO handover report generation
│       │   └── telegram/      # Telegram bot + FSM campaign handlers
│       ├── forest/            # Layer 3 — multi-tenant SaaS plumbing
│       │   ├── agents/        # Agent runner + task queue + logger
│       │   ├── api-keys/      # API key CRUD + rotation
│       │   ├── components/    # SaaS UI components (pricing, quota)
│       │   ├── email/         # Email rendering + delivery
│       │   ├── hooks/         # Shared React hooks
│       │   ├── inngest/       # Inngest event functions
│       │   ├── middleware/    # Tenant isolation middleware
│       │   ├── missions/      # Mission control UI
│       │   ├── onboarding/    # Welcome + tenant setup flows
│       │   ├── outbox/        # Reliable email outbox (D1-backed)
│       │   ├── quota/         # Quota checker + enforcer
│       │   ├── usage-metering/# Usage event collector + KV sync
│       │   └── worker/        # Cloudflare Worker entry + metering reconciler
│       ├── land/              # Layer 4 — revenue + governance (top layer)
│       │   ├── affiliates/    # Affiliate program catalog + shortlinks
│       │   ├── billing/       # Billing email, dunning, invoices
│       │   ├── checkout/      # Checkout page + payment initiation
│       │   ├── orders/        # Order management
│       │   ├── payments/      # NOWPayments IPN + PayOS handlers
│       │   ├── payouts/       # Payout processor + wallet rebuilder
│       │   ├── promo/         # Promo codes + discounts
│       │   ├── refunds/       # Refund handling
│       │   ├── status/        # Public status page
│       │   └── wallet/        # User financial settlement
│       ├── app/               # Next.js App Router (route files, orchestration)
│       ├── lib/               # Legacy lib/ — being migrated to layers above
│       ├── middleware.ts      # Next.js middleware (root — uses seed/auth)
│       └── instrumentation.ts # Sentry hook (root)
```

## Key Directories & Files

### `/src/app` (Frontend Routes)
- **`/setup-wizard`**: The critical onboarding flow.
  - `page.tsx`: Main wizard logic.
  - `wizard-steps.tsx`: Component for individual steps.
  - `actions.ts`: Server actions for key verification and config generation.
- **`/dashboard`**: The main user interface.
  - `page.tsx`: Dashboard view.
- **`/api`**: Serverless API routes.
  - `/api/agents/*`: Agent Factory multi-tenant endpoints.
    - `GET /api/agents/teams`: List agent teams for user.
    - `POST /api/agents/teams`: Create new agent team.
    - `GET /api/agents/agents`: List agents in team.
    - `POST /api/agents/agents`: Create new agent.
    - `GET /api/agents/tasks`: List tasks with filtering.
    - `POST /api/agents/tasks`: Create new task.
    - `GET /api/agents/logs`: Stream agent logs via SSE.
  - `/api/generate-script`: Triggers n8n script workflow.
  - `/api/render-video`: Triggers n8n video workflow.
  - `/api/setup`: Endpoint for wizard configuration validation.
  - `/api/heygen/*`: Direct proxy endpoints for HeyGen API.
  - `/api/webhooks/heygen`: HeyGen video completion webhook (HMAC-SHA256 verified, 2026-04-29).
  - `/api/cron/video-status-sync`: 5-min polling cron for pending HeyGen video status (2026-04-29).
- **`middleware.ts`**: Handles redirection logic.
  - Redirects unconfigured instances (missing `SETUP_COMPLETE` cookie/env) to `/setup-wizard`.
  - Protects `/admin` routes if configured.

### `/src/lib` (Core Logic)
- **`agents/`**: Multi-tenant AI Agent Factory infrastructure (Phase 11).
  - **`agent-runner.ts`**: Core orchestration engine for agent execution.
  - **`task-queue.ts`**: D1-backed task queue with state machine (pending → assigned → running → completed/failed).
  - **`agent-logger.ts`**: Structured logging for agent lifecycle and task events.
  - **`agent-types.ts`**: Core interfaces (Agent, AgentTeam, AgentTask, AgentLog, SignalEvent).
  - **`signal-events.ts`**: Event emission and tracking for agent diagnostics.
- **`services/`**: Service Factory Architecture.
  - **`factory.ts`**: Central dependency injection container ensuring singleton instances.
  - **`types.ts`**: Core interfaces (`IVideoService`, `IVoiceService`, `IScriptService`) decoupling logic from implementation.
  - **`real/`**: Production implementations (HeyGen, ElevenLabs, OpenRouter).
  - **`mock/`**: Zero-cost, offline-capable mock implementations for development, testing, and CI/CD.
- **`quota/`**: Usage quota management system (Phase 38 modularized).
  - **`quota-checker.ts`**: Main barrel export (checkQuotaWithOverage function) with KV cache + DB fallback + overage logging.
  - **`quota-checker-types.ts`**: Core types (ExceededType, CachedQuota, QuotaCheckContext, QuotaConfig, EnhancedQuotaCheckResult).
  - **`quota-checker-kv-cache.ts`**: KV operations (getCachedUsage, updateCachedUsage, invalidateQuotaCache).
  - **`quota-checker-db.ts`**: Database queries (getEffectiveQuotaLimits, calculateCurrentUsage).
  - **`quota-checker-overage.ts`**: Overage handling and status (logOverageEvent, getQuotaStatus).
  - **`quota-enforcer.ts`**: Soft/hard limit enforcement and billing flag logic.
  - **`quota-api-helpers.ts`**: API response formatting helpers.
  - **`overage-logger.ts`**: Detailed overage event logging and admin tracking.
- **`usage-metering/`**: Usage metering aggregation system.
  - **`kv-metering-log-sync.ts`**: KV synchronization and metering log persistence.
- **`affiliates/`**: ClickBank affiliate program integration (Sprint M). Two-table design (catalog public, selected private).
  - **`affiliate-shortlink-service.ts`**: Short-link generation + click attribution (rate-limited 100/min).
  - **`clickbank-webhook-handler.ts`**: HMAC-SHA1 signature verification + conversion logging.
  - **`affiliate-offer-selector.ts`**: Telegram FSM offer picker + Inngest script injection.
  - **Data schema:** `affiliate_offers_catalog` (public: id, name, url, category, description, provider), `affiliate_offers_selected` (private: user's per-campaign choices).
- **`wallet/`**: User financial settlement system (Sprint M).
  - **`payout-processor.ts`**: Atomic wallet updates with reconciliation revert pattern.
  - **`wallet-rebuilder.ts`**: Hourly cron job aggregating conversions with 60-day clearance window.
  - **`clearance-promoter.ts`**: Daily cron job moving pending→available balances.
  - **`payout-manager.ts`**: Admin approval flow + Telegram notifications.
- **`video/`**: HeyGen video storage + webhook integration (2026-04-29).
  - **`r2-binding.ts`**: Cloudflare R2 bucket operations (`sophia-videos`).
  - **`heygen-webhook-handler.ts`**: HMAC-SHA256 webhook signature verification + video ingest.
  - **`video-status-sync.ts`**: Cron job (5-min polling) for pending HeyGen video status updates.
- **`heygen/`**: Legacy HeyGen client (deprecated in favor of services).
- **`airtable.ts`**: Typed client for Airtable operations.
- **`n8n.ts`**: Client for triggering n8n webhooks.

### `/scripts` (DevOps & Setup)
- **`infra-sync.sh`**: Master infrastructure synchronization script.
- **`smoke-test.ts`**: Production health verification script.
- **`setup.sh`**: Interactive shell script for verifying environment prerequisites.
- **`verify.sh`**: Comprehensive QA script (Lint, Type, Test, Audit).
- **`setup-vercel.sh`**: Automates Vercel project configuration and environment variable syncing.
- **`health-check.js`**: Standalone node script for checking API health.

### `/tests` (Testing)
- **`e2e/`**: Playwright end-to-end tests.
  - **`sanity.spec.ts`**: Core user flow verification in Mock Mode.
- **`mocks/`**: MSW handlers and test data.

### `/workflows` (Automation)
- Contains JSON exports of the n8n workflows required to run the "Brain" of the factory.
- **`script-generator.json`**: LLM pipeline for generating scripts from topics.
- **`video-generator.json`**: Orchestrates video creation (avatar + background).
- **`voice-generator.json`**: ElevenLabs TTS generation pipeline.
- **`publish-workflow.json`**: Final video publishing logic.

## Configuration Management
- **Environment Variables**:
  - Managed via `.env.local` (local) or Vercel Config (production).
  - Key variables: `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `DID_API_KEY`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`.
- **Feature Flags**:
  - Located in `src/config/flags.ts`.
  - `NEXT_PUBLIC_SETUP_WIZARD`: Controls wizard availability.
  - `NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE`: Toggles affiliate tools.

## Recent Major Changes
- **Go-Live Hardening Batch (2026-04-30)**: `/settings`→`/dashboard/settings` redirect fix. Cron auth centralized — `verifyCronAuth()` in `lib/security/cron-auth.ts` now used by `clearance-promote`, `wallet-rebuild`, `local-mode-health`, `workflow-stepper`, `uptime-check`. Dead code purge: `verify-env.js` (Polar BANNED), `env-validation.ts` (D-ID discontinued). localhost:3000 fallbacks removed. `.env.production.example` updated (+20 vars, −Polar). CERTIFICATION.md regenerated: 1798 tests pass, 31 skipped, 0 failed, 24.87% line coverage. All routes verified green.
- **Video Go-Live: HeyGen Webhooks + R2 Storage (2026-04-29)**: Shipped `POST /api/webhooks/heygen` (HMAC-SHA256), `GET /api/cron/video-status-sync` (5-min polling), R2 binding `sophia-videos`. Migration 0030 adds `r2_key`, `r2_size_bytes` to `videos` table. New env secrets: `HEYGEN_WEBHOOK_SECRET`, `HEYGEN_API_KEY`. Optional `R2_PUBLIC_BASE_URL` for CDN. Commits 0b12421, a2aa630. Status response: `{status, video_url, thumbnail_url, duration_sec, error}`.
- **Sprint M Phase M1: Revenue Pipeline Unblock (2026-04-27)**: D1 schema expansion for campaigns + RAAS licensing. Added tables: `campaigns`, `campaign_checkpoints`, `raas_licenses`, `raas_audit_logs`. Extended `user_profiles` with `subscription_tier` and `telegram_chat_id`. Migrations 0018-0019 (new) + 0020 (fix). Telegram handler refactor + 7-test suite. Tests: 1406/1406 pass. TS: 0 errors. Review: 9.6/10. Pipeline now writes to DB without crashes; remote apply deferred.
- **Phase 49: Analytics Page Modularization (2026-04-27)**: Modularized analytics usage page (382L → 5 modules <200L each). New structure: page.tsx orchestrator + use-usage-analytics hook + 3 tab components. Zero behavioral change. Tests: 1397/1397 pass. TS: 0 errors. Review: 9.7/10.
- **L1 Logger Noise Sweep (2026-04-27)**: Demoted 4 hot-path API logs to debug (quota, usage, usage/batch, overage endpoints). Removed 2 redundant per-request logs. Audit/security/billing logs untouched. Cost optimization via reduced Cloudflare Workers log egress, zero impact on operational visibility. Tests: 1398/1429 pass. TS: 0 errors. Review: 9.7/10.
- **T3 Cosmetic Cleanup Batch (2026-04-27)**: Closed 5 LOW-priority Phase 46 code-review items. Removed orphan `textSearch` mock, deleted dead `isMonthExpired()` function, type-safe Badge variant via `tierToBadgeVariant()` helper, tightened tier cast to `Tier` brand. Purged vestigial `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` from worker Env interface (confirms full D1 migration). 1398/1429 tests pass. TS: 0 errors. Review: 9.3/10.
- **D1 Migration 0017 — JWT Nonce Replay Protection (2026-04-26)**: Added `migrations/0017-jwt-nonces.sql` to establish JWT nonce table for replay-attack defense. Fixed production runtime risk where code referenced table that didn't exist. Updated 3 callsites in `src/lib/auth/jwt-nonce-*.ts` to align with PK-only schema. All 1398 tests pass. TS: 0 errors.
- **Phase 46 B2 Complete (2026-04-26)**: TypeScript Cleanup Mission — Final phase eliminating 100% of type errors (462→0). All 1398 tests pass. Build time 10.0s. Architectural patterns documented in `docs/code-standards.md` (Web Crypto, D1/Supabase divergence, Better Auth, Zod v4, etc.). Protected flows verified: Setup Wizard, Telegram Bot, NOWPayments all operational.
- **Phase 11 (2026-04-25)**: Multi-Tenant AI Agent Factory — Complete 4-phase restructure (Seed → Tree → Forest → Land). D1 agent tables, runner, task queue, Mission Control UI, SSE streams, feedback loop, observability gates. 1394 tests pass. Commit e6a180d8.
- **Phase 39 (2026-04-25)**: Metering Reconciler Modularization — Split `src/worker/lib/metering-reconciler-runner.ts` (497L) into 5 focused sub-modules (types, error logger, license validator, aggregator, main barrel) with zero behavioral change. Added `Env` interface export from `src/worker/index.ts`.
- **Phase 38 (2026-04-25)**: Quota Checker Service Modularization — Split monolithic `quota-checker.ts` (499L) into 5 focused sub-modules (types, KV cache, DB, overage, main barrel) with zero behavioral change.
- **Phase 37 (2026-04-24)**: Realtime Alert Service Modularization — Split `realtime-alert-service.ts` (525L) into dispatcher, delivery, state, reconnection sub-modules.
- **HeyGen Integration**: Added direct API integration for high-fidelity avatar video generation (`v1.5.0`).
- **Turnkey Setup Wizard**: Implemented a comprehensive 4-step wizard to eliminate manual `.env` editing for end-users.
- **Middleware Redirection**: Automatic routing to wizard for fresh installs.
- **Affiliate Engine**: Added `src/data/affiliate-programs.json` and discovery UI.
- **Testing Infrastructure**: Added Vitest configuration with unit and integration tests for core logic.

## Test Coverage (Phase 14+)

**Baseline (2026-04-30):** 1843 test files, 1812 pass (165 files, 31 tests skipped), 24.87% line coverage.

**Current (2026-05-11):** ~2548 tests (+502 new) from tree/handover/ + tree/audit/ contract pinning tests. Mock patterns standardized:
- `vi.hoisted()` for module-level fetch/SDK mocks
- Class-constructor mocking for SDK initialization tests
- `vi.stubEnv()` for environment isolation per test

See `docs/testing-guide.md` and `docs/code-standards.md` (Testing Standards section) for detailed patterns.

## Developer SOPs & CI Gates

**Canonical onboarding:** See [`docs/dev-sops.md`](./dev-sops.md) (10 sections, 277 LOC). Unified developer handbook covering environment setup, test suite, adding API routes, modifying layers, CF-direct deploy, git workflow, debugging, project structure, CI gates, security checklist. Adapted from mekong-cli for sophia's stack.

**5 Enforcement gates (Wave 26, Phase 2):**
| Gate | Command | Description |
|------|---------|---|
| G1 | `npm run ci:typecheck` | TypeScript strict check (0 errors required) |
| G2 | `npm run ci:lint` | ESLint (0 errors + warnings via --max-warnings=0) |
| G3 | `npm run ci:test` | Vitest run (1398+ tests required to pass) |
| G4 | `npm run ci:secrets` | secretlint on src/ (prevent credential leaks) |
| G5 | `npm run ci:audit` | npm audit (high/critical vulns, non-blocking) |

Run all gates: `npm run ci` (sequential chain). Integrated via `.husky/pre-commit` (lint-staged on TSX) + `.husky/pre-push` (full test + audit).

**Setup:** `npm install` auto-initializes husky via `prepare` script. Git config scoped to `apps/sophia-ai-factory/.husky` (monorepo isolation).

## Layer Architecture & DI Pattern

**4-layer model** (seed → tree → forest → land): See [`docs/system-architecture.md`](./system-architecture.md) and [`.claude/rules/sophia-layer-architecture.md`](../.claude/rules/sophia-layer-architecture.md).

**DI Pattern (Wave 26, Phase 3):** Eliminated 3 of 4 seed→forest hard dependencies via dependency injection:
- **NEW `src/seed/types/quota-provider.ts`** — `QuotaProvider` interface (DI contract for quota lookup)
- **MOD `src/seed/auth/enriched-jwt.ts`** — `createEnrichedJwt()` accepts optional `quotaProvider?: QuotaProvider` param; defensive EMPTY_QUOTA fallback with logger.warn if undefined
- **MOD `src/seed/auth/better-auth-server.ts`** — Replaced static forest/tree imports with lazy `await import(...)` in Better Auth callbacks
- **Result:** `grep -rn "from ['\"]@/forest" src/seed/auth/` now returns 0 results

**Canonical patterns:**
- Layer boundaries enforced by ESLint `no-restricted-imports` rule (`.eslintrc.mjs`)
- Test fixtures inject DI providers via function params, not module-level mocks
- Forward reference in dev-sops SOP 4 ("Modify Layers") documents DI pattern adoption

## Tech Stack Details
- **Framework**: Next.js 16.1.6
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Server Actions + URL State
- **Database**: Airtable (via REST API)
- **AI Integration**: OpenRouter (LLM), ElevenLabs (TTS), D-ID / HeyGen (Video)
- **Testing**: Vitest, React Testing Library
