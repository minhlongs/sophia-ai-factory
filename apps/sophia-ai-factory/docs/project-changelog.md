# Project Changelog

**Last Updated:** 2026-04-20 | **Current Version:** 1.12.2

---

## [2026-04-20] Phase 16 — toError() Slice 3 (Worker scope validated) (v1.12.2)

### Summary
Third migration slice of the `as Error` → `toError()` standardization. 29 sites normalized across 5 top-concentration files; Worker-scope `@/lib/*` alias validated for `toError` import.

### Changes
- `src/lib/audit/audit-query-logger.ts` — 7 sites migrated
- `src/worker/lib/realtime-alert-dispatcher.ts` — 6 sites migrated (Worker scope)
- `src/lib/auth/enriched-jwt.ts` — 6 sites migrated
- `src/worker/lib/r2-report-storage.ts` — 5 sites migrated (Worker scope)
- `src/lib/usage-metering/kv-metering-log-sync.ts` — 5 sites migrated (includes 2 `const err = error as Error` idiom conversions)

### Quality & Review
- Build: 0 new TypeScript errors on 5 edited files
- Tests: 1306/1306 pass (baseline unchanged — pure migration, no new/removed tests)
- Code Review: 9.8/10 APPROVE SHIP
- Cumulative since Phase 13: 92 `as Error` sites normalized via `toError()`

---

## [2026-04-20] Phase 15 — toError() PostgrestError Shape Preservation (v1.12.1)

### Summary
Phase 15 extended `toError()` utility (from Phase 13) to recognize and preserve Supabase `PostgrestError` shape (message/code/details/hint) for structured error logging.

### Changes

**Phase 15 — toError() PostgrestError Shape Preservation**
- Extended `src/lib/utils/to-error.ts` to recognize `{ message: string, code?, details?, hint? }` objects
- Previously collapsed to `Error("[object Object]")`; now returns `Error(message)` with supplementary fields as own-properties
- Enables structured logging of Supabase error context (code, details, hint) downstream
- Added 3 test cases: full PostgrestError shape, partial shape (code only), AuthError-like shape

### Quality & Review
- Build: 0 new TypeScript errors on changed files
- Tests: 1303 → 1306 (+3 new tests)
- Code Review: 9.7/10 APPROVE SHIP
- CI GREEN + Production HTTP 200

### Addendum — Phase 14 (earlier same day, already shipped)
Phase 14 was the second `toError()` migration slice: 34 `as Error` / raw-error sites → `toError()` across `realtime-tracker.ts`, `quota-checker.ts`, `report-delivery.ts`, `audit-writer.ts`, `realtime-alert-service.ts`. Code Review 9.6/10 APPROVE. See `plans/260419-2121-triet-tieu-no-ky-thuat/phase-14-to-error-slice-2.md`.

---

## [2026-04-20] Query Optimization & Discovery Rate Limiting (v1.12.0)

### Summary
R10 shipped two bundles: Query optimization fixes (M-1 timestamp bind + L-1 schema column alias) + Discovery endpoint rate limiting (L-3 bucket + audit event).

### Changes

**Bundle 10A — Query Performance & Bug Fixes**
1. **M-1 FIXED**: `created_at` → `ts >= ?` unix-ms bind across 3 callers
   - `src/lib/admin/monitoring-queries.ts:157,195` — Supervisor Agent event aggregation
   - `src/app/api/llm-trace-stats/route.ts:54` — LLM trace statistics export
   - Now hits `idx_signals_events_type_ts` for efficient filtering
2. **Latent Bug Fix**: `SELECT props` → `SELECT props_json AS props` in schema queries
   - Corrects column name mismatch (schema column is `props_json`)

**Bundle 10B — BYOK Loading & Discovery Rate Limiting** (Closes R9 L-1, L-3)
1. **L-1 FIXED**: BYOK skeleton loader width parity
   - `src/app/[locale]/dashboard/byok/loading.tsx` — visual consistency with live page
2. **L-3 FIXED**: NEW `RATE_LIMITS.discovery` bucket (30/60s)
   - Applied to `/api/discovery/score` and `/api/discovery/*` endpoints
   - Stricter than default due to OpenRouter cost exposure
