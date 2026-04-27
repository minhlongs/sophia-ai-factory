# Codebase Summary

**Last Updated:** 2026-04-27
**Version:** 1.14.8 (B2 TypeScript Cleanup Complete — 462→0 Errors)

## Project Structure Overview

Sophia AI Video Factory is a Next.js 16 application structured around the App Router. It integrates with Airtable (data), n8n (automation), and various AI providers (OpenRouter, ElevenLabs, D-ID).

```
.
├── apps/sophia-ai-factory/    # Main application root
│   ├── docs/                  # Project documentation
│   ├── openclaw/              # OpenClaw affiliate engine integration
│   ├── plans/                 # Development plans and reports
│   ├── public/                # Static assets
│   ├── scripts/               # Utility scripts (setup, verification)
│   ├── workflows/             # n8n workflow JSON exports
│   └── src/                   # Source code
│       ├── app/               # Next.js App Router pages
│       ├── config/            # Configuration and feature flags
│       ├── data/              # Static JSON data (affiliate programs)
│       ├── lib/               # Shared utilities (Airtable, API clients)
│       └── types/             # TypeScript definitions
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
