# Project Roadmap

**Project Name:** Sophia AI Video Factory
**Current Version:** 1.14.15 (TIER-2 Security & Observability Overhaul SHIPPED)
**Last Updated:** 2026-04-28

## 📅 Roadmap Overview

### ✅ Phase 1: Foundation (Completed)
**Goal:** Establish the core architecture and UI framework.
- [x] Next.js 16 App Router setup with TypeScript.
- [x] Tailwind CSS 4 & Geist UI implementation.
- [x] Core component library (`src/app/components/ui`).
- [x] Basic routing and layouts.

### ✅ Phase 2: Turnkey Wizard (Completed - Current Release)
**Goal:** Enable "Zero-Code" onboarding for non-technical users.
- [x] **Setup Wizard**: Interactive 4-step configuration flow.
- [x] **Middleware**: Auto-redirect for unconfigured instances.
- [x] **Verification**: Real-time validation of OpenRouter, ElevenLabs, D-ID keys.
- [x] **Airtable Integration**: Template copying and connection verification.
- [x] **CLI Tools**: `setup.sh` and `verify.sh` for easy installation.
- [x] **Affiliate Engine**: Product discovery UI with JSON data source.

### ✅ Phase 3: Core Pipeline (Completed)
**Goal:** Wire up the "Brain" to the "Body" (Frontend to n8n Automation).
- [x] **Dashboard UI**:
  - [x] Project list view with status badges.
  - [x] Create Project form (Topic & Audience).
  - [x] Real-time status polling.
- [x] **User Settings & Security**:
  - [x] User Profile Management (`/dashboard/settings`).
  - [x] Secure Encrypted API Key Storage (AES-256-GCM).
  - [x] Theme Management (Dark/Light Mode).
  - [x] Notification Preferences (Email/Telegram).
- [x] **Script Generation**:
  - [x] Connect `Generate Script` button to `/api/generate-script` (via Server Action).
  - [x] Poll Airtable for script status updates (Implemented in UI).
  - [x] Display generated scripts in Dashboard.
- [x] **Video Rendering**:
  - [x] Connect `Render Video` button to `/api/render-video` (via Server Action).
  - [x] Handle async status (Processing -> Completed) (Implemented in UI).
  - [x] Video player integration in Dashboard.
- [x] **Workflow Polishing**:
  - [x] Configure n8n workflows (External).
  - [x] Refine n8n prompts for better script quality.
  - [x] Add error handling for automation failures.
  - [x] **Production Monitoring**:
    - [x] System Health Dashboard (`/dashboard/system-health`).
    - [x] Health Check API (`/api/health`).

### ✅ Phase 4: Monetization (Completed → v1.9.0: Upgraded to NOWPayments)
**Goal:** Implement payment processing and tier-based access control.
- [x] **Payment Provider Evolution**:
  - [x] Phase 4a: Polar Integration (v1.2.0 - v1.8.0) — Later deprecated due to product classification issue
  - [x] Phase 4b: NOWPayments Integration (v1.9.0) — USDT TRC20 crypto payments
- [x] **NOWPayments Setup**:
  - [x] Pre-created invoice IDs (BASIC, PREMIUM, ENTERPRISE, MASTER tiers)
  - [x] HMAC-SHA512 signature verification for IPN webhooks
  - [x] IPN webhook handler (`/api/webhooks/nowpayments`) with idempotency tracking
- [x] **Tiered Pricing**:
  - [x] 4-Tier Model: BASIC ($199), PREMIUM ($399), ENTERPRISE ($799), MASTER ($4,999)
  - [x] Feature gating logic in `src/config/tiers.ts`.
- [x] **Tier Enforcement System**:
  - [x] **Tier Guard Middleware**: Server-side checks for API routes.
  - [x] **UI Gating**: Upgrade banners and disabled states for locked features.
  - [x] **Limit Validation**: Enforcement of channel and template limits.
- [x] **Webhooks**:
  - [x] Secure IPN webhook handler with HMAC-SHA512 signature verification
  - [x] Order ID idempotency tracking (`sophia_{orgId}_{timestamp}`)
  - [x] Automatic subscription status updates in Supabase on payment completion