3. **Audit Event**: `DISCOVERY_SCORE_REQUESTED` added to `signals_events` catalog
   - Enables admin observability on niche-scoring operations

### Post-Review Audits
- INFO-1 AUDITED: Middleware matcher excludes `/api/*` correctly
  - `/api` branch in `src/app/middleware.ts` marked as dead code
  - Fix deferred to R11 (HIGH risk of collateral RaaS/tenant-isolation double-apply)

### Test Results
- Tests: 1326 → 1328 (+2 new tests)
- All existing tests remain passing
- No breaking changes

### Quality & Review
- Review Score: 9.6/10 SHIP
- Severity: 0 critical, 0 high
- Deferred: `/api/*` dead code cleanup (R11), middleware matcher audit (future)

---

## [2026-04-18] BYOK Admin Polish & Discovery Score Endpoint (v1.11.0)

### Summary
R9 shipped two bundles: BYOK admin refinements (rate-limit strict bucket, sidebar icon upgrade, skeleton loader, monitoring aggregator) + new `/api/discovery/score` POST endpoint for user-authenticated program niche scoring via BYOK resolver.

### Changes

**Bundle 9A — BYOK Admin Polish** (Closes R8 L-1/L-2/L-3/INFO-2)
1. **Middleware Rate Limiting**: `/api/user/byok` routed to `RATE_LIMITS.auth` (stricter bucket, default inheritance)
2. **Dashboard Icon**: BYOK sidebar icon upgraded from `KeyRound` → `KeySquare` (differentiates from RaaS API Keys)
3. **Loading State**: NEW `src/app/[locale]/dashboard/byok/loading.tsx` — server component skeleton loader (~28 LOC)
4. **Admin Monitoring**: `src/lib/admin/monitoring-queries.ts` → `aggregateByokEvents(hoursBack = 24)` returning `{ setCount, clearCount, netChange }` (+7 tests)

**Bundle 9B — /api/discovery/score Endpoint** (Closes R7 L-2)
1. **Route**: NEW `src/app/api/discovery/score/route.ts` — auth-required POST endpoint
2. **Wiring**: Calls `enhanceNicheScoreWithAI(program, niche, user.id)` — user.id flows through BYOK resolver
3. **Validation**: Zod schema enforces `program.id` + `program.name` (required), `program.category` (optional), `niche` (1–200 chars)
4. **Error Handling**: 401 (auth), 400×4 (input validation), 200 (success), 500 (server error) — 8 test cases

### Post-Review Fixes Applied (H-1 + M-2)
- Docstring corrected: rate-limit inherits default `RATE_LIMITS.api` (not discovery bucket — does not exist yet)
- `ProgramSchema`: added `category: z.string().optional()`

### Test Results
- Tests: 1311 → 1326 (+15 new tests)
- Bundle 9A: 3 new tests (monitoring aggregator)
- Bundle 9B: 8 endpoint tests + 4 utility tests
- All existing tests remain passing
- No breaking changes

### Quality & Review
- Review Score: 9.3/10 SHIP (post-fix)
- Severity: 0 critical, 0 high
- Reviewer feedback: defer H-1/M-2 to future sprint (rate-limit metrics + alternative routing)

### Deferred (Future Phases)
- `/api/discovery/*` full suite (currently only `/score` implemented)
- Alternative program routing (e.g., weighted by category)
- Rate-limit metrics dashboard integration

---

## [2026-04-17] Supervisor Agent MVP — Linear 3-Step Workflow Orchestrator (v1.10.0)

### Summary
Supervisor Agent shipped: autonomous workflow orchestrator managing 3-step pipeline (plan → execute → test) on Cloudflare Workers edge. D1 + Cron stepper (`*/1 * * * *`). Dashboard with real-time timeline. 4 signal events. MVP stubs ready for Phase 2 PEV engine integration.

### Changes
1. **D1 Migration** — `workflows` table (0007-workflows.sql)
   - id, org_id, mission_id, parent_mission_id, status (PLANNING|EXECUTING|TESTING|COMPLETED|FAILED)
   - current_step (PLAN|EXECUTE|TEST), plan_prompt, step_result, error_message
   - Timestamps: created_at, updated_at, completed_at

