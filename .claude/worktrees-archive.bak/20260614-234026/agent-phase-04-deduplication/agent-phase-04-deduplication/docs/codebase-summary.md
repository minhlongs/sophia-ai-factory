# Codebase Summary — Sophia AI Factory

> Comprehensive overview of the Sophia AI Factory codebase structure, patterns, and architectural decisions.
> **Last Updated:** 2026-05-21 (docs backfill scout — package/deploy facts checked against app code)

**Production URL:** https://sophia.agencyos.network (SHA 4bca4710)
**Last full GREEN recorded:** SHA 4bca4710, 4431/4431 tests passing on 2026-05-17. Re-run local gates before any new deploy.
**Deploy doctrine:** CF-direct via `npm run deploy:full` (wrangler CLI). GitHub Actions DISABLED by design since 2026-05-03 — see Deploy Flow section below.
**D1 Migrations:** 120 SQL files in `apps/sophia-ai-factory/migrations/` as of 2026-05-21 (highest numbered migration: 0117).

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
| **Framework** | Next.js 16 + React 19 (App Router) | Full-stack React application |
| **Adapter** | `@opennextjs/cloudflare` | Next.js → CF Workers bridge |
| **Database** | Cloudflare D1 (SQLite) | Primary data store (sophia-raas-db) |
| **Cache** | Cloudflare R2 + KV | Static assets + metering logs |
| **Auth** | Better Auth v1.6.2 | Session-based auth (D1 backend) |
| **Email** | Resend | Magic link + transactional emails |
| **Payment** | NOWPayments (primary) + PayOS (backup) | Cryptocurrency + Vietnam domestic |
| **AI** | Anthropic Claude | Proposal generation |
| **Video** | HeyGen | Avatar video generation |
| **Telegram** | Telegram Bot API | User interaction + notifications |

---

## Verified Repository Audit Map

This map was checked against the working tree on 2026-05-22. Use it before trusting historical folder snapshots below.