- [x] **Backup Payment Provider**:
  - [x] PayOS (payos.vn) configured for Vietnam domestic payments as fallback
- [x] **UI Integration**:
  - [x] Pricing page with NOWPayments checkout link integration
  - [x] Loading states and error handling during payment flow
- [x] **Code Cleanup (v1.9.0)**:
  - [x] Removed 35+ Polar SDK files, config, and webhook handlers
  - [x] Removed Stripe metered billing integration
  - [x] Removed daily usage export and admin billing routes

### ✅ Phase 5: Mobile Command Center (Completed)
**Goal:** Enable remote campaign management via Telegram.
- [x] **Bot Infrastructure**:
  - [x] Webhook handler with security validation (`X-Telegram-Bot-Api-Secret-Token`).
  - [x] Bi-directional messaging service.
- [x] **User Linking**:
  - [x] `/email` command to link Telegram ID to Supabase User securely.
- [x] **Campaign Management**:
  - [x] `/campaign <topic>` to trigger new video generation.
  - [x] `/status` to poll active job progress.
  - [x] `/results` to retrieve completed video links.
- [x] **Integration**:
  - [x] Connected to Inngest event bus (`campaign.created`).
  - [x] Real-time updates from core pipeline.

### ✅ Phase 6: Enterprise Video Engine (Completed)
**Goal:** High-fidelity AI video generation with HeyGen.
- [x] **Direct API Integration**:
  - [x] Robust HeyGen Client (`src/lib/heygen`).
  - [x] Server-side API Routes (`/api/heygen/*`) for secure communication.
- [x] **Asset Management**:
  - [x] Avatar Library browser.
  - [x] Voice Selection interface.
- [x] **Video Generation Pipeline**:
  - [x] Direct video creation job submission.
  - [x] Real-time status polling mechanism.
  - [x] Video Preview UI with playback and download.
- [x] **Testing & Quality**:
  - [x] Comprehensive unit and integration test suite (100% pass rate).

### ✅ Phase 7: Production Readiness (Completed)
**Goal:** Streamlined deployment and verification for production environments.
- [x] **Production Setup Wizard**:
  - [x] CLI-based interactive wizard (`npm run setup:production`).
  - [x] Automated environment variable verification.
  - [x] **Polar.sh Integration**: Product synchronization and connection check.
  - [x] **Supabase Integration**: Connection test and table verification.
  - [x] **Telegram Integration**: Bot verification and webhook configuration.
- [x] **E2E Verification**:
  - [x] Final system health check report generation.

### ✅ Phase 8: Binh Pháp Automation (Completed)
**Goal:** Achieve "Click-to-Ship" maturity with zero-touch CI/CD and Mock Mode.
- [x] **Mock Infrastructure (Zero-Cost Dev)**:
  - [x] Service Factory Pattern (`src/lib/services`) for DI.
  - [x] `MockHeyGenClient` & `MockPaymentService` implementation.
  - [x] `npm run dev:mock` for offline development.
- [x] **CI/CD Pipeline**:
  - [x] GitHub Actions with Quality, Test, and Security gates.
  - [x] Playwright E2E tests running against Mock Services.
  - [x] Vercel Preview Deployments on PRs.
- [x] **Deployment Automation**:
  - [x] Idempotent infrastructure sync (`scripts/sync-polar.ts`).
  - [x] Automated Vercel project setup (`setup-vercel.sh`).
- [x] **Green Gate Verification**:
  - [x] Post-deploy smoke tests (`scripts/smoke-test.ts`).
  - [x] Automated rollback triggers.

### ✅ Phase 9: Usage Metering & License Gating (Completed)
**Goal:** Usage tracking, quota enforcement, and analytics for license-based pricing.
- [x] **Usage Aggregator**: Core aggregation logic with hourly/daily windows
- [x] **Quota Enforcement**: License-based limits by tier (BASIC/PREMIUM/ENTERPRISE/MASTER)
- [x] **API Endpoints**: `/api/usage/summary` and `/api/usage/export`
- [x] **Export Utilities**: CSV export with injection protection, 90-day range validation
- [x] **Type Safety**: Full TypeScript type definitions for metering system
- [x] **Batch Ingestion**: `/api/v1/usage` POST endpoint (up to 1000 records/batch)
- [x] **Validation**: Zod schema validation for timestamp, service, feature_key
- [x] **Test Coverage**: 462 tests passing (aggregator + batch ingestion API)