2. **API Endpoints** (4 routes, all auth-gated)
   - `POST /api/raas/workflows` — Create workflow
   - `GET /api/raas/workflows` — List all for org (paginated)
   - `GET /api/raas/workflows/[id]` — Detail + timeline
   - `GET /api/cron/workflow-stepper` — Internal cron (automatic, */1 * * * *)

3. **Cron Stepper** — Cloudflare Workers trigger
   - Runs every 1 minute: fetches active workflows, executes appropriate step
   - MVP step implementations: write `"Step {type} completed: {prompt[:100]}"`
   - Error handling: catch exceptions, set status=FAILED, emit signal

4. **Dashboard UI** (2 pages)
   - `/dashboard/workflows` — List with status badges, 3s polling
   - `/dashboard/workflows/[id]` — Detail with timeline, step results (JSON expandable)

5. **Signal Events** (4 types, appended to signals_events table)
   - WORKFLOW_STARTED, STEP_COMPLETED, WORKFLOW_COMPLETED, WORKFLOW_FAILED

6. **Documentation**
   - NEW: `docs/sophia-supervisor-agent-runbook.md` (344 LOC, bilingual VN+EN)
     - Architecture, API reference, cron stepper behavior, troubleshooting, manual ops, rollback
   - UPDATED: `docs/system-architecture.md` (+45 lines, Supervisor Agent section)
   - UPDATED: `docs/project-changelog.md` (this entry)

### Test Results
- All workflow routes tested (create, list, detail)
- Cron stepper tested (fetches/updates workflows)
- Dashboard components tested (polling, timeline rendering)
- No breaking changes to existing RaaS API

### Phase 2 Deferred (NOT in MVP)
- Real executeStep implementation (integrate PEV engine)
- Manual workflow retry button
- Admin workflow reset endpoint
- WebSocket real-time updates (currently 3s polling)

---

## [Unreleased] - v1.9.0

### v1.9.0 - Polar→NOWPayments Migration Complete (2026-04-10)
- **Breaking Change**: Removed Polar.sh payment provider entirely. All payment processing now via NOWPayments (USDT TRC20).
- **Code Removed** (35+ files):
  - All Polar SDK client code, config, and types
  - Polar webhook handler (`/api/webhooks/polar`)
  - Stripe integration (metered billing, invoices, payment-status)
  - Daily usage export cron jobs
  - Admin billing reconciliation routes and quota enforcement
- **Code Added**:
  - NOWPayments IPN webhook handler (`/api/webhooks/nowpayments`)
  - HMAC-SHA512 signature verification for webhooks
  - Order ID format: `sophia_{orgId}_{timestamp}` for idempotency tracking
  - Tier-to-invoice-ID mapping in `nowpayments-client.ts`
- **Updated Components**:
  - Middleware whitelists: `/api/webhooks/polar` → `/api/webhooks/nowpayments`
  - Subscription gate, RaaS gate, agency isolation validators
  - Payment service abstraction layer (mock + real implementations)
  - Billing types to match NOWPayments IPN payload structure
- **Backup Provider**: PayOS (payos.vn) configured for Vietnam domestic payments
- **Security**: All Polar credentials removed from environment. NOWPayments API key + IPN secret only.
- **Test Impact**: 47 tests removed (Polar-specific), 52 new NOWPayments webhook tests added

### v1.8.0 - Usage Metering & License Gating (2026-03-07)
- **Feature:** Usage Metering Aggregator with time-windowed summaries
- **API Endpoints:**
  - `/api/usage/summary` - Get aggregated usage by period (hourly/daily breakdown)
  - `/api/usage/export` - Export usage data (CSV/JSON with 90-day validation)
  - `/api/v1/usage` (POST) - Batch ingestion endpoint (up to 1000 records/batch)
- **Architecture:**
  - Clean separation: Tracker (raw) → Aggregator (analytics) → Export (billing)
  - License-based quota enforcement (BASIC/PREMIUM/ENTERPRISE/MASTER)
  - CSV injection protection via `escapeCsvField`
- **Quotas by Tier:**
  - BASIC: 100 daily / 20 hourly / 500 requests / 2,000 monthly credits
  - PREMIUM: 500 daily / 100 hourly / 2,500 requests / 10,000 monthly credits
  - ENTERPRISE: 2,000 daily / 500 hourly / 10,000 requests / 50,000 monthly credits
  - MASTER: 10,000 daily / 2,000 hourly / 50,000 requests / 200,000 monthly credits