| Area | Overview | Entry Points | Dependencies | Runtime Role | Risk | Confidence |
|------|----------|--------------|--------------|--------------|------|------------|
| `apps/sophia-ai-factory/` | Canonical Sophia production app. Next.js 16 + React 19 compiled to Cloudflare Workers through OpenNext. | `src/middleware.ts`, `src/app/**`, `src/app/api/**`, `package.json`, `wrangler.toml` | Cloudflare D1/R2/KV/Images/Workers, Better Auth, NOWPayments, Resend, Telegram, HeyGen, Inngest | Serves product UI, API routes, auth, billing, missions, webhooks, cron dispatch | High: 2476 source files, many legacy `src/lib/*` modules still coexist with `seed/tree/forest/land` | High |
| `apps/84tea/` | Secondary app in the monorepo. Not part of Sophia production deployment. | Its own app/package files | Next.js stack | Separate runtime if deployed independently | Medium: ownership and deploy status not documented in Sophia docs | Medium |
| `services/` | Sidecar service blueprints for media workloads (`coqui-tts`, `moviepy-render`, `runpod-hunyuan`). | Docker/Fly/Runpod service files inside each service | Python/media runtimes, external hosting | Optional external providers for TTS/render/video generation | Medium: production connection points need operator verification | Medium |
| `scripts/` | Root automation and diagnostics. App deploy scripts live under `apps/sophia-ai-factory/scripts/`. | Shell/TS scripts | GitHub/Cloudflare/local shell | Operator automation, verification, historical migration helpers | Medium: root scripts include legacy paths; verify before running | Medium |
| `supabase/` | Legacy/shared Supabase migration artifacts. | `supabase/migrations/` | Supabase/Postgres | Historical or auxiliary; Sophia app production DB is D1 | High: easy to mistake as production schema source | High |
| `apps/sophia-ai-factory/migrations/` | Canonical Cloudflare D1 migrations for Sophia. | `scripts/apply-migrations.sh`, Wrangler D1 migration commands | Cloudflare D1 | Production schema evolution | High: 120 SQL files; migration count must be rechecked before reports | High |
| `apps/sophia-ai-factory/wrangler.toml` | Canonical Cloudflare Worker/D1/R2/KV/cron config. | `npm run deploy:full` | OpenNext Cloudflare + Wrangler | Production topology and scheduled trigger source | High: cron patterns drift from injected route map; see risks below | High |
| Root `wrangler.jsonc` | Historical/narrower Worker config. | None verified for Sophia deploy | Cloudflare | Not canonical for Sophia app deployment | Medium: can mislead agents about bindings/crons | High |
| `.github/workflows/` | Auxiliary scans/cron workflows. Deploy workflow is archived/disabled. | PR/manual schedules | GitHub Actions | Security/quality/backfill automation, not production deploy proof | Medium: do not use `gh run list` as deploy proof | High |
| `.gitlab-ci.yml` | GitLab mirror/deploy automation file. | GitLab CI | Wrangler | Possible mirror path, but not canonical doctrine | Medium: needs operator confirmation before use | Medium |
| `docs/` | Operator/cross-project docs. | README and topic docs | Human/agent readers | Onboarding, architecture, deployment, risks | Medium: historical sections still mention old paths/providers | High |
| `apps/sophia-ai-factory/docs/` | App-internal engineering docs/runbooks. | launch, compliance, migration, checklist docs | Human/agent readers | Detailed Sophia implementation history and operations | Medium: some historical docs intentionally preserve old state | Medium |
| `plans/` | Implementation/audit plans and reports. | `plans/*/plan.md` | Agent workflow | Work history, active audits, verification records | Low: high volume; active plan must be identified before edits | High |
| `.claude/`, `.opencode/`, `.agent/`, `.sophia-factory/`, `.mekong/` | Agent orchestration and instruction layers. | AGENTS/CLAUDE/rule files, command files | Local agent CLIs | Controls future agent behavior and task routing | High: stale canonical paths here cause repeated wrong code changes | High |
| `packages/` | No active root `packages/` directory found. | N/A | N/A | N/A | Low, but docs should not imply package workspace modules exist | High |

Missing docs still worth clarifying: `apps/84tea` ownership/deploy status, sidecar service production connectivity, whether `.gitlab-ci.yml` is active or historical, and package-manager doctrine (`npm` scripts are canonical while pnpm lockfiles exist).

---

## Directory Structure

The detailed tree below is a high-level/historical navigation aid. For canonical runtime ownership and imports, prefer the verified audit map and the `seed/tree/forest/land` layer map in the next sections. In particular, do not infer auth/db/tier import paths from old `src/lib/*` entries.

