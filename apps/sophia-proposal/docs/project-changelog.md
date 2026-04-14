# Sophia AI Factory — Project Changelog

All notable changes are documented here. Format: `[version] date — summary`.

---

## [3.2.0] 2026-04-14 — IDOR & CORS Security Hardening

### Fixed

**8 IDOR (Insecure Direct Object Reference) Vulnerabilities**

- `app/api/usage/route.ts` — Organization ID now derived from JWT token, not `x-org-id` header
- `app/api/affiliate/clicks/stats/route.ts` — Added org-scoped program filter, JWT-derived orgId
- `app/api/onboarding/status/route.ts` — JWT-derived orgId, verified org membership before returning status
- `app/api/feedback/route.ts` — JWT-derived orgId, feedback now org-scoped
- `app/api/proposals/generate/route.ts` — JWT-derived orgId, generation cost checked against org balance
- `app/api/onboarding/progress/route.ts` (GET + POST) — JWT-derived orgId, verified ownership of org
- `app/api/crm/callback/route.ts` — OAuth state parameter no longer used as orgId

**CORS Configuration Hardening**

- `next.config.js` — `Access-Control-Allow-Origin: *` (wildcard) removed
- Replaced with: `Access-Control-Allow-Origin: https://sophia.agencyos.network`
- Removed `X-Org-Id` from `Access-Control-Allow-Headers`

**JWT Implementation**

- `lib/db/auth.ts` — Removed duplicate `verifyJwt` function, now imports timing-safe version from `auth-verify.ts`
- All API routes use `resolveToken()` + `createAuthClient()` to extract user from JWT
- Server-side lookup `getOrgId(user.id, db)` ensures authorization

### Impact

**Security Improvement:** Attackers can no longer escalate privileges by forging `x-org-id` headers. Organization membership now cryptographically verified via JWT signature + database lookup.

**API Documentation Updated:**
- All endpoint examples show JWT-based auth (removed `x-org-id` from headers)
- Added security notes to affected endpoints
- CORS section documents origin restrictions

**Backward Compatibility:** None — `x-org-id` header is now ignored by all endpoints. Clients must rely on JWT cookie/Bearer auth only.

---

## [3.1.0] 2026-03-21 — Wave 2 RaaS Security & Rate Limiting

### Added

**Rate Limiting** (`lib/raas/rate-limiter.ts`)

- Sliding-window rate limiter enforced on all `/api/v1/*` endpoints
- Per-API-key limit: `raas_api_keys.rate_limit_per_minute` (default 60 req/min)
- In-process Map with timestamp bucketing + periodic stale cleanup
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- HTTP 429 on exceeded limit

**Webhook HMAC Signing** (enhanced `lib/raas/webhook-delivery.ts`)

- All webhook deliveries signed with HMAC-SHA256: `t={timestamp},v1={hmac}`
- Timestamp binding (unix epoch) prevents replay attacks (5min window)
- Constant-time comparison for secure verification
- ENV: `WEBHOOK_SIGNING_SECRET` (min 32 chars, `sk-webhook-*` prefix)

**New Mission Endpoints**

- `GET /api/v1/missions/:id` — Get mission status + result (rate limited)
- `POST /api/v1/missions/:id/cancel` — Cancel queued/planning, refund MCU (rate limited)
- `GET /api/v1/missions/:id/result` — Lightweight polling (202 in-progress, 200 done)

**Enhanced GTM Campaign** (updated `lib/raas/command-helpers.ts`)

- `gtm:campaign` now uses `OpenClawEngine.orchestrateSubMissions()` for proper sub-mission tracking
- Sequential + parallel dependency types fully supported
- Parent mission checks all siblings before marking complete

### Stats

- 1 new rate-limiter module
- 3 new mission endpoints
- Enhanced webhook security with cryptographic signing
- All endpoints rate limited; 72 total routes (no new count change)

---

## [3.0.0] 2026-03-21 — OpenClaw PEV Engine + RaaS Layer

### Added

**OpenClaw PEV Engine** (`lib/openclaw/`)