### ✅ Phase 9.1: BYOK Admin Polish (Completed - 2026-04-18)
**Goal:** Refine BYOK user experience and monitoring capabilities.
- [x] **Rate Limiting**: `/api/user/byok` routed to `RATE_LIMITS.auth` (stricter bucket)
- [x] **Dashboard UI**: BYOK sidebar icon upgrade (KeyRound → KeySquare, differentiates from RaaS)
- [x] **Loading State**: NEW skeleton loader component for async BYOK operations
- [x] **Admin Monitoring**: `aggregateByokEvents(hoursBack)` helper for dashboard insights
- [x] **Closes**: R8 L-1, L-2, L-3, INFO-2

### ✅ Phase 9.2: Discovery Score Endpoint (Completed - 2026-04-18)
**Goal:** User-authenticated program niche scoring via BYOK resolver.
- [x] **Route**: NEW `/api/discovery/score` POST endpoint (auth-required)
- [x] **Wiring**: `enhanceNicheScoreWithAI(program, niche, user.id)` — BYOK-aware
- [x] **Validation**: Zod schema (program.id, program.name required; category optional; niche 1–200 chars)
- [x] **Error Handling**: 401/400/200/500 status codes with 8 test cases
- [x] **Closes**: R7 L-2

### ✅ Phase 10: Supervisor Agent MVP (Completed - 2026-04-17)
**Goal:** Autonomous workflow orchestration for mission planning, execution, testing.
- [x] **D1 Schema**: workflows table with status state machine (PLANNING → EXECUTING → TESTING → COMPLETED)
- [x] **API Layer**: POST/GET /api/raas/workflows, workflow detail endpoint
- [x] **Cron Stepper**: Cloudflare Workers trigger (*/1 * * * *) for autonomous step execution
- [x] **Step Implementation**: 3-step pipeline (plan → execute → test) with MVP stubs
- [x] **Signal Events**: WORKFLOW_STARTED, STEP_COMPLETED, WORKFLOW_COMPLETED, WORKFLOW_FAILED
- [x] **Dashboard UI**: Workflow list + detail views with real-time timeline
- [x] **Documentation**: Bilingual runbook (344 LOC, architecture, troubleshooting, manual ops, rollback)
- [x] **Test Coverage**: All workflow routes + cron stepper + UI components tested

### ✅ Phase 10.1: Query Optimization & Performance Hardening (Completed - 2026-04-20)
**Goal:** Fix timestamp filtering and schema consistency across monitoring + trace aggregation.
- [x] **M-1 FIXED**: `created_at` → `ts >= ?` unix-ms bind in monitoring queries (2 callers)
- [x] **M-1 FIXED**: `ts >= ?` unix-ms bind in LLM trace stats aggregation (1 caller)
- [x] **Query Index**: Now properly hits `idx_signals_events_type_ts` for efficient event filtering
- [x] **Latent Bug Fix**: `SELECT props` → `SELECT props_json AS props` schema alignment
- [x] **Test Coverage**: +2 tests for timestamp filtering edge cases

### ✅ Phase 10.2: Discovery Endpoint Rate Limiting & Audit Events (Completed - 2026-04-20)
**Goal:** Enforce strict rate limits on `/api/discovery/*` due to OpenRouter cost exposure + audit trail.
- [x] **L-1 FIXED**: BYOK skeleton loader width visual parity with live page
- [x] **L-3 FIXED**: NEW `RATE_LIMITS.discovery` bucket (30 requests/60s)
- [x] **Rate Limit Apply**: Assigned to `/api/discovery/score` and full `/api/discovery/*` scope
- [x] **Audit Event**: `DISCOVERY_SCORE_REQUESTED` added to `signals_events` event catalog
- [x] **Admin Observability**: Dashboard can now track niche-scoring frequency + cost exposure
- [x] **Deferred (R11)**: `/api/*` dead code cleanup in middleware (HIGH risk collateral damage)