```
apps/sophia-ai-factory/  # Main Sophia AI Factory codebase (canon — deployed to sophia.agencyos.network)
├── src/
│   ├── app/[locale]/           # Next.js pages (SSR + Server Components)
│   │   ├── dashboard/          # Protected dashboard (missions, campaigns, analytics)
│   │   ├── (admin)/admin/      # Admin panel (tier provisioning, settings)
│   │   ├── pricing/            # Public pricing page
│   │   ├── login/              # Auth pages (login, signup, magic link)
│   ├── app/api/                # API routes (auth, webhooks, RaaS endpoints)
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
│   │   ├── video/              # Legacy + helper video modules; canonical on-demand video is mission `video:create`
│   │   │   ├── onboarding-video.ts     # Post-purchase auto-gen (ENTERPRISE/MASTER)
│   │   │   └── ...                     # Access, cost, URL, and deprecated job helpers
│   │   │
│   │   ├── inngest/            # Inngest helpers; only functions listed in app/api/inngest/route.ts are active
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
│   │   ├── email/              # Email delivery (Phase 14 expansion + 2026-05-03)
│   │   │   ├── onboarding-emails.ts      # Video completion notification
│   │   │   ├── receipt-email-template.ts # Bilingual receipt with VAT 10% (NEW 2026-05-03)
│   │   │   ├── receipt-email-sender.ts   # Resend delivery (NEW 2026-05-03)
│   │   │   ├── lifecycle/milestone-emailer.ts # D+1/D+7 emails (NEW 2026-05-03)
│   │   │   └── gdpr-export.ts            # GDPR data export
│   │   │
│   │   ├── outbox/             # Durable email queue (NEW 2026-05-03)
│   │   │   └── email-outbox-processor.ts # D1 batch processor + retry cron
│   │   │
│   │   ├── status/             # Public status page (NEW 2026-05-03)
│   │   │   ├── rollup-calculator.ts      # Daily uptime aggregates
│   │   │   └── incidents-query.ts        # Incident tracking
│   │   │
│   │   ├── payments/           # Payment processing (2026-05-03 expansion)
│   │   │   ├── nowpayments-invoice-generator.ts # Invoice generation
│   │   │   └── payos.ts                  # PayOS Vietnam checkout + QR (NEW)
│   │   │
│   │   ├── api-keys/           # RaaS API key storage (NEW 2026-05-03)
│   │   │   └── d1-store.ts               # CRUD + encryption
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
│   ├── ...
│   └── 0117-refresh-video-generation-starter-sop.sql
│   # 120 SQL files present as of 2026-05-21; run `find migrations -name '*.sql'`
│   # before claiming a current migration count.
│
├── scripts/                    # Build & deployment utilities
│   ├── inject-scheduled-handler.mjs    # Post-build: injects CF Workers scheduled() default-export (260502-0756 FIX: CF Modules format)
│   ├── set-cron-secret.sh             # Operator setup: generates 32-byte CRON_SECRET, sets via wrangler secret put (260502-0756 NEW)
│   └── deploy-with-sha.sh             # Deploy wrapper: sets COMMIT_SHA/DEPLOYED_AT/DEPLOY_BRANCH secrets (260502-0733)
│
├── .github/workflows/          # Auxiliary workflows; deploy workflow disabled since 2026-05-03
│   ├── test.yml.disabled       # Archived deploy workflow (CF-direct doctrine replaces this)
│   ├── security-scan.yml       # SAST + npm audit + secret scan
│   ├── quality-gate.yml        # Test coverage + mutation score
│   ├── dependency-audit.yml    # Outdated packages + breaking changes
│   ├── canary-rollback.yml     # Manual rollback (workflow_dispatch only)
│   ├── post-merge-tests.yml.disabled
│   ├── d1-backup.yml.disabled  # D1 backup moved to `/api/cron/d1-backup` + R2
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

## 4-Layer Seed/Tree/Forest/Land Architecture

All domain code under `apps/sophia-ai-factory/src/` follows a 4-layer convention:

| Layer | ~Files | Role | Examples |
|-------|-------:|------|---------|
| **seed** | 147 | Foundational primitives — types, config, db client, auth, security utils, logger | `seed/auth/better-auth-session.ts`, `seed/config/tiers/`, `seed/db/client.ts` |
| **tree** | 162 | Domain-specific reusable — bot logic, BYOK store, handover, audit | `tree/byok/`, `tree/handover/`, `tree/telegram/`, `tree/audit/` |
| **forest** | 362 | Infrastructure orchestrators — Inngest jobs, RAAS gateway, usage metering, quota | `forest/inngest/`, `forest/raas/`, `forest/usage-metering/`, `forest/quota/` |
| **land** | 113 | Business domain workflows — billing, payouts, affiliates, promo, refunds | `land/billing/`, `land/payouts/`, `land/affiliates/` |

Import direction: `seed` ← any layer. `tree` imports seed. `forest` imports seed+tree (may call land for orchestration). `land` imports seed+tree+forest.

Authoritative reference: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`

---

## Verified Runtime Entry Points

