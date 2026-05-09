# Codebase Summary

**Last Updated:** 2026-05-08
**Version:** 1.14.26 (Wave 6: MCU monthly reset fix + agent-chat credit pre-deduct + API key rate limit + magic-link i18n + auth subscription insert + FREE100 verification)
**Recent Major Changes:** Wave 6 shipped (2026-05-08): (F-1) **P0 CRITICAL** MCU monthly reset cron fixed — users now receive correct tier-based monthly credits (BASIC=100, PREMIUM=500, ENTERPRISE=2000, MASTER=10000). (F-2) **P0 CRITICAL** Agent-chat SSE pre-deducts credit BEFORE LLM call to prevent cost-bomb; compensating transaction refunds on failure. (F-3) POST /api/v1/api-keys rate-limited 5 req/min per user. (F-4) Magic-link login bilingual (EN+VI). (F-5) Better-Auth subscription insert now includes user_id + tier='BASIC'. (F-6) FREE100 redeem requires emailVerified to block bot farming. 2810/2810 tests pass, 0 TS errors, 9.5/10 code quality. See `docs/project-changelog.md` for full details.

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
│       │   ├── db/            # D1 database client + queries
│       │   ├── utils/         # Shared utilities (to-error, formatters)
│       │   ├── security/      # API key validation, cron auth, HMAC
│       │   ├── types/         # Shared TypeScript interfaces + contracts
│       │   ├── config/        # Feature flags, tier config, environment
│       │   ├── auth/          # Better Auth server, JWT enrichment
│       │   ├── health/        # Health check endpoints
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

## Tech Stack Details
- **Framework**: Next.js 16.1.6
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Server Actions + URL State
- **Database**: Airtable (via REST API)
- **AI Integration**: OpenRouter (LLM), ElevenLabs (TTS), D-ID / HeyGen (Video)
- **Testing**: Vitest, React Testing Library