### ✅ Phase 11: Multi-Tenant AI Agent Factory Infrastructure (Completed - 2026-04-25)
**Goal:** Transform Sophia from AI video tool into multi-tenant AI Company OS (Agent Factory).
- [x] **Phase 01 Seed**: Agent infrastructure
  - [x] D1 schema: `agent_teams`, `agents`, `agent_tasks`, `agent_logs` tables
  - [x] Agent runner orchestration service
  - [x] Task queue and state machine (pending → assigned → running → completed/failed)
  - [x] API routes: `/api/agents/*` (teams, agents, tasks, logs endpoints)
  - [x] 15 unit tests covering all infrastructure paths
- [x] **Phase 02 Tree**: Mission Control UI
  - [x] Natural language mission input interface
  - [x] AgentTeamPanel component for team visualization
  - [x] TaskFeed with Server-Sent Events (SSE) real-time updates
  - [x] i18n keys for Vietnamese/English support
- [x] **Phase 03 Forest**: Feedback Loop
  - [x] Agent signal events tracking (`created_at`, `agent_id`, `event_type`, `metadata`)
  - [x] A/B prompt variant system for LLM optimization
  - [x] Analytics card for mission performance metrics
  - [x] Feedback thumbs UI for user ratings
- [x] **Phase 04 Land**: Observability + AI CI/CD
  - [x] Enforcement gates (tier-based agent access: BASIC→1 agent, PREMIUM→5, ENTERPRISE→20, MASTER→unlimited)
  - [x] Agent health card in system-health dashboard
  - [x] Error enrichment with agent context (agent_id, mission_id, step_number)
  - [x] Signal events for agent lifecycle (startup, shutdown, error recovery)
- [x] **Testing**: 1394 tests pass (0 failures)
- [x] **Production**: HTTP 200, commit e6a180d8

### ✅ Phase 12: Sprint M — First-Dollar Revenue Path (Code-Shipped - 2026-04-27)
**Goal:** Complete affiliate monetization pipeline from product discovery to payout settlement.
**Status:** CODE-SHIPPED (5 commits) | Migrations applied to codebase | Deploy pending (remote D1 + Cloudflare Secrets)
- [x] **Phase M1: Revenue Pipeline Unblock**
  - [x] D1 migrations 0018-campaigns, 0019-raas-licenses, 0020-user-profiles-extend
  - [x] Campaigns table with checkpoint tracking
  - [x] Tests: 1406/1406 pass | Review: 9.6/10
  
- [x] **Phase M2: Kill ServiceFactory Auto-Mock Fraud**
  - [x] MissingCredentialsError + ServiceFactory.requireKey() enforcement
  - [x] Bilingual VI+EN refund notifications
  - [x] Tests: 1408/1408 pass | Review: 9.5/10

- [x] **Phase M3: Affiliate Link Injection**
  - [x] D1 migration 0021-affiliate-offers-selected + affiliate_clicks
  - [x] /api/r/[code] short-link endpoint (100/min rate limit)
  - [x] Telegram FSM offer picker + web dropdown offer selector
  - [x] Script CTA injection with affiliate URL
  - [x] Tests: 1416/1416 pass | Review: 9.4/10

- [x] **Phase M4: ClickBank Conversion Attribution**
  - [x] D1 migration 0022-affiliate-conversions (unique receipt+event_type)
  - [x] /api/webhooks/clickbank with HMAC-SHA1 signature verification
  - [x] 70/30 commission split (70% user, 30% Sophia)
  - [x] 1000/min rate limit per IP, TEST events marked untrackable
  - [x] Tests: 1416/1416 pass | Review: 9.5/10