| Subsystem | Overview | Entry Points | Runtime Flow | Dependencies | Risks | Confidence |
|-----------|----------|--------------|--------------|--------------|-------|------------|
| Request middleware | First gate for pages/API. Adds CSP nonce, CORS, CSRF, auth redirects, MFA checks, API usage events, tenant/rate gates. | `src/middleware.ts`, `src/middleware-api-handler.ts`, `src/middleware-helpers.ts` | Request -> static/public bypass -> API handler or page auth -> Better Auth session lookup -> admin/tier/MFA checks -> intl middleware/route handler | Better Auth, D1, usage metering, rate limiter | High: many security decisions happen before route code; middleware export is `proxy(request)`, not the older `middleware` name | High |
| Auth | Better Auth D1-backed sessions with email/password and magic links. User create hook provisions org/member/balance/subscription/profile rows. | `src/app/api/auth/[...all]/route.ts`, `src/seed/auth/better-auth-server.ts`, `src/seed/auth/better-auth-session.ts` | Better Auth handler -> D1 adapter -> session cookie -> middleware/server components call `getCurrentUser()` | D1, Resend, Better Auth plugins | Medium: docs and rules historically referenced deleted `@/lib/*` paths | High |
| Persistence | Cloudflare D1 is canonical production DB. `createServerClient()` is sync and resolves Worker bindings lazily when needed. | `src/seed/db/client.ts`, `src/seed/db/get-user-tier.ts`, `migrations/` | Route/server action -> D1 client -> query builder/raw D1 -> domain repository | D1 binding `DB`, migrations, query-chain helpers | High: Supabase shims still exist under `src/lib/supabase/*`; avoid treating Supabase as production DB source | High |
| Tier/pricing | Uppercase tier enum drives limits, prices, feature gates, checkout mappings. | `src/seed/config/tiers/index.ts`, `tier-configs.ts`, `unified-limits.ts`, `one-time-skus.ts` | UI/API imports `UNIFIED_TIERS` or `TIER_CONFIGS`; checkout maps tier -> NOWPayments invoice | NOWPayments invoice IDs, D1 subscriptions/balances | High: many historical docs still contain old `$49/$149/$499/$999` prices | High |
| Checkout/IPN billing | Self-serve checkout redirects to pre-created NOWPayments invoices; IPN activates subscription or one-time bundle. | `src/app/api/checkout/route.ts`, `src/tree/clients/nowpayments-client.ts`, `src/app/api/webhooks/nowpayments/route.ts`, `src/land/billing/nowpayments-ipn-*.ts` | Authenticated checkout -> pending order -> NOWPayments invoice -> signed IPN -> idempotency check -> subscription/user_purchase/balance/video fulfillment updates | NOWPayments, D1, Resend, HeyGen, handover | High: invoice IDs are code-owned constants; dashboard changes must stay in sync | High |
| Mission engine | Bearer/session-accessible RaaS command dispatcher. `video:create` is the canonical on-demand video path. | `src/app/api/v1/missions/route.ts`, `src/forest/missions/dispatcher.ts`, `src/land/missions/auto-video-mission.ts` | Validate API key/session -> quota/balance check -> insert `engine_missions` -> dispatch handler -> persist result/status | D1, usage metering, HeyGen/BYOK, SEO/affiliate helpers | Medium: route returns before background dispatch completes; monitoring depends on mission status records | High |
| Legacy video jobs | ADR 0007 deprecated the old `video_jobs` Inngest chain. | `src/app/api/videos/generate/route.ts`, `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md` | Authenticated caller receives HTTP 410 with replacement hint | None active for new requests | High: `videoGenerate` still exists in exports and server action emitters, but `/api/inngest` does not register it | High |
| Inngest | Event functions registered explicitly, not by folder export. | `src/app/api/inngest/route.ts`, `src/forest/inngest/functions/index.ts` | Inngest serve registers selected functions -> events trigger billing/publishing/storage jobs | Inngest, D1, external APIs | High: functions exported from index are not necessarily registered; check route list before assuming runtime coverage | High |
| Cron/schedulers | Cloudflare scheduled handler is injected after OpenNext build and calls internal API routes through service binding. | `wrangler.toml`, `scripts/inject-scheduled-handler.mjs`, `src/app/api/cron/**` | CF cron pattern -> injected `scheduled()` -> `WORKER_SELF_REFERENCE.fetch()` with `CRON_SECRET` bearer -> route handler | Wrangler, Cloudflare Workers, D1 `cron_run_log`, CRON_SECRET | High: several `wrangler.toml` cron patterns are not mapped in `CRON_ROUTES` (`0 5`, `*/10`, `0 7`, `10 *`, `0 */4`) | High |
| Feature flags/signals | Experiments and canaries resolve through KV/D1 helpers. | `src/lib/signals/*`, `src/lib/feature-flags/*`, `EXPERIMENT_KV` binding | Request/action -> resolver -> D1/KV event append -> PostHog/weekly digest where configured | EXPERIMENT_KV, PostHog, D1 | Medium: mixed `src/lib/*` namespace remains active for product analytics | Medium |
| Env/config | Worker secrets and `.dev.vars` supply runtime credentials. App `.env.example` is best local template. | `apps/sophia-ai-factory/.env.example`, `.env.production.example`, `wrangler.toml`, `scripts/deploy-with-sha.sh` | Local/dev reads env -> deploy script sets build metadata secrets -> Worker runtime reads bindings/secrets | Wrangler secrets, Cloudflare bindings | High: `.env.production.example` and docs have some stale variable names; verify with code before provisioning | Medium |