- `engine.ts` — `OpenClawEngine` class orchestrating the full Plan → Execute → Verify lifecycle per mission. Features: exponential-backoff retry, automatic MCU refund on permanent failure, sub-mission chaining (parallel + sequential via `dependency_type`), webhook notification on completion.
- `step-tracker.ts` — `StepTracker` class for per-step DB progress tracking. Writes full `execution_log` JSONB array back to `missions` table after each status mutation (`pending → running → done/failed`).
- `mission-queue.ts` — In-process concurrency limiter capping 3 concurrent missions per `org_id` (FIFO, no external broker). Exports `enqueueMission()` and `getQueuePosition()`.

**RaaS Layer** (`lib/raas/`)

- `api-key-manager.ts` — API key lifecycle: `generateApiKey()` (SHA-256 hash, `sk_live_` prefix, 48-char hex), `validateApiKey()` (hash lookup + expiry check), `createApiKey()`, `revokeApiKey()`, `listApiKeys()`. Raw key returned once; only hash stored.
- `command-helpers.ts` — Real execution handlers for: `proposal:create` (Supabase insert), `video:create` (HeyGen client), `crm:sync` (HubSpot), `analytics:export`, `content:blog`, `content:social`, `affiliate:generate`, `affiliate:scrape`, `sales:battlecard`, `gtm:campaign` (multi-sub-mission).
- `command-router.ts` — Routes `mission.command` string to correct handler in `command-helpers.ts`.
- `pev-executor.ts` — Entry point for `/api/raas/execute` internal endpoint.
- `usage-meter.ts` — Records every API call to `raas_api_usage` (endpoint, method, status_code, mcu_consumed, response_time_ms).
- `webhook-delivery.ts` — Async POST to `webhook_url` with exponential backoff; records delivery attempts to `raas_webhook_deliveries`.

**External API** (`app/api/v1/`)

- `missions/route.ts` — `GET` + `POST` endpoints authenticated via `Authorization: Bearer sk_live_xxxx`. POST: validates `missions:create` permission, checks MCU balance, reserves MCU via `debit_mcu_balance()` RPC, inserts mission, fires async PEV trigger to `/api/raas/execute`. GET: lists org missions with status filter and limit.

**RaaS Management API** (`app/api/raas/`)

- `keys/` — CRUD for API keys (session auth)
- `missions/` — Mission dashboard endpoint
- `usage/` — Usage statistics endpoint
- `templates/` — Mission templates listing
- `execute/` — Internal PEV trigger (guarded by `INTERNAL_API_SECRET`)

**Database Migrations**

- **Migration 011** — `missions` table ALTER: 5 new columns (`retry_count`, `max_retries`, `parent_mission_id`, `mcu_reserved`, `execution_log`). New tables: `mission_dependencies`, `mission_retries`.
- **Migration 012** — New tables: `raas_api_keys`, `raas_api_usage`, `raas_webhook_deliveries`.

### Stats

- 19 new files added
- 72 routes GREEN (build passing)
- 183 tests PASS
- 2 migrations (011, 012)

---

## [2.0.0] 2026-03-20 — Polar Billing + MCU Tracking + Pilot Onboarding (Sprint 3)

### Added

- NOWPayments billing integration: checkout, customer portal, webhook handler with HMAC verification + deduplication
- MCU balance system: `org_balances`, `usage_logs`, `credit_mcu_balance()` / `deduct_mcu_balance()` RPCs
- Subscription tiers: Starter ($49/500 MCU), Growth ($149/2000 MCU), Premium ($499/10000 MCU), Master ($999/25000 MCU)
- Pilot onboarding flow: checklist, NPS survey scheduling (Day 7), milestone tracking
- HTTP 402 middleware guard on zero balance
- Usage dashboard and summary endpoints

---

## [1.0.0] 2026-03-01 — Foundation (Sprints 1–2)

### Added

- Auth system: Supabase Auth + Next.js middleware, JWT sessions
- Organization management: `organizations`, `organization_members` tables, role-based access (admin/member)
- AI Proposal Engine: Anthropic Claude API, template system, quality checks, MCU deduction per generation
- Core API: auth, proposals CRUD, onboarding status, feedback