- [x] **Phase M5: User Wallet + Manual Payout Dashboard**
  - [x] D1 migrations 0023-user-wallets, payouts, user-payout-settings
  - [x] Hourly wallet rebuild cron (aggregates conversions with 60-day clearance)
  - [x] Daily clearance-promotion cron (pending→available)
  - [x] /api/user/wallet (session auth) + /api/admin/payouts/* (admin role)
  - [x] Dashboard pages /dashboard/wallet + /admin/payouts
  - [x] Atomic UPDATE-RETURNING with reconciliation revert pattern
  - [x] Telegram notifications on payout approval
  - [x] Tests: 1564/1564 pass (+151) | Review: 9.3/10

- [x] **Protected Flows Validation**: Setup Wizard, Telegram Bot (@Sophia_Bbot), NOWPayments IPN — all GREEN
- [x] **Test Summary**: 1413 → 1564 tests (+151, 100% pass rate)
- [x] **Type Safety**: 0 TypeScript errors
- [x] **Deploy Status**: Code complete; awaiting remote D1 apply + 9 Cloudflare Secrets

### ✅ TIER-2: Security & Observability Hardening (Code-Shipped - 2026-04-28)
**Goal:** Enterprise-grade security posture + observability infrastructure (9 sub-phases).
**Status:** SHIPPED | Production: SHA 4b5fa5c9 | Tests: 1673/1673 pass (100%) | Score: 88 → 94.5/100

- [x] **TIER-2A: Type Safety** — 34 → 0 TypeScript errors; `ignoreBuildErrors: false`
  - Target ES2020 for BigInt; added explicit return types; cast patterns
  - Tests: 1673 pass | Build: 0 errors
  
- [x] **TIER-2B: API Auth Audit** — 153 routes audited; 15 gaps identified; 5 critical routes gated
  - 119 properly auth'd (session/JWT/admin/api-key), 4 webhooks, 19 cron, 14 public, 15 gaps
  - Critical: C1 (db-schema), C2 (migrate), C3 (usage/debug), H6 (graphql) documented
  - Tests: audit report + gap recommendations
  
- [x] **TIER-2C: MFA/2FA** — TOTP RFC 6238 + backup codes
  - 6-digit TOTP, SHA1, 30s period, issuer "Sophia AI Factory"
  - Backup codes: 8 unique XXXX-XXXX, SHA-256 hashed
  - D1 migration 0028-mfa-secrets, 3 API routes (/setup, /verify, /disable), settings page
  - i18n: +20 keys (en, vi)
  - Tests: 17 pass | Gap: TOTP secret unencrypted at app layer (D1 encrypts at infra)
  
- [x] **TIER-2D: Observability** (from prior sprint) — Sentry SDK + health probes
  - @sentry/nextjs v8 + sourcemap upload via CI
  - D1/R2/KV liveness probes, structured logger, release tag = git SHA
  - Tests: 1604 pass
  
- [x] **TIER-2E: Content Security Policy (CSP) Nonce** — XSS prevention
  - Middleware generates nonce, injects `Content-Security-Policy` + `x-csp-nonce` headers
  - Server Components read via `getCspNonce()` helper
  - Fallback: `'unsafe-inline'` when nonce absent (static gen)
  - Tests: 13 pass | Protected: JSON-LD, Next.js runtime scripts
  
- [x] **TIER-2F: Cron Tracking** — Heartbeat log + idempotency guard
  - D1 migration 0026-cron-run-log: 1 row per cron (upsert pattern)
  - `recordCronRun(db, name, status, error?)` + 5-min idempotency window
  - `wasRecentlyRun()` fail-open on DB error (never blocks cron)
  - Tests: 9 pass | Heartbeat wired; 13 crons deferred
  
- [x] **TIER-2G: CSRF Protection** — Double-submit cookie
  - Token in `csrf-token` cookie (SameSite=Strict, httpOnly=false)
  - Client echoes in `x-csrf-token` header; constant-time XOR compare
  - Bypass: GET/HEAD/OPTIONS, /api/auth/*, /api/webhooks/*, /api/cron/*
  - Tests: 21 pass | 6 callers need header sweep (deferred enforcement)
  
- [x] **TIER-2H: Data Quality** — Audit logging + constraint validation
  - D1 migration 0027-data-quality-audit: `audit_log` table + composite index
  - `recordAudit(db, table, rowId, action, before, after)` fire-and-forget
  - TierEnum + AuditActionSchema Zod validation
  - Tests: 9 pass | Wired: subscription activation
  
- [x] **TIER-2I: Disaster Recovery** — RTO/RPO runbook + backup scripts
  - Docs: `docs/disaster-recovery.md` (272 lines, bilingual, RTO/RPO table)
  - 4 recovery scenarios: D1 corruption (30min), R2 failure (1h), code regression (15min), KV loss (2h)
  - Scripts: `d1-snapshot.sh`, `restore-from-snapshot.sh` (dry-run safe, idempotent)
  - Quarterly drill cadence + roles matrix
  
- [x] **TIER-2J: Infrastructure Hardening** — DNS/R2/GitHub secrets audit docs
  - Docs: `docs/infra-hardening.md` (260 lines, bilingual, rotation schedule)
  - 3 audit scripts: `audit-dns.sh`, `audit-r2-lifecycle.sh`, `audit-github-secrets.sh`
  - Rotation: 90-day (CLOUDFLARE, SENTRY, NOWPAYMENTS, OPENROUTER)
  - Incident response: <5min leak detection, <30min redeployment

- [x] **D1 Migrations**: 4 applied (0026-cron, 0027-audit, 0028-mfa, TIER-2B fixes)
- [x] **Test Summary**: 1673/1673 pass (0 regressions)
- [x] **Type Safety**: 0 TypeScript errors
- [x] **Protected Flows**: Setup Wizard, Telegram Bot, NOWPayments IPN — all GREEN
- [x] **Plan**: `plans/260428-2219-tier2-remaining-eight/plan.md`

## 🔧 Tech Debt Elimination Program (2026-04-19 → 2026-04-20)

### ✅ Phase 1: Console.log → Structured Logger (2026-04-20)
Eliminated all `console.log/warn/error` from production code (17 files, 34 statements). Migrated to `@/lib/logger` for observability stack integration (Langfuse, D1, Sentry). Tests: 1291 → 1297 (+6). Status: COMPLETE.

### ✅ Phase 2: D1 Migration & SQL Rate Limiter (2026-04-20)
Deployed D1 migrations (0013 rate_limits, 0014 export_jobs) to production. Refactored rate-limiter and api-key-validator to canonical D1 patterns. Tests: 1291/1328 pass. Status: COMPLETE.

### ✅ Phase 3: API Routes `:any` Reduction (2026-04-19)
Removed 26 TypeScript `:any` types from 14 API route files. Implemented strict patterns: `.single<T>()`, typed user_metadata casts. Tests: 1291/1328 pass. Status: COMPLETE.

### ✅ Phase 5: Phase 5 Review Nits + Telegram Module (2026-04-20)
Resolved Phase 5 nits (env-validation loop merge, provision HTTP codes) + eliminated 11 `eslint-disable @typescript-eslint/no-explicit-any` from telegram module (4 files). Fixed latent checkTierAccess bug with O(1) `TIER_RANK` map. Tests: 1297/1297 (100% pass). Status: COMPLETE.

### ✅ Phase 6: Logger Ergonomics + BotState Validation + Rate Limiter Observability (2026-04-20)
Delivered 3 quick wins: (1) new `logger.error()` overload with `{error?, ...metadata}` object form (backward-compatible); (2) `isBotState()` type guard + D1 state validation; (3) fail-open rate-limiter metrics emission. Tests: 1297/1297 (100% pass). Status: COMPLETE.

## 🔧 Admin Authentication Unification (TIER-2B — 2026-04-28)

### ✅ TIER-2B: Admin Auth Unification (2026-04-28)
**Goal:** Single-source admin authentication across 33+ API routes.

Converged fragmented auth patterns (Basic Auth via `checkAdminAuth` middleware, `x-admin-key` header, inline `isAdminAuthorized` checks) to unified `requireAdmin()` helper backed by Better Auth session + D1 role check. **Architecture:** New `src/lib/auth/require-admin.ts` (31 LOC) wraps session retrieval + role verification, returns `NextResponse` on unauthorized or `User` on success. Audit logging via `admin-audit-log.ts` (46 LOC). **Routes Unified:** 31 admin endpoints (licenses, audit, billing, dunning, quota, violations, api-keys, usage, invite) + 2 middleware files deleted. **Security posture lift:** Eliminates env-var dependencies (`ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY`). **Tests:** 4 new unit tests (require-admin.test.ts), 1588/1588 pass (+4). **Build:** 0 TS errors. Status: SHIPPED.

---

## 🔧 Observability Platform (TIER-2D — 2026-04-28)

### ✅ TIER-2D: Sentry + Health Probes + Structured Logger (2026-04-28)
**Goal:** Production observability with error tracking, health monitoring, and structured logging.

Integrated `@sentry/nextjs` v8 with auto-instrumentation (client/server/edge runtimes). Wrapped `next.config.ts` with `withSentryConfig` (telemetry off; source maps uploaded via CI script when token present; graceful skip without token). Enhanced `/api/health` with D1/R2/KV liveness probes (1500ms timeout, 30s cache). Structured logger at `@/lib/utils/logger-utility` with dynamic Sentry hook (error level only, no-op without SDK). Upgraded 4 of 5 `console.error` calls; 1 intentional fallback to prevent recursion. Release tag = git short SHA for deploy verification. **Score uplift:** ~83 → ~88/100 (observability front). **Tests:** 1604/1604 pass (+15 net). **Status:** SHIPPED.

**Remaining Tier-2:** 2A (TS strict), 2C (MFA), 2E (CSP headers), 2F (cron tasks), 2G (CSRF), 2H (data retention), 2I (DR plan), 2J (DNS validation).

---

### 🔮 Phase 11: Supervisor Agent Phase 2 (Future)
**Goal:** Real PEV (Prompt Execution Validator) engine + advanced features.
- [ ] **PEV Engine Integration**: Replace MVP stubs with real executeStep logic
- [ ] **Manual Workflow Controls**: Retry button, force-complete, reset endpoints
- [ ] **Advanced Filtering**: Status, date range, search in workflow list
- [ ] **Batch Operations**: Create multiple workflows, bulk status updates
- [ ] **Export & Analytics**: CSV export, workflow metrics dashboard
- [ ] **WebSocket Real-time**: Replace 3s polling with live updates

### 🔮 Phase 12: Scaling & SaaS (Future)
**Goal:** Multi-user support and advanced features.
- [ ] **Authentication**: Move from Basic Auth to NextAuth/Clerk.
- [ ] **Multi-Tenancy**: Support multiple user accounts per deployment.
- [ ] **Advanced Affiliate**: Real-time scraping of Amazon/ClickBank.
- [ ] **Social Publishing**: Auto-upload to YouTube/TikTok via API.
- [ ] **Analytics**: Deep dive into video performance metrics.

## Changelog

### v1.7.0 - Binh Pháp Full Automation
- **Architecture**: Implemented Service Factory Pattern (`src/lib/services`) decoupling business logic from external APIs.
- **DevEx**: Added **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for zero-cost, offline development.
- **CI/CD**: Full GitHub Actions pipeline with Lint, Type-Check, Unit Tests, and Playwright E2E tests.
- **Production**: Added `infra-sync.sh` for idempotent infrastructure setup and `smoke-test.ts` for live verification.

### v1.6.0 - Production Readiness
- **Feature**: Comprehensive CLI Production Setup Wizard (`npm run setup:production`).
- **Automation**: Polar.sh, Supabase, and Telegram automated configuration.
- **Reporting**: Generates detailed markdown reports on system health status.

### v1.5.0 - HeyGen Integration
- **Feature**: Full integration with HeyGen API for high-quality avatar videos.
- **Architecture**: Direct server-side API proxy for secure key handling.
- **UI**: Interactive Video Preview component with status tracking.
- **Testing**: Complete test coverage for API client and UI components.

### v1.4.0 - Tier Validation System
- **Feature**: Complete User Settings implementation with secure API key storage.
- **Feature**: System Health Dashboard for real-time monitoring.
- **Security**: AES-256-GCM encryption for API keys.
- **UX**: Theme management and Notification preferences.

### v1.0.2 - Bootstrap Review Complete
- **Status**: Validated core pipeline functionality.
- **Docs**: Finalized roadmap and architecture documentation.
- **Testing**: Confirmed test suite coverage for validation and webhooks.

### v1.0.1 - Post-Bootstrap Refinement
- **Refactor**: Modularized Setup Wizard into step components for better maintainability.
- **Security**: Added production guard for `.env.local` writing in API routes.
- **Testing**: Added unit tests for validation services and integration tests for Polar webhooks.

### v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

### v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