---

## Gap & Risk Report

### Confirmed Facts
- Production deploy is CF-direct from `apps/sophia-ai-factory` through `npm run deploy:full`; GitHub deploy workflow is disabled by design.
- Canonical production persistence is Cloudflare D1 (`sophia-raas-db`) with migrations under `apps/sophia-ai-factory/migrations/`.
- Core imports for auth/db/tier are `@/seed/auth/*`, `@/seed/db/*`, and `@/seed/config/tiers`.
- `/api/videos/generate` is deprecated and returns HTTP 410 for authenticated callers. The replacement is the HeyGen mission flow (`video:create`).
- Runtime Inngest registration is controlled by `src/app/api/inngest/route.ts`, not by the function export index.
- The Cloudflare cron route map is injected by `scripts/inject-scheduled-handler.mjs`; several `wrangler.toml` cron patterns currently have no mapping in `CRON_ROUTES`.

### Inferred Behavior
- Root `wrangler.jsonc`, root `.env.example`, and root package metadata are legacy/tooling context for Sophia, not deploy source of truth. This is inferred from the app deploy script, app `wrangler.toml`, and project deploy doctrine.
- `src/lib/*` is still active for many feature modules, but it is no longer the canonical location for foundational primitives. New foundational code should go under `seed`, with domain code under `tree`, `forest`, or `land`.
- GitLab CI may be a mirror or historical deploy path. It should not be used as canonical until an operator confirms it.

### Operational Risks
- **Cron drift (High):** `wrangler.toml` includes unmapped schedules. Missing scheduled execution can silently break monitoring, cache purge, wallet rebuild, or affiliate scout jobs.
- **Video flow drift (High):** Legacy video Inngest code still exists and can be mistaken for active runtime. Check ADR 0007 and `/api/inngest/route.ts` before changing video generation.
- **Env drift (High):** `.env.production.example`, `.env.example`, docs, and code use overlapping names. Provision secrets by grepping runtime code, not by copying one file blindly.
- **Package-manager ambiguity (Medium):** pnpm lockfiles exist, but app scripts and deploy docs are npm-based.
- **Docs history noise (Medium):** changelog and launch-history docs preserve old provider/path names. Treat them as historical unless a current doc or source file confirms the behavior.

### Missing Information / Open Questions
- What is the operational owner and deploy status of `apps/84tea/`?
- Are `services/coqui-tts`, `services/moviepy-render`, and `services/runpod-hunyuan` connected to production, standby, or only retained as blueprints?
- Is `.gitlab-ci.yml` active in any environment, or historical only?
- Should npm remain the only documented runner, or should pnpm workspace files be formalized?
- Should the unmapped `wrangler.toml` cron patterns be removed, or should `CRON_ROUTES` be expanded?