- **Batch Ingestion:**
  - Post records to `/api/v1/usage` with Zod validation
  - Validates timestamp (within 30 days), service enum, feature_key format
  - Returns per-record results with success/failure + quota remaining
- **Test Coverage:** 462 tests passing including aggregator and batch ingestion API

## v1.7.0 - Binh Pháp Full Automation (2026-02-05)
- **Architecture**: Implemented Service Factory Pattern (`src/lib/services`) decoupling business logic from external APIs.
- **DevEx**: Added **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for zero-cost, offline development.
- **CI/CD**: Full GitHub Actions pipeline with Lint, Type-Check, Unit Tests, and Playwright E2E tests.
- **Quality**: Enhanced `verify.sh` with security audit and build verification.
- **Production**: Added `infra-sync.sh` for idempotent infrastructure setup and `smoke-test.ts` for live verification.

## v1.6.0 - Production Readiness
- **Feature**: Comprehensive CLI Production Setup Wizard (`npm run setup:production`).
- **Automation**:
  - **Polar.sh**: Automated product provisioning and webhook setup.
  - **Supabase**: Connection verification and table existence checks.
  - **Telegram**: Bot token validation and automated webhook configuration.
- **DX**: Interactive terminal UI for environment variable management and system verification.
- **Reporting**: Generates detailed markdown reports on system health status.

## v1.5.0 - HeyGen Integration
- **Feature**: Full integration with HeyGen API for high-quality avatar videos.
- **Architecture**: Direct server-side API proxy for secure key handling.
- **UI**: Interactive Video Preview component with status tracking (Draft, Queued, Processing, Completed).
- **Testing**: Complete test coverage for API client and UI components (29 tests passed).
- **DX**: Added `src/lib/heygen` client library with type-safe interfaces.

## v1.4.0 - Tier Validation System
- **Feature**: Comprehensive Tier Validation System for feature gating.
- **Enforcement**:
  - **Tier Guard Middleware**: Protects API routes based on user subscription level.
  - **Limit Checking**: Enforces limits on YouTube channels (1/3/Unlimited) and Templates (5/Unlimited/Unlimited).
  - **API Gating**: Restricts access to advanced endpoints for lower tiers.
- **UI Components**:
  - **Upgrade Banner**: Context-aware prompts to upgrade when hitting limits.
  - **Feature Locks**: Visual indicators for locked premium features (Affiliate Engine, ROI Calculator).
- **Security**: Server-side validation ensures client-side bypasses are impossible.

## v1.3.0 - Mobile Command Center
- **Feature**: Full Telegram Bot integration for remote campaign management.
- **Commands**:
  - `/start`: Bot initialization and welcome.
  - `/email`: Secure account linking via email verification.
  - `/campaign`: Instant campaign creation from mobile.
  - `/status`: Real-time progress monitoring.
  - `/results`: Access to completed video assets.
- **Security**: Webhook secret validation and role-based access control.
- **Infrastructure**: Integrated with Inngest event bus for asynchronous processing.

## v1.2.0 - Monetization Release
- **Feature**: Full payment infrastructure integration with Polar.
- **Feature**: Automated provisioning of pricing tiers.
- **Security**: Webhook signature verification for payment events.
- **UX**: Seamless checkout flow from pricing page.

## v1.1.0 - User Settings & Health Monitoring
- **Feature**: Complete User Settings implementation with secure API key storage.
- **Feature**: System Health Dashboard for real-time monitoring of infrastructure.
- **Security**: AES-256-GCM encryption for all stored API keys.
- **UX**: Theme management (Light/Dark mode) persisted to user profile.

## v1.0.2 - Bootstrap Review Complete
- **Status**: Validated core pipeline functionality.
- **Docs**: Finalized roadmap and architecture documentation.
- **Testing**: Confirmed test suite coverage for validation and webhooks.

## v1.0.1 - Post-Bootstrap Refinement
- **Refactor**: Modularized Setup Wizard into step components for better maintainability.
- **Security**: Added production guard for `.env.local` writing in API routes.
- **Testing**: Added unit tests for validation services and integration tests for Polar webhooks.

## v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

## v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
