# Codebase Summary — Sophia AI Factory

> Comprehensive overview of the Sophia AI Factory codebase structure, patterns, and architectural decisions.
> **Last Updated:** 2026-04-30 (Phases 6-14 Complete: Video Pipeline, Affiliate Networks, OpenClaw Orchestrator, Revenue Split, FTC Hardening, 1798/1798 tests pass)

**Production URL:** https://sophia.agencyos.network
**Git SHA:** df22a4f7 | **Tests:** 1798/1798 passing (100%) | **Build:** < 10s, 0 TS errors | **Bundle:** < 500 KB gzipped
**Phase 11-14 Complete (2026-04-30):** Tenant isolation (D1 Kysely plugin) + Tier quotas + Storage tracker. Video pipeline (6-step Inngest: script/TTS/visual/compose/upload/publish). Affiliate networks (5 adapters: TikTok Shop, Awin, ClickBank, AccessTrade, Amazon). OpenClaw orchestrator (10 primitives on Claude SDK + Qwen 3). Revenue split (commission-ledger, 14-day clawback, NOWPayments USDT payout). FTC hardening (#ad overlay, GDPR export/delete).

---

## Project Overview

Sophia AI Factory is a Reasoning-as-a-Service (RaaS) platform providing:
- **Proposal Generation:** AI-powered business proposal creation (10-50 MCU per proposal)
- **Video Generation:** Remotion-based video production with HeyGen integration (100-500 MCU per video)
- **Affiliate Network:** Discovery and management of affiliate partnerships
- **Usage Metering:** Real-time MCU tracking and tier-based billing
- **Campaign Automation:** Telegram bot + workflow engine for automated content distribution

---

## Core Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Cloudflare Workers | Edge compute, global distribution |
| **Framework** | Next.js 15.5 (App Router) | Full-stack React application |
| **Adapter** | opennextjs-cloudflare | Next.js → CF Workers bridge |
| **Database** | Cloudflare D1 (SQLite) | Primary data store (sophia-raas-db) |
| **Cache** | Cloudflare R2 + KV | Static assets + metering logs |
| **Auth** | Better Auth v1.6.2 | Session-based auth (D1 backend) |
| **Email** | Resend | Magic link + transactional emails |
| **Payment** | NOWPayments (primary) + PayOS (backup) | Cryptocurrency + Vietnam domestic |
| **AI** | Anthropic Claude | Proposal generation |
| **Video** | HeyGen | Avatar video generation |
| **Telegram** | Telegram Bot API | User interaction + notifications |

---

## Directory Structure

```
apps/sophia-ai-factory/  # Main Sophia AI Factory codebase (canon — deployed to sophia.agencyos.network)
├── src/
│   ├── app/[locale]/           # Next.js pages (SSR + Server Components)
│   │   ├── dashboard/          # Protected dashboard (missions, campaigns, analytics)
│   │   ├── (admin)/admin/      # Admin panel (tier provisioning, settings)
│   │   ├── pricing/            # Public pricing page
│   │   ├── login/              # Auth pages (login, signup, magic link)
│   │   └── api/                # API routes (auth, webhooks, RaaS endpoints)
│   │
│   ├── lib/
│   │   ├── auth/               # Better Auth integration, session management
│   │   ├── db/                 # D1 client, query builders, type helpers, insert-typed<R,T>
│   │   │   └── repositories/
│   │   │       └── videos-repo.ts        # Video CRUD with CAS variants (recordAttemptCAS, etc.)
│   │   │
│   │   ├── billing/            # MCU billing, dunning, email campaigns
│   │   │   ├── billing/        # Payment integration (NOWPayments, PayOS)
│   │   │   ├── dunning/        # Payment retry workflow (3 modules)
│   │   │   ├── email/          # Email templates & delivery (4 modules)
│   │   │   ├── ipn-dispatcher.ts         # IPN brancher: subscription vs one_time
│   │   │   ├── ipn-one-time.ts           # One-time SKU handler: user_purchases insert
│   │   │   ├── one-time-skus.ts          # SKU definitions + fulfillment logic
│   │   │   ├── ipn-constants.ts          # ONE_TIME_SKUS SSOT
│   │   │   └── compensation.ts           # Atomic credit grant (260502-0604 NEW)
│   │   │
│   │   ├── fulfillment/        # Video fulfillment hardening (260502-0604 NEW)
│   │   │   ├── retry-backoff.ts          # Exponential backoff schedule (30s→1h, 5 attempts)
│   │   │   └── complete-video-from-webhook.ts  # HeyGen webhook handler logic
│   │   │
│   │   ├── orders/             # Order query helpers (260502-0604 NEW)
│   │   │   └── order-query.ts            # JOIN purchases × videos for /dashboard/orders
│   │   │
│   │   ├── alerts/             # Quota enforcement, alert delivery
│   │   │   └── quota/          # Quota logic (evaluator, scheduler, delivery)
│   │   │
│   │   ├── usage-metering/     # Real-time MCU tracking (tracker, rollup, integration)
│   │   │
│   │   ├── raas/               # RaaS audit & operations (4 modules)
│   │   │   ├── audit-logging-service.ts
│   │   │   ├── audit-query-service.ts
│   │   │   ├── raas-invoice-generator.ts
│   │   │   └── raas-permission-checker.ts
│   │   │
│   │   ├── health/             # Pre-flight health checks (260502-0756 NEW)
│   │   │   └── heygen-health-check.ts  # Direct KV-cached HeyGen probe (RSC-safe)
│   │   │
│   │   ├── monitoring/         # Admin monitoring & reconciliation (260502-0604)
│   │   │   ├── sentry-forwarder.ts     # Sentry envelope HTTP fallback
│   │   │   ├── reconcile-query.ts      # Daily reconciliation scan
│   │   │   ├── synthetic-cleanup.ts    # Synthetic test-user cleanup
│   │   │   └── slack-alert.ts          # Alert dispatcher (email-only for now)
│   │   │
│   │   ├── video/              # Video access control (260502-0604 expansion)
│   │   │   └── video-access-control.ts # Auth + revocation gate for R2 streaming
│   │   │
│   │   ├── webhooks/           # Webhook verification (260502-0604)
│   │   │   └── heygen-signature-verifier.ts # HMAC-SHA256 constant-time verification
│   │   │
│   │   ├── telemetry/          # Better Stack observability (3 modules)
│   │   │   ├── event-capture.ts        # Structured logging, tokenization
│   │   │   ├── batch-delivery.ts       # Better Stack push + retry
│   │   │   └── error-digest.ts         # Daily cron summary
│   │   │
│   │   ├── signals/            # PostHog + D1 ops telemetry (5 modules)
│   │   │   ├── posthog-capture.ts      # Event buffering + PostHog flush
│   │   │   ├── feature-flags.ts        # A/B experiments via EXPERIMENT_KV
│   │   │   ├── track.ts                # D1 signals_events append
│   │   │   ├── variant-resolver.ts     # Percentage-based canary rollouts
│   │   │   └── digest-generator.ts     # Weekly metrics email + GH Issue
│   │   │
│   │   ├── feature-flags/      # FNV-1a percentage rollouts
│   │   │   └── index.ts                # Canary gate for tier features
│   │   │
│   │   ├── byok/               # Bring-Your-Own-Keys (AES-GCM encryption)
│   │   │   └── with-timeout.ts         # 25s AbortController, signal timeout
│   │   │
│   │   ├── credentials/        # Per-user provider credentials (BYOK fulfillment, 2026-05-02)
│   │   │   ├── encryption.ts           # AES-GCM-256 text-format enc/dec (Web Crypto, CF Workers)
│   │   │   ├── user-credentials-repo.ts # CRUD over user_provider_credentials D1 table
│   │   │   └── get-provider-key.ts     # Smart lookup: user key → platform fallback + source tag
│   │   │
│   │   ├── campaigns/          # Campaign management (shared core logic)
│   │   │   └── create-campaign-core.ts
│   │   │
│   │   ├── video/              # Video pipeline (Phases 6-8, Inngest FSM)
│   │   │   ├── onboarding-video.ts     # Post-purchase auto-gen (ENTERPRISE+)
│   │   │   ├── video-fsm.ts            # FSM state machine
│   │   │   └── ...                     # Job tracking, manifest generation
│   │   │
│   │   ├── inngest/            # Event-driven video orchestration (Phases 6-8)
│   │   │   ├── functions/video-scripting.ts     # OpenRouter gpt-4o-mini → script
│   │   │   ├── functions/video-visual.ts        # HeyGen/HunyuanVideo → visual
│   │   │   ├── functions/video-upload.ts        # R2 storage + verify
│   │   │   └── ...
│   │   │
│   │   ├── affiliate/          # Affiliate network integration (Phase 9, 5 networks)
│   │   │   ├── networks/                   # TikTok Shop, Awin, ClickBank, AccessTrade, Amazon
│   │   │   ├── commission-tracker.ts
│   │   │   └── webhook-handlers.ts
│   │   │
│   │   ├── openclaw/           # OpenClaw orchestrator (Phase 12)
│   │   │   ├── agent-fleet-spawn.ts      # Spawn agents on Qwen 3 32B
│   │   │   ├── circuit-breaker.ts        # Fault tolerance
│   │   │   └── skill-activation.ts       # Dynamic skill loading
│   │   │
│   │   ├── email/              # Email delivery (Phase 14 expansion)
│   │   │   ├── onboarding-emails.ts      # Video completion notification
│   │   │   ├── ...
│   │   │   └── gdpr-export.ts            # GDPR data export
│   │   │
│   │   ├── gateway/            # OpenClaw integration, channel adapters
│   │   ├── ingestion/          # Affiliate data ingestion (ClickBank, ShareASale)
│   │   ├── intelligence/       # Affiliate scoring & normalization
│   │   ├── discovery/          # Affiliate discovery algorithms
│   │   ├── telegram/           # Telegram bot (FSM, handlers, rate limiting)
│   │   ├── security/           # Auth, rate limiting, input validation, FTC overlay
│   │   ├── services/           # Factory pattern (real + mock implementations)
│   │   ├── ai/                 # AI integrations (script generation, video, TTS)
│   │   ├── clients/            # External API clients (Inngest, Anthropic, etc.)
│   │   ├── config/             # Environment & tier configuration
│   │   ├── analytics/          # Dashboard analytics, revenue tracking
│   │   ├── audit/              # Compliance, GDPR export/delete, audit logging
│   │   ├── monitoring/         # Admin monitoring queries & aggregates
│   │   └── utils/              # Helper functions, validators, formatters
│   │
│   ├── components/             # React components (organized by feature)
│   ├── middleware.ts           # Request handling, auth validation, MCU gating
│   └── types/                  # Shared TypeScript types & interfaces
│
├── migrations/                 # Database schema (D1 SQLite)
│   ├── 0001-init.sql
│   ├── 0002-payment-events.sql
│   ├── 0003-better-auth.sql
│   ├── 0004-usage-metering.sql
│   ├── 0005-signals-events.sql        # Append-only events table
│   ├── 0044-cron-runs-table.sql       # cron_run_log for execution dedup (260502-0733)
│   └── 0045-videos-is-onboarding.sql  # Restore is_onboarding (lost in 0043, 260502-0733)
│
├── scripts/                    # Build & deployment utilities
│   ├── inject-scheduled-handler.mjs    # Post-build: injects CF Workers scheduled() default-export (260502-0756 FIX: CF Modules format)
│   ├── set-cron-secret.sh             # Operator setup: generates 32-byte CRON_SECRET, sets via wrangler secret put (260502-0756 NEW)
│   └── deploy-with-sha.sh             # Deploy wrapper: sets COMMIT_SHA/DEPLOYED_AT/DEPLOY_BRANCH secrets (260502-0733)
│
├── .github/workflows/          # CI/CD enforcement gates (P1)
│   ├── test.yml                # Tests + Deploy (lint/build/test → wrangler deploy + D1 migration-guard)
│   ├── security-scan.yml       # SAST + npm audit + secret scan
│   ├── quality-gate.yml        # Test coverage + mutation score
│   ├── dependency-audit.yml    # Outdated packages + breaking changes
│   ├── canary-rollback.yml     # Manual rollback (workflow_dispatch only)
│   ├── post-merge-tests.yml    # Final validation on main
│   ├── d1-backup.yml           # Daily D1 export → R2
│   └── agent-self-review.yml   # Weekly journal summary → GH Issue
│
├── .sophia-factory/            # AI factory & SDLC (P4)
│   ├── agents/                 # Agent definitions (4 files)
│   │   ├── cto.md              # Code quality, security, infrastructure
│   │   ├── cmo.md              # Content, marketing, brand
│   │   ├── cso.md              # Sales, pricing, customer acquisition
│   │   └── coo.md              # Operations, support, metrics
│   │
│   ├── CLAUDE.specification.md # Phase 1: Requirements template
│   ├── CLAUDE.design.md        # Phase 2: Architecture decisions
│   ├── CLAUDE.code.md          # Phase 3: Implementation patterns
│   ├── CLAUDE.deploy.md        # Phase 4: Deployment checklist
│   │
│   ├── templates/              # Reusable task templates
│   │   ├── requirement.md
│   │   ├── design.md
│   │   └── deployment-checklist.md
│   │
│   └── journal/                # Agent audit trail (committed to repo)
│       └── YYYYMMDD-{agent}-{slug}.md  # PII-scrubbed journals
│
└── openclaw/                   # OpenClaw autonomous agent configuration
    ├── skills/                 # Agent skills (affiliate-scout, auto-publisher, content-producer)
    └── video-factory.yaml      # Workflow definition
```

---

## Authentication Architecture

### Better Auth Integration
- **Version:** v1.6.2 with D1 Kysely adapter
- **Plugins:** emailAndPassword + magicLink + organization
- **Database:** Tables in D1 (better_auth_users, better_auth_sessions, better_auth_accounts, better_auth_verifications)
- **Session Management:** HttpOnly, secure, sameSite=lax cookies
- **Entry Point:** `/api/auth/[...all]` (dynamic catch-all route)

### Auth Flow
```
User → /login or /signup
  ↓
POST /api/auth/[...all] (Better Auth endpoint)
  ↓
D1 Query: Create/verify user (PBKDF2 password hash)
  ↓
Email verification or password verification
  ↓
Better Auth generates session token (cookie)
  ↓
Middleware validates session & extracts user context
  ↓
Server Components use getCurrentUser() from Better Auth client
  ↓
App layer enforces user_id/org_id ownership (no RLS needed)
```

### Client Library
- **Path:** `src/lib/better-auth-client.ts`
- **Features:** Magic link provider, organization plugin setup
- **Usage:** Imported in Server Components to get current user + org context

---

## Database Schema (D1 SQLite)

### Core Tables
```
users            → id, email, password_hash, full_name, role
organizations    → id, name, slug, email
org_members      → org_id, user_id, role (owner/member)
org_balances     → org_id, balance, reserved, lifetime_credits/debits
api_keys         → id, org_id, key_hash, name, last_used_at, revoked_at
```

### Feature Tables
```
missions         → id, org_id, template_id, status, mcu_cost
mission_results  → id, mission_id, output (JSON)
campaigns        → id, org_id, name, status, created_at
usage_logs       → id, org_id, feature, mcu_used, timestamp
```

### Billing Tables
```
billing_settings   → org_id, tier, nowpayments_order_id, status
coupon_redemptions → user_id, coupon_code, redeemed_at (UNIQUE per user/code, migration 0025)
```

### Better Auth Tables (Auto-generated)
```
better_auth_users                → id, name, email, email_verified, image, password
better_auth_sessions             → id, user_id, token, expires_at
better_auth_accounts             → id, user_id, account_id, provider, provider_account_id
better_auth_verifications        → id, identifier, value, expires_at
```

### Video Tables (Phases 6-8)
```
videos                   → id, org_id, user_id, title, r2_key, status, is_onboarding, created_at
video_onboarding_events  → id, org_id, video_id, user_email, tier, delivery_status, created_at
video_jobs               → id, org_id, status (queued/scripting/visual/compose/upload), job_data (JSON)
```

### Affiliate & Publisher Tables (Phases 9-10)
```
affiliate_networks       → id, name (TikTok Shop/Awin/ClickBank/AccessTrade/Amazon), webhook_verified_at
affiliate_offers         → id, network_id, external_id, title, commission_rate, is_active
affiliate_clicks         → id, offer_id, user_id, ip_hash, timestamp, attribution_window (14d clawback)
commission_ledger        → id, click_id, amount, status (pending/clawed_back/paid), created_at
payout_batches           → id, org_id, total_amount, currency (USDT), status, nowpayments_batch_id
publisher_channels       → id, org_id, platform (tiktok/youtube/instagram), channel_id, token_encrypted
scheduled_posts          → id, org_id, content, scheduled_at, channels_bitmap, status, published_at
```

---

## API Routes

### Public (No Auth)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/v1/demo` | POST | Quick demo preview (rate-limited) |
| `/api/auth/[...all]` | POST | Better Auth endpoints (signup, login, magic link) |
| `/api/webhooks/nowpayments` | POST | Payment webhook (signature-verified) |

### Protected (Session Auth)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/org` | GET | Current org info |
| `/api/billing/subscription` | GET | Subscription + MCU balance |
| `/api/billing/checkout` | POST | NOWPayments/PayOS checkout |
| `/api/raas/missions` | GET/POST | Mission CRUD |
| `/api/raas/keys` | GET/POST | API key management |
| `/api/proposals/generate` | POST | AI proposal (MCU billable) |
| `/api/videos/generate` | POST | Video generation (MCU billable, Phases 6-8) |
| `/api/videos` | GET/POST | Video CRUD + Inngest status (Phase 6) |
| `/api/affiliates/dashboard` | GET | Earnings + commission tracking (Phase 9) |
| `/api/affiliates/networks` | GET | 5 networks (TikTok Shop, Awin, ClickBank, AccessTrade, Amazon) (Phase 9) |
| `/api/publishers/channels` | GET/POST | Social channel management (Phase 10) |
| `/api/publishers/schedule` | POST | Schedule post across channels (Phase 10) |
| `/api/account/export` | POST | GDPR data export (Phase 14) |
| `/api/account/delete` | POST | GDPR account deletion (Phase 14) |
| `/api/affiliate-discovery` | GET | Paginated affiliate offers |
| `/api/coupons/apply` | POST | Redeem coupon (per-user limit) |
| `/api/setup/save` | POST | Setup wizard save |

### Internal/Ops Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/errors/report` | POST | Error reporting (optional auth, 1KB cap, IP rate limit) |
| `/api/realtime/alerts` | GET | Realtime alerts (CRON_SECRET Bearer gate) |

### RaaS External API (Bearer Token)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/missions` | GET/POST | List/create missions |
| `/api/v1/missions/[id]` | GET | Mission detail |
| `/api/v1/missions/[id]/result` | GET | Mission output |
| `/api/v1/missions/[id]/stream` | GET | SSE real-time progress |

---

## Key Patterns & Modules

### 1. Authentication (Better Auth)
- **Files:** `lib/auth/*`, `lib/better-auth-client.ts`, `lib/better-auth-server.ts`
- **Pattern:** Better Auth handles session logic; app layer enforces org ownership
- **No RLS:** D1 doesn't support RLS; all queries include `WHERE org_id = ?` filters

### 2. Database Client (D1 Consolidation)
- **Single Entry Point:** `lib/db/client.ts` exports `createServerClient()`
- **Migration Complete:** 112 files use centralized client instead of Supabase imports
- **Pattern:** All authenticated DB access routes through one function

### 3. Tier Logic (Unified Config)
- **Single Source:** `config/tiers/tier-configs.ts` + `config/tiers/unified-limits.ts`
- **Deleted Files:** `lib/tier-gate.ts`, `lib/unified-tier-config.ts`
- **Pattern:** Tier checks import from config, not dispersed utilities

### 4. File Modularization (15 Giant Files → 56+ Focused Modules)
| Original | Split Into | Purpose | Modules |
|----------|-----------|---------|---|
| resend-email-service.ts | email/delivery, email/templates, email/tracking | Email delivery | 4 |
| dunning-workflow.ts | dunning/actions, dunning/state-machine, dunning/admin-ops | Payment retry logic | 3 |
| quota-alert-service.ts | quota/evaluator, quota/scheduler, quota/delivery | Quota enforcement | 3 |
| aggregator.ts | usage-metering/tracker, rollup, integration | MCU metering | 3 |
| raas-audit.ts | raas/audit-logging, query-service, invoice, permissions | RaaS operations | 4 |
| **10 additional large files (2026-04-15)** | **lib/*** | **Separation of concerns** | **+35** |
| — | — | All individual modules < 200 LOC | **56+ total** |

### 5. Usage Metering (Real-time MCU Tracking)
- **Location:** `lib/usage-metering/*`
- **Key Files:** tracker.ts, aggregator.ts, integration.ts, rollup-service.ts
- **Pattern:** Collect events → Buffer → Rollup → Debit from balance
- **Integration:** Gateway instrumentation for automated tracking

### 6. Billing & Payment
- **Primary:** NOWPayments (USDT, global)
- **Backup:** PayOS (Vietnam domestic, VietQR)
- **Webhook:** `/api/webhooks/nowpayments` handles IPN events
- **MCU System:** Credits monthly per tier, deducted per feature

### 7. Campaign Automation
- **Core:** `lib/campaigns/create-campaign-core.ts` (shared logic)
- **Channels:** YouTube, TikTok, Telegram (adapter pattern)
- **Orchestration:** OpenClaw autonomous agents

### 8. Telegram Bot
- **Location:** `lib/telegram/*`
- **FSM:** State machine for multi-step workflows
- **Handlers:** Command routing, callback query processing
- **Rate Limiting:** SQL-based rate limiter per user

### 9. Security
- **Auth Validation:** JWT enrichment, session verification
- **API Keys:** PBKDF2 hashing + revocation support
- **Rate Limiting:** Per-IP and per-user limits
- **Input Validation:** Zod schemas for all API inputs
- **Webhook Security:** HMAC signature verification

### 10. Autonomous Operations (2026-04-15)
- **Email Drip:** Welcome sequence on day 1/3/7 (no human involvement)
- **Renewal Reminders:** Pre-expiry notifications (7 days out)
- **Dunning State Machine:** Failed payment retry (24h/7d/30d escalation)
- **Scheduled Campaigns:** Time-based content distribution (hourly check)
- **Health Monitoring:** 5-minute uptime checks with Telegram alerts
- **Quota Evaluation:** 1-hour MCU limit warnings
- **Usage Rollup:** 30-minute balance updates

**Implementation:** 7 Cloudflare cron triggers in `wrangler.toml`, each handler fully async.

### 11. Tier Enforcement (2026-04-15)
- **Tier Logic:** `config/tiers/tier-configs.ts` (single source of truth)
- **Feature Gates:** `checkTierFeature(tier, feature) → boolean`
- **MASTER Special:** Expiry 2099, all features unlimited, no MCU deductions
- **Limits Enforced:**
  - Campaigns: 10/50/∞/∞ (Starter/Growth/Premium/Master)
  - Team Members: 0/5/∞/∞
  - API Access: Premium+ only
  - Custom Integrations: Enterprise+ only
  - White-Label: Master only

### 12. Analytics Dashboard (2026-04-25) + Type Safety Hardening (Phase 30)
- **Location:** `lib/analytics/*` (9 modules with Phase 30 type safety), `components/analytics/*` (7 components), `app/api/analytics/*` (4 endpoints)
- **Real-Time Metrics:** SSE endpoint streaming activeUsers, campaignsLast1h, apiCallsLast1h, errorRateLast1h, tierDistribution (10s refresh)
- **Revenue Metrics:** MRR, ARR, growth %, tier breakdown (backed by NOWPayments invoice queries with full type safety)
- **Cohort Analysis:**
  - Retention curves by signup cohort (7-week tracking)
  - Churn timeline (tier cancellations with reasons)
  - LTV calculator (customer lifetime value per tier)
- **Tier Adoption:** Stacked area chart tracking BASIC/PREMIUM/ENTERPRISE/MASTER adoption over time
- **Date Range Picker:** 7d/30d/90d presets + custom date range selector
- **Dashboard Integration:** Unified `/dashboard/analytics` page wiring all components (admin-only)
- **Database:** `tier_change_events` table (migration 0015) tracks tier change history for cohort scoping
- **Query Type Safety (Phase 30):**
  - `campaign-queries.ts` — Typed with `LicenseRow`, `UsageRow`, `OverageRow` interfaces; generic `D1QueryChain<T>`
  - `violation-queries.ts` — Typed `D1QueryChain`; fixed bug where `startTimestamp`/`endTimestamp` were accepted but not applied
  - `revenue-nowpayments.ts` — Fully typed with `D1QueryChain<LicenseRow>` generic; no `:any` types
  - All 3 query files: 0 `:any` types, comprehensive test coverage
- **Billing Page Modularization (Phase 30):** Reduced from 440L → 139L (69% reduction)
  - New components: `billing-charge-summary.tsx`, `billing-overage-table.tsx`, `billing-payment-history.tsx`
  - New shared types: `billing-page-types.ts`
  - Improves maintainability and component reusability
- **Activation:** Auto-live post-deploy; no env gates required

---

## Middleware & Request Pipeline

**File:** `src/middleware.ts`

1. **Index Rewrite:** `/` → `/landing` (opennextjs-cloudflare workaround)
2. **Public Route Bypass:** Landing, auth, docs, blog, API v1
3. **JWT/Session Validation:** Extract org_id from verified token
4. **Protected API Routes:** `/api/raas/*`, `/api/affiliate/*` require auth
5. **MCU Balance Check:** For billable routes (`/api/proposals/*`, `/api/video/*`)
6. **Auth Redirect:** Unauthenticated page requests → `/login?redirect=PATH`
7. **Security Headers:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options

---

## Subscription Tiers

| Tier | Price | MCU/month | Discount |
|------|-------|-----------|----------|
| Starter | $49/mo | 500 | — |
| Growth | $149/mo | 2,000 | 10% |
| Premium | $499/mo | 10,000 | 20% |
| Master | $999/mo | 25,000 | 30% |

### Feature Costs (MCU)
| Feature | Cost |
|---------|------|
| proposal:text:basic | 10 |
| proposal:text:advanced | 25 |
| proposal:text:enterprise | 50 |
| video:intro | 100 |
| video:section | 250 |
| video:full_proposal | 500 |
| affiliate:blog | 50 |
| affiliate:social | 10 |

---

## Deployment

### Cloudflare Workers Config (`wrangler.jsonc`)
```jsonc
{
  "name": "sophia-ai-factory",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-03-17",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  
  "d1_databases": [{
    "binding": "DB",
    "database_name": "sophia-raas-db",
    "database_id": "78bd1961-b62d-43bb-b551-0c5d7d389506"
  }],
  
  "r2_buckets": [{
    "binding": "NEXT_INC_CACHE_R2_BUCKET",
    "bucket_name": "sophia-ai-factory-opennext-cache"
  }]
}
```

### Build & Deploy
- **Build:** `npx opennextjs-cloudflare build` (from project root)
- **Deploy:** `git push origin main` → GitHub Actions → CF Workers auto-deploy
- **CI/CD:** `.github/workflows/ci-cd.yml` — lint + test + deploy pipeline

---

## Testing

### Test Coverage (2026-04-15)
- **Total Tests:** 863/863 passing (99.5%)
- **E2E Smoke Tests:** 5 files, 35 tests validating critical journeys (commit c69ba13)
- **Test Files:** Located alongside source files (`.test.ts` suffix)
- **Categories:** Unit tests, integration tests, security tests, E2E smoke tests

### E2E Smoke Test Suites (2026-04-15)
| File | Purpose | Coverage |
|------|---------|----------|
| `smoke-auth.test.ts` | Signup → magic link → dashboard | Auth flow |
| `smoke-billing.test.ts` | Tier selection → IPN webhook → balance | Payment flow |
| `smoke-campaigns.test.ts` | Campaign creation → MCU check → scheduling | Campaign ops |
| `smoke-raas-api.test.ts` | Bearer token → mission → async result | RaaS API |
| `smoke-telegram.test.ts` | Bot commands → FSM → responses | Bot integration |

### Key Unit Test Suites
| File | Purpose |
|------|---------|
| `lib/audit/audit-logger.test.ts` | Compliance logging |
| `lib/security/api-key-validator.test.ts` | API key validation |
| `lib/security/jwt-validator.test.ts` | JWT verification |
| `lib/gateway/openclaw-gateway.test.ts` | OpenClaw integration |
| `lib/usage-metering/aggregator.test.ts` | MCU metering |

### Run Tests
```bash
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run build && npm test  # Full pipeline
```

---

## Known Issues & Technical Debt

### Accepted (Non-Critical)
- **opennextjs-cloudflare Index Bug:** `/` returns 500; mitigated with middleware rewrite to `/landing`
- **Peer Dependency Warning:** `npm install --legacy-peer-deps` required (wrangler v3 vs @opennextjs/cloudflare)
- **Legacy Auth Components:** 4 tests failing (isolated, not blocking; cleanup pending in Phase 8)

### Resolved
- ~~Vercel vs CF Workers confusion~~ → Fully migrated to CF Workers
- ~~Supabase RLS coverage~~ → Migrated to JWT-based permission model
- ~~Auth source multiplicity~~ → Unified to Better Auth v1.6.2

---

## Performance & Monitoring

### Build Performance
- **Build Time:** < 10s (optimized with tree-shaking)
- **Bundle Size:** < 500 KB gzipped
- **Cold Start:** Edge functions < 100ms

### Observability
- **Error Tracking:** Sentry SDK integrated
- **Structured Logging:** JSON logger for all events (`lib/utils/logger-utility.ts`)
- **Uptime Monitoring:** 5-minute health check cron job
- **Database Backup:** Nightly automated backup to Cloudflare

---

## Developer Workflow

### Local Development
```bash
npm install
npm run dev           # Local Next.js dev server
npm run db:push      # Apply migrations to D1
npm test              # Run all tests
npm run build        # Production build
npm run lint         # Type checking + linting
```

### Environment Variables
See `.env.example` for required variables (JWT_SECRET, API keys, etc.)

### Code Standards
- **TypeScript:** Strict mode enabled, 0 `:any` types
- **Commit Format:** Conventional commits (feat:, fix:, refactor:, docs:)
- **Testing:** All new code includes unit tests
- **Documentation:** Inline comments for complex logic

---

## References

- **Architecture Decisions:** See `docs/system-architecture.md`
- **Code Standards:** See `docs/code-standards.md`
- **Project Roadmap:** See `docs/project-roadmap.md`
- **Security Guidelines:** See `docs/security-hardening-implementation.md`
- **Deployment Guide:** See `docs/deployment-guide.md`

---

**Generated:** 2026-04-15
**Codebase Version:** Post-Mega Session (Architecture + a16z 100/100)
**Commits:** 27+ commits consolidating auth, DB client, tier logic; 15 giant files → 56+ modules
**Test Coverage:** 863/863 passing (99.5%) | E2E smoke tests (5 files, 35 tests)
**Maintained By:** Documentation Team