---

## CF-Direct Deploy Flow

GitHub Actions is DISABLED by design since 2026-05-03. Canonical deploy path is wrangler CLI:

```bash
# Step 0 (mandatory): push to origin before deploy
git push origin main

# Step 1: Build + inject SHA + deploy
cd apps/sophia-ai-factory
npm run deploy:full   # = build + scripts/deploy-with-sha.sh + wrangler deploy

# Step 2: Apply any new D1 migrations (if migrations/ changed)
bash scripts/apply-migrations.sh

# Step 3: Verify SHA match
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
# Must match: git rev-parse HEAD | cut -c1-8

# Step 4: HTTP check
curl -sI https://sophia.agencyos.network | head -1   # must be 200
```

`npm run deploy:full` rejects with exit 2 if `git log origin/main..HEAD` is non-empty (push-before-deploy guard). See `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` for full verification sequence.

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
- **Path:** `src/seed/auth/better-auth-client.ts`
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
subscriptions      → org_id, plan, status, current_period_start/end
pending_orders     → order_id, tier_slug, amount, provider, status, payment_id, completed_at
payment_events     → provider/payment status audit rows
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
| `/api/videos/generate` | POST | Deprecated legacy video generation endpoint; returns HTTP 410 per ADR 0007. Use mission routes instead. |
| `/api/videos` | GET/POST | Video CRUD + Inngest status (Phase 6) |
| `/api/affiliates/dashboard` | GET | Earnings + commission tracking (Phase 9) |
| `/api/affiliates/networks` | GET | 5 networks (TikTok Shop, Awin, ClickBank, AccessTrade, Amazon) (Phase 9) |
| `/api/publishers/channels` | GET/POST | Social channel management (Phase 10) |
| `/api/publishers/schedule` | POST | Schedule post across channels (Phase 10) |
| `/api/account/export` | GET | GDPR data export (Phase 14; UI button added Wave 20 P04) |
| `/api/account/change-email` | POST | Start email-change flow — token to verification table + email to NEW address (Wave 20 P04) |
| `/api/account/change-email/verify` | GET | Finalize email change — UPDATE user.email + redirect (Wave 20 P04) |
| `/api/account` | DELETE | GDPR account deletion (header `X-Confirm-Delete: DELETE_MY_ACCOUNT`; UI flow Wave 21) |
| `/api/quota/status` | GET | Monthly credit usage for sidebar widget (Wave 20 P03 consumer) |
| `/api/billing/usage-summary` | GET | Detailed billing/usage for `/dashboard/billing` |
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
- **Files:** `seed/auth/better-auth-client.ts`, `seed/auth/better-auth-server.ts`, `seed/auth/better-auth-session.ts`
- **Pattern:** Better Auth handles session logic; app layer enforces org ownership
- **No RLS:** D1 doesn't support RLS; all queries include `WHERE org_id = ?` filters

### 2. Database Client (D1 Consolidation)
- **Single Entry Point:** `seed/db/client.ts` exports `createServerClient()`
- **Migration Complete:** 112 files use centralized client instead of Supabase imports
- **Pattern:** All authenticated DB access routes through one function

### 3. Tier Logic (Unified Config)
- **Single Source:** `seed/config/tiers/tier-configs.ts` + `seed/config/tiers/unified-limits.ts`
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
- **Tier Logic:** `seed/config/tiers/tier-configs.ts` + `seed/config/tiers/unified-limits.ts` (single source of truth)
- **Feature Gates:** `checkTierFeature(tier, feature) → boolean`
- **MASTER Special:** Expiry 2099, all features unlimited, no MCU deductions
- **Limits Enforced:**
  - Campaigns: 10/50/∞/∞ (Starter/Growth/Premium/Master)
  - Team Members: 1/5/∞/∞
  - API Access: Growth+ (`PREMIUM` enum) only
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
2. **Static/Public Bypass:** Internal assets and public paths skip app gates
3. **CSP + CSRF:** Fresh nonce per request; mutating requests use double-submit token validation
4. **API Gate:** `/api/*` routes pass through tenant isolation, webhook pinning, rate limit, RaaS gate, and usage events
5. **Dashboard Auth:** Better Auth session required; pending MFA redirects to challenge page
6. **Admin Gate:** `/dashboard/admin/*` checks MASTER tier in middleware before streaming layout
7. **Security Headers:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options

---

## Subscription Tiers

| Tier | Price | MCU/month | Discount |
|------|-------|-----------|----------|
| BASIC / Starter | $199/mo | 1,000 | — |
| PREMIUM / Growth | $399/mo | 5,000 | — |
| ENTERPRISE / Premium | $799/mo | 20,000 | — |
| MASTER / Master | $4,999 lifetime | 100,000 | — |

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

### Cloudflare Workers Config (`apps/sophia-ai-factory/wrangler.toml`)
```toml
name = "sophia-ai-factory"
main = ".open-next/worker.js"
compatibility_date = "2026-03-17"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[[d1_databases]]
binding = "DB"
database_name = "sophia-raas-db"
database_id = "78bd1961-b62d-43bb-b551-0c5d7d389506"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "BACKUPS_BUCKET"
bucket_name = "sophia-backups"
```

### Build & Deploy
- **Build:** `npm run build` uses Turbopack, then OpenNext builds the Cloudflare artifact.
- **Deploy:** `git push origin main`, then `cd apps/sophia-ai-factory && npm run deploy:full`.
- **Verification:** `/api/version` short SHA must match `git rev-parse HEAD | cut -c1-8`, then production HTTP must return 200.
- **GitHub Actions:** deploy workflow is archived as `.github/workflows/test.yml.disabled`; do not use `gh run list` as deploy proof.

---

## Testing

### Test Coverage
- **Last full GREEN recorded:** 4431/4431 tests on 2026-05-17.
- **Current test surface:** 475 Vitest test files under `apps/sophia-ai-factory/src/`, plus Playwright E2E suites under `apps/sophia-ai-factory/tests/e2e/`.
- **Categories:** Unit tests, route contract tests, integration tests, security tests, E2E smoke tests, load-test scripts.
- **Rule:** Treat historical counts as snapshots. Re-run `npm run ci:test` before reporting a current count.

### Run Tests
```bash
npm run ci:test            # Current-count Vitest run
npm run test:e2e           # Playwright E2E
npm run build              # Production build
```

---

## Known Issues & Technical Debt

### Accepted (Non-Critical)
- Historical issues are tracked in `apps/sophia-ai-factory/docs/known-issues.md` and `docs/postmortems/`.
- Do not copy old failing-test counts forward; current status must come from a fresh command run.

### Resolved
- ~~Vercel vs CF Workers confusion~~ → Fully migrated to CF Workers
- ~~Supabase RLS coverage~~ → Migrated to JWT-based permission model
- ~~Auth source multiplicity~~ → Unified to Better Auth v1.6.2

---

## Performance & Monitoring

### Build Performance
- **Build Time:** hardware-dependent; the 2026-05-20 docs-harness report recorded a successful app build in 32.2s.
- **Bundle Size:** track with `npm run check:bundle-size`
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
npm run deploy:migrations  # Apply D1 migrations when needed
npm run ci:test       # Current-count Vitest run
npm run build         # Production build
npm run lint          # ESLint
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
- **Project Roadmap:** See `docs/development-roadmap.md`
- **Security Guidelines:** See `apps/sophia-ai-factory/docs/security-hardening-implementation.md`
- **Deployment Guide:** See `docs/deployment-guide.md`

---

**Generated:** 2026-04-15
**Backfilled:** 2026-05-21
**Codebase Version:** Post-CF-direct doctrine, Next.js 16 app package
**Validation Rule:** Use fresh `npm run build` / `npm run ci:test` output for current status.
**Maintained By:** Documentation Team
