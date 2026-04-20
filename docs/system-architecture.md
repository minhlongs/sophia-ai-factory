# System Architecture / Kien Truc He Thong

> Sophia AI Factory — RaaS (Reasoning-as-a-Service) Platform with AI-Native CI/CD, Observability, & Signals

**Last Updated:** 2026-04-20 (Phase 8: Telegram Handlers Type Safety + FSM/Rate-Limiter Review Nits)
**Production:** https://sophia.agencyos.network
**Production Dashboard:** https://sophia.agencyos.network/dashboard

### Recent Shipments (2026-04-18)
Rounds 4 + 5 + 6 + 7 + 8: 20+ major features shipped (LLM observability + async ops + signals + BYOK integration + user admin):
- **Round 8 - R8 Hygiene + User-Facing BYOK Admin (2026-04-18):** Phase 8A errorClass split in workflow-stepper + weekly-signals-digest + error-digest BYOK resolver symmetry + Phase 8C new `/api/user/byok` endpoint (GET/POST/DELETE key management) + `/dashboard/byok` SSR page with bilingual component + `BYOK_KEY_SET/BYOK_KEY_CLEARED` signal events = 11 new tests, user-facing BYOK admin ready
- **Round 7 - R7 BYOK Wiring Completion (2026-04-18):** Phase 7A OpenRouter degrade-to-mock in workflow-stepper + Phase 7B script-generator BYOK resolver wire + Phase 7C niche-enhancer BYOK resolver wire = 6 new tests, all OpenRouter callers BYOK-integrated
- **Round 6 - R6 Refinement Pack (2026-04-18):** Phase 4F.3 tier normalization (DB_TIER_MAPPING canonical safety) + Phase 4N-POLISH SSE reader cleanup + parse_error event + Phase 4E.2-TUNING cache index widening + PII gate + Phase 4G-WIRE per-user key integration into cron/LLM callers = 9 new tests, BYOK fully wired
- **Round 5 - Round 4.5 Refinement (2026-04-18):** Phase 4N SSE parser extraction (7-event union, tool-use streaming) + Phase 4E.2 semantic cache fallback (Workers AI embeddings, dark-launched) + Phase 4F.2 tenant context helper (single-JOIN, YAGNI) + Phase 4G-BYOK per-user API key foundations (AES-GCM crypto + D1 store, env fallback) = 62 new tests, 4 new modules
- **Round 4 - Trace Aggregation & Anthropic (2026-04-18):** Phase 4M aggregateTraceStats extraction + Phase 4J Anthropic API adapter + Phase 4K admin monitoring LLM trace embed + Phase 4L Anthropic streaming/tool-use library prep = 8 new tests, callAnthropicFull/callAnthropicStream available
- **Round 3 - Real LLM & Ops Endpoints (2026-04-18):** Phase 4G dark-launched real LLM + Phase 4H cache stats API + Phase 4I trace stats API + Phase 4G-FIX telemetry honesty = 9 new tests, ops monitoring endpoints live
- **Round 2 - Cache Lifecycle (2026-04-18):** Phase 4E LLM cache MVP + Phase 4E H-1 org scoping + Phase 4E.3 purge cron + Phase 4F cache wiring + Phase 4F.1 resolveOrgId unification = 6+25+4+4+5=44 new tests
- **Round 1 - Foundations (2026-04-17):** Phase 4D Langfuse secondary sink + Phase 4C smart LLM router + Phase 4B provisioning + Phase 4A signals digest
- **RaaS P1–P4:** CI/CD + observability + signals + SDLC agents
- **Local Mode D–F:** Auto-installer + setup wizard + health monitoring

**ARCHITECTURE CONSOLIDATION (2026-04-15):** Unified auth (Better Auth D1), single DB client, consolidated tier logic, modularized 15→56+ focused modules (all < 200 LOC). E2E smoke tests validate critical journeys.

**AUTHENTICATION MIGRATION (2026-04-14):** Better Auth v1.6.2 with D1 Kysely adapter. Email/password + magic link + organization plugin.

**PAYMENT PROVIDER MIGRATION (2026-04-10):** NOWPayments (primary) + PayOS (Vietnam backup).

---

## Architecture Layers (7 Total)

```mermaid
graph TB
    APP["Application Layer"] --> SDLC["SDLC + Agent Factory"]
    APP --> SIGNALS["Signals & Feedback"]
    APP --> OBS["Observability"]
    APP --> CICD["CI/CD & Enforcement"]
    CICD -->|5 Gates| CF["Cloudflare Workers"]
    CF -->|Edge Deploy| APP
    
    APP -->|SSR| AUTH["Auth Layer"]
    APP -->|API| API["RaaS API"]
    AUTH --> D1["D1 Database"]
    API --> D1
    APP -->|Billing| BILL["MCU Billing"]
    BILL --> D1
    
    OBS -->|PII-Safe Logs| BS["Better Stack"]
    SIGNALS -->|A/B Events| PH["PostHog KV"]
    SDLC -->|AI Agents| AF[".sophia-factory/"]
    
    D1 -->|Cache| R2["R2 Bucket"]
    CF -->|External APIs| EXT["Anthropic<br/>Resend<br/>D-ID"]
```

---

## Layer 1: CI/CD & Enforcement Gates (2026-04-17)

**5 Enforcement Gates** via GitHub Actions (`.github/workflows/`)

| Gate | Trigger | Purpose | Action |
|------|---------|---------|--------|
| **Validation Gate** | Every push | Type safety, lint, format | Block non-conforming PRs |
| **Security Gate** | Every push | SAST, npm audit, secret scan | Fail on vulnerabilities |
| **Quality Gate** | Every push | Test coverage, mutation score | Require 80%+ coverage |
| **Dependency Gate** | Every push | Outdated packages, SCA | Alert on breaking deps |
| **Deployment Gate** | main only | Canary to 10% traffic | Rollback on error rate spike |

**Canary Rollout:** Wrangler versions deploy + Better Stack error monitoring auto-triggers rollback if error rate >2%.

**Health Endpoints:**
- `/api/version` — Returns git SHA + build info (auth-gated via INTROSPECT_TOKEN)
- `/api/health/detail` — Full system status (auth-gated, PII-safe)

---

## Layer 2: Observability (2026-04-17)

**Better Stack Structured Logging** for production monitoring

| Feature | Implementation | Details |
|---------|---|---|
| **PII-Safe Logging** | Tokenized payloads | No API keys, emails, or tokens in logs |
| **Heartbeats** | Every 5 minutes | Uptime signal from edge |
| **Error Digest** | Daily cron | Aggregated error report email |
| **Request Tracing** | Per-request ID | Trace user journeys across services |
| **Custom Metrics** | MCU, tier, org_id | Business metrics tracked |
| **Telegram FSM Metric** | `telegram_fsm_invalid_state` | Emitted when FSM reads D1 state value failing `isBotState()` guard; reasons: schema drift, migration bug |

**Integration:** `src/lib/telemetry/*` modules for event capture, batching, delivery.

---

## Layer 3: Signals & Feedback (2026-04-17)

**PostHog Event Tracking** for product analytics & A/B testing

| Feature | Implementation | Details |
|---------|---|---|
| **Event Capture** | Lightweight SDK | Page views, feature usage, custom events |
| **A/B Framework** | EXPERIMENT_KV binding | Define experiments in D1, track variants |
| **Weekly Digest** | Cron job (Sunday 9am UTC) | Email summary of top features, funnel metrics |
| **Funnel Analysis** | Native PostHog UI | Track user journeys (signup → upgrade → mission) |

**Configuration:** `src/lib/signals/*` modules handle event batching, variant assignment, result logging.

---

## Layer 4: SDLC & Agent Factory (2026-04-17)

**4 C-Level AI Agents** sandboxed in `.sophia-factory/`

| Agent | Role | Allowed Paths | Tools |
|-------|------|---|---|
| **CTO** | Code quality + security | `src/**`, `tests/**`, `.github/**` | Read, Edit, Bash, Grep |
| **CMO** | Content + marketing | `src/app/(marketing)/**`, `messages/**`, `docs/**` | Read, Edit, Grep |
| **CSO** | Sales + pricing | `pricing/**`, `messages/**`, `docs/sales/**` | Read, Edit, Grep |
| **COO** | Operations + support | `docs/operations/**`, `.sophia-factory/journal/**` | Read, Edit |

**Artifacts:**
- Agent definitions: `.sophia-factory/agents/{cto,cmo,cso,coo}.md`
- SDLC lifecycle: `.sophia-factory/CLAUDE.{specification,design,code,deploy}.md`
- Audit trail: `.sophia-factory/journal/` (committed to repo)

**Cost:** ~$27/month total (Sonnet pricing, Opus for critical decisions only).

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Runtime** | Cloudflare Workers | Edge compute, global |
| **Framework** | Next.js 15.5 | App Router, SSR |
| **Adapter** | opennextjs-cloudflare | Next.js → CF Workers |
| **Database** | Cloudflare D1 | SQLite-based, `sophia-raas-db` |
| **Cache** | Cloudflare R2 | `sophia-ai-factory-opennext-cache` |
| **LLM Cache** | D1 (Org-Scoped) | Exact-match SHA-256 (Phase 4E) + optional semantic-similarity fallback via Workers AI embeddings (Phase 4E.2, `LLM_CACHE_SEMANTIC_ENABLED`, dark-launched; Phase 4E.2-TUNING: index widened to full 4 columns `(org_id, embedding_model, provider, model, created_at)` for range freshness queries); per-tenant isolation via `resolveOrgId()` + `getTenantContext()` helpers (Phase 4E H-1 → 4F.1 → 4F.2); `LLM_CACHE_STORE_PROMPT_TEXT=1` PII/GDPR gate (vectors always stored, text optional); `callWithCache()` wrapper wired into script-generator (Phase 4F); daily purge cron (Phase 4E.3); real LLM in workflow-stepper (Phase 4G, `WORKFLOW_REAL_LLM_ENABLED`); stats endpoints `/api/admin/llm-cache-stats` (Phase 4H) + `/api/admin/llm-trace-stats` (Phase 4I) |
| **AI Streaming** | Anthropic SSE + Tool-Use | `parseAnthropicSse()` async generator + `AnthropicStreamEvent` discriminated union (Phase 4N); `callAnthropicStreamEvents` yields 7 event types (message_start, content_block_start/stop, text_delta, input_json_delta, message_delta, message_stop; Phase 4N-POLISH: added `parse_error` variant + try/finally reader cleanup for robust error handling); `callAnthropicStream` backward-compat text-only filter; `callAnthropicFull` for tool-use flows |
| **Per-User API Keys** | D1 + AES-GCM Crypto | BYOK foundations (Phase 4G-BYOK): `user_api_keys` D1 table, AES-GCM-256 encryption (`byok-crypto.ts`), D1 store (`user-api-key-store.ts`), resolver with envFallback (`resolve-user-api-key.ts`); opt-in via `BYOK_ENABLED=1` + `BYOK_MASTER_KEY` (base64 32 bytes); Phase 4G-WIRE: fully integrated into workflow-stepper cron via `resolveOrgOwnerUserId()` helper for cron context bridge; per-user key resolution before Anthropic/OpenRouter live calls; env fallback when BYOK disabled |
| **AI Providers** | Anthropic + OpenRouter | Anthropic API adapter (Phase 4J) routes via `fetchFromAnthropicAPI()` when `ANTHROPIC_API_KEY` set; OpenRouter fallback via router (Phase 4C); cache reuse across both via `callWithCache()` |
| **Auth** | Better Auth v1.6.2 (D1) | Email/password + magic link, org plugin, no RLS |
| **Billing** | NOWPayments (primary) + PayOS (backup) | MCU credit system, webhooks |
| **Email** | Resend | Magic link, notifications |
| **AI** | Anthropic | Proposal generation |
| **Video** | HeyGen | Video generation (optional) |
| **Domain** | sophia.agencyos.network | CF Workers Custom Domains |

---

## Data Flow

### Auth Flow (Better Auth with D1)
```
User → /signup or /login
  ↓
POST /api/auth/[...all] (Better Auth endpoint)
  ↓
D1 (Kysely): Create/verify user (PBKDF2 password hash)
  ↓
Email verification or password verification
  ↓
Better Auth generates session token (cookie-based)
  ↓
Set auth session cookie (HttpOnly, secure, sameSite)
  ↓
Middleware validates session & extracts user context
  ↓
Server Components use getCurrentUser() from Better Auth client
  ↓
App layer enforces user_id/org_id ownership (no RLS needed)
```

### Magic Link Flow
```
User enters email → POST /api/auth/signIn/magicLink
  ↓
D1: Store verification link in better_auth_verifications
  ↓
Resend: Send magic link to email
  ↓
User clicks link → /api/auth/callback?token=XXX
  ↓
Better Auth verifies token & creates session
  ↓
Redirect to dashboard with session established
```

### Mission Pipeline
```
User creates mission (Dashboard or API)
  ↓
POST /api/v1/missions
  ↓
D1: Create mission record (status: queued)
  ↓
MCU balance checked + deducted
  ↓
Mission processing:
  queued → planning → executing → verifying → completed
  ↓
D1: Store results in mission_results table
  ↓
User retrieves via GET /api/v1/missions/[id]/result
```

### Billing Flow
```
User selects tier → /billing/upgrade
  ↓
POST /api/billing/checkout → Polar.sh checkout URL
  ↓
User pays via Polar.sh (credit card)
  ↓
POST /api/webhooks/polar (signature verified)
  ↓
D1: Update billing_settings (tier, polar_subscription_id)
D1: Credit MCU to org_balances
  ↓
/billing/success confirmation
```

---

## Database Schema (D1)

**Database:** `sophia-raas-db` (ID: `78bd1961-b62d-43bb-b551-0c5d7d389506`)

### Core Tables
```
users           — id, email, password_hash, full_name, role
organizations   — id, name, slug, email
org_members     — org_id, user_id, role (owner/member)
org_balances    — org_id, balance, reserved, lifetime_credits/debits
api_keys        — id, org_id, key_hash, name, is_active, expires_at, rate_limit_per_minute (Phase 4 D1 canonical)
```

### Feature Tables
```
missions        — id, org_id, template_id, status, mcu_cost
mission_results — id, mission_id, output (JSON)
usage_logs      — id, org_id, feature, mcu_used
rate_limits     — identifier (PK), current_count, window_start, window_seconds (Phase 4 D1 atomic)
export_jobs     — id, org_id, license_nonce, export_format, period_start/end, record_count, success, error_message (Phase 4 D1 cron)
```

### Billing Tables
```
billing_settings — org_id, tier, polar_subscription_id, polar_customer_id, status
```

### Growth Tables
```
referral_codes    — id, user_id, code, commission_rate (20%), earned_mcu
affiliates        — id, org_id, program_name, commission_rate
affiliate_content — id, org_id, type, title, content, status
```

---

## API Routes

### Public (No Auth)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/v1/demo` | POST | Quick demo preview (rate limited) |
| `/api/v1/demo-requests` | POST | Demo booking |
| `/api/auth/signup` | POST | User registration |
| `/api/auth/login` | POST | Password + magic link login |
| `/api/auth/callback` | POST | Magic link verification |
| `/api/webhooks/polar` | POST | Polar.sh payment events |

### Protected (Auth Required)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/org` | GET | Current org info |
| `/api/billing/subscription` | GET | Subscription + MCU balance |
| `/api/billing/checkout` | POST | Polar checkout session |
| `/api/raas/missions` | GET/POST | Mission CRUD |
| `/api/raas/keys` | GET/POST | API key management |
| `/api/raas/usage` | GET | MCU usage stats |
| `/api/proposals/generate` | POST | AI proposal (MCU billable) |
| `/api/video/generate` | POST | Video generation (MCU billable) |
| `/api/user/byok` | GET/POST/DELETE | User BYOK API key management (Phase 8C) |

### RaaS External API (Bearer Token)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/missions` | GET/POST | List/create missions |
| `/api/v1/missions/[id]` | GET | Mission detail |
| `/api/v1/missions/[id]/result` | GET | Mission output |
| `/api/v1/missions/[id]/stream` | GET | SSE real-time progress |

### Local Mode Setup (Auth Required, Phases D-F)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/setup/local-mode/provision` | POST | Activate local mekongd mode + CF Tunnel |
| `/api/setup/local-mode/status` | GET | Check local mode provisioning status |
| `/api/cron/local-mode-health` | GET | Health check for local mekongd connection |

### Admin Monitoring (CRON_SECRET, Phases 4H-4K)
| Route | Method | Purpose |
|-------|--------|---------|
| `/admin/monitoring` | GET | Server-rendered admin dashboard (D1 aggregates + LLM trace cards, Phase 4.7 + 4K) |
| `/api/admin/llm-cache-stats` | GET | JSON cache statistics (24h aggregates, Phase 4H) |
| `/api/admin/llm-trace-stats` | GET | JSON LLM trace statistics (24h aggregates by provider/model, Phase 4I) |

---

## Autonomous Operations & Cron Jobs (2026-04-15)

**Cloudflare Workers Cron Triggers:** 7 scheduled workflows for solopreneur autonomy

| Trigger | Frequency | Purpose | Implementation |
|---------|-----------|---------|---|
| Email Drip | Day 1, 3, 7 | Welcome + nurture sequence | `lib/crons/email-drip.ts` |
| Renewal Reminder | 7 days pre-expiry | Subscription renewal notifications | `lib/crons/renewal-reminder.ts` |
| Dunning State Advance | Daily | Failed payment retry logic (24h/7d/30d) | `lib/billing/dunning/state-machine.ts` |
| Scheduled Campaigns | Hourly | Time-based content distribution | `lib/campaigns/scheduled-cron.ts` |
| System Health Check | 5 minutes | Uptime monitoring (Telegram alerts) | `lib/crons/health-check.ts` |
| Quota Evaluation | 1 hour | MCU limit warnings (email + Telegram) | `lib/alerts/quota/scheduler.ts` |
| Usage Aggregation | 30 minutes | MCU rollup + balance updates | `lib/usage-metering/rollup.ts` |

**Configuration:** `wrangler.toml` defines triggers; each cron handler orchestrates async operations.

**Benefits:**
- Zero human intervention for billing, notifications, campaigns
- Customers self-serve via bot + dashboard (no support team needed)
- Autonomous error recovery (dunning retries, health alerts)

---

## Error Tracking & Client-Side Monitoring (2026-04-15)

**Sentry Integration:**
- **Client SDK:** Error tracking for frontend (React error boundaries)
- **Server SDK:** Exception capturing on Server Components and Server Actions
- **Edge Functions:** Cloudflare Workers error reporting
- **Source Maps:** Uploaded with each deployment for stack trace accuracy

**Contextual Error Pages:**
- **Auth Expiry:** 401 → "Session expired. [Re-login]" CTA
- **Network Failures:** Timeout → "Connection lost. [Retry]" CTA
- **Database Errors:** 503 → "Service temporarily unavailable. [Report]" CTA
- **Generic Errors:** 500 → "Something went wrong. [Contact Support]" CTA

**ErrorReporter Utility:**
- Client-side error logging with user context
- Aggregates errors before reporting (batching)
- Filters out known warnings (console spam)

---

## Middleware

**File:** `middleware.ts`

1. **Index rewrite:** `/` → `/landing` (opennextjs-cloudflare index bug workaround)
2. **Public route bypass:** Landing, auth, docs, blog, API v1
3. **JWT validation:** Extract org_id from verified token
4. **Protected API routes:** `/api/raas/*`, `/api/affiliate/*`, `/api/proposals/*`, `/api/video/*` require auth
5. **MCU balance check:** For billable routes (`/api/proposals/*`, `/api/video/*`)
6. **Auth redirect:** Unauthenticated page requests → `/login?redirect=PATH`
7. **Security headers:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy

---

## MCU Billing System & Tier Enforcement (2026-04-15)

### Subscription Tiers

| Tier | Price | MCU/month | Discount | Special Features |
|------|-------|-----------|----------|---|
| Starter | $49/mo | 500 | — | 10 campaigns, 0 team members |
| Growth | $149/mo | 2,000 | 10% | 50 campaigns, 5 team members |
| Premium | $499/mo | 10,000 | 20% | ∞ campaigns, ∞ team members, API access |
| Master | $999/mo | 25,000 | 30% | Lifetime (2099), white-label, all integrations |

### Tier Enforcement Gates (2026-04-15)

**Tier Normalization (Phase 4F.3):**
- `normalizePlanToTier(plan: string)` canonical helper uses `DB_TIER_MAPPING` for safe enum coercion
- Maps: "starter"→BASIC, "pro"→PREMIUM, "enterprise"→ENTERPRISE, "master"→MASTER + error fallback
- Replaces unsafe `.toUpperCase()` casts on D1 text columns (database text to TypeScript enum safety)

**MASTER Tier Special Handling:**
- **IPN Webhook:** Sets expiry to 2099-12-31 (lifetime subscription)
- **Middleware Bypass:** MCU balance check disabled for this tier
- **Feature Access:** All enterprise features available without MCU deduction
- **White-Label:** Restricted to MASTER tier only (config-enforced)

**ENTERPRISE+ Features (PREMIUM/MASTER only):**
- **Custom Integrations:** `/api/user/integrations` endpoint gated to ENTERPRISE+ tiers
- **API Access:** RaaS endpoints require PREMIUM+ tier
- **Unlimited Resources:** Campaigns, team members, MCU (PREMIUM/MASTER tiers)

**Tier Gate Application:**
- Campaign creation: DB check before insert (tier-based limits)
- Team member invites: Count enforcement (0/5/∞/∞)
- API key provisioning: Tier verification (via `normalizePlanToTier` safety wrapper)
- Integration endpoints: ENTERPRISE+ gate enforcement

### Feature Costs

| Feature | MCU | Tier Gate |
|---------|-----|---|
| `proposal:text:basic` | 10 | Starter+ |
| `proposal:text:advanced` | 25 | Growth+ |
| `proposal:text:enterprise` | 50 | Premium+ |
| `video:intro` | 100 | Premium+ |
| `video:section` | 250 | Premium+ |
| `video:full_proposal` | 500 | Premium+ |
| `affiliate:blog` | 50 | Growth+ |
| `affiliate:social` | 10 | Starter+ |
| `email:send` | 1 | Starter+ |
| `api:call` | 1 | Premium+ |

---

## Deployment

### Cloudflare Workers Config (`wrangler.toml`)
```toml
name = "sophia-ai-factory"
main = ".open-next/worker.js"
compatibility_date = "2026-03-17"
compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "sophia-raas-db"
database_id = "78bd1961-b62d-43bb-b551-0c5d7d389506"

[[r2_buckets]]
binding = "NEXT_INC_CACHE_R2_BUCKET"
bucket_name = "sophia-ai-factory-opennext-cache"

[triggers]
crons = ["*/5 * * * *"]
```

### Environment Variables (CF Worker Secrets)

| Variable | Service |
|----------|---------|
| `JWT_SECRET` | Auth token signing |
| `ANTHROPIC_API_KEY` | AI proposal generation |
| `OPENROUTER_API_KEY` | Multi-model AI |
| `HEYGEN_API_KEY` | Video generation |
| `RESEND_API_KEY` | Email delivery |
| `POLAR_ACCESS_TOKEN` | Payment processing |
| `POLAR_WEBHOOK_SECRET` | Webhook verification |
| `POLAR_PRODUCT_STARTER` | Polar product ID |
| `POLAR_PRODUCT_GROWTH` | Polar product ID |
| `POLAR_PRODUCT_PREMIUM` | Polar product ID |
| `POLAR_PRODUCT_MASTER` | Polar product ID |

### CI/CD
- **GitHub Actions:** `.github/workflows/test.yml` — lint + 205 tests
- **Deploy:** `git push origin main` → GitHub Actions → CF Workers auto-deploy
- **Build:** `npx opennextjs-cloudflare build` (from `apps/sophia-proposal/`)

### Known Workarounds
- **Index route bug:** opennextjs-cloudflare returns 500 for `/`. Fixed via middleware rewrite `/` → `/landing`
- **Peer deps:** `npm install --legacy-peer-deps` required (wrangler v3 vs @opennextjs/cloudflare)

---

## Security & Monitoring (2026-03-26 Audit)

### Authentication & Authorization
- **Better Auth:** v1.6.2 with D1 Kysely adapter, PBKDF2 password hashing, session-based cookies
- **Plugins:** emailAndPassword + magicLink + organization
- **No RLS:** Cloudflare D1 has no Row Level Security — app layer enforces ownership via `user_id` filters in all queries
- **Tenant Isolation:** All API routes verify session org_id from Better Auth context, no header-based org switching
- **Admin Enforcement:** Provision endpoints verify `role === 'admin'` before allowing changes
- **Protected Routes:** Middleware enforces authentication on all protected APIs and Server Components
- **Magic Link:** Resend integration for passwordless email login

### XSS Prevention
- **DOMPurify:** Sanitizes proposal content before rendering to prevent DOM injection
- **React Auto-escape:** Template literals and user content auto-escaped by default
- **Content Security Policy:** CSP header restricts inline scripts and external sources

### Infrastructure Security
- **HSTS Header:** Enforces HTTPS, max-age 1 year, includeSubDomains
- **Security Headers:** X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- **Rate Limiting:** `/api/v1/demo` limited to 10 req/minute per IP
- **Secrets Management:** All keys stored in CF Worker secrets (encrypted at rest), never in code

### Monitoring & Observability
- **Sentry SDK:** Error tracking for frontend, server, and edge functions
- **Structured Logging:** JSON logger for all events (`lib/logger.ts`); `logger.error()` supports `{error?, ...metadata}` object form for backward compatibility
- **Rate Limiter Metrics:** Fail-open branches emit `[metric] telegram_ratelimit_fail_open` with `reason: rpc_error|exception` — downstream log aggregator alerts on sustained spikes
- **Uptime Check:** Cron job runs `/api/health` every 5 minutes for liveness monitoring
- **D1 Backup:** Nightly automated backup via GitHub Actions to Cloudflare

### Compliance
- **Data Protection:** D1 backups encrypted by Cloudflare
- **Audit Trail:** All MCU transactions logged with user/org context
- **Branch Protection:** `main` requires code review, no force push allowed

---

## Code Organization (2026-04-14 Consolidation)

### Auth Consolidation
- **Single Source:** Better Auth v1.6.2 with D1 Kysely adapter (no multiple auth systems)
- **Deleted Files:** `lib/auth.ts`, `lib/subscription.ts`, `lib/db/auth-verify.ts`, `lib/clients/supabase-client.ts`
- **Exceptions:** OAuth callbacks remain on Supabase (external provider requirement), admin invite uses Supabase
- **Server Client:** All authenticated endpoints use `createServerClient()` from `@/lib/db/client` for D1 queries

### DB Client Consolidation
- **Migration Complete:** 112 files migrated from Supabase admin/server to D1 client
- **Entry Point:** `@/lib/db/client` exports `createServerClient()` for D1 access
- **Pattern:** All lib/ and app/api/ files use `createServerClient()` instead of Supabase clients

### Tier Logic Unification
- **Single Source:** `config/tiers/tier-configs.ts` + `config/tiers/unified-limits.ts`
- **Deleted Files:** `lib/tier-gate.ts`, `lib/unified-tier-config.ts`
- **Pattern:** Tier checks import from config, not dispersed utility files

### File Modularization (15 Giant Files → 56+ Modules)
| Original File | New Location | Module Count | Purpose |
|---|---|---|---|
| `resend-email-service.ts` | `lib/billing/email/*` | 4 | delivery, templates, tracking, types |
| `dunning-workflow.ts` | `lib/billing/dunning/*` | 3 | actions, state-machine, admin-ops |
| `quota-alert-service.ts` | `lib/alerts/quota/*` | 3 | evaluator, scheduler, delivery |
| `aggregator.ts` | `lib/usage-metering/*` | 3 | tracker, rollup, integration |
| `raas-audit.ts` | `lib/raas/*` | 4 | audit-logging, query-service, invoice, permissions |
| **10 additional large files** | **lib/*** | **+35 modules** | **2026-04-15 modularization (commit 43213f6)** |
| — | — | — | All individual modules < 200 LOC |

### Shared Utilities
- **Campaign Creation:** `lib/campaigns/create-campaign-core.ts` — unified creation logic for dashboard and API routes

## Migration Status (2026-04-14)

### Completed
- **Architecture Consolidation:** Auth unified, DB client centralized, tier logic consolidated
- **File Modularization:** 5 giant files split into 21 focused modules
- **Better Auth Framework:** v1.6.2 installed with D1 Kysely adapter
- **Dashboard Server Components:** Migrated from custom JWT to Better Auth
- **Server Actions:** All mutations use Better Auth session context
- **Database:** Migration SQL applied (0003-better-auth.sql)
- **Tests:** 859/863 tests passing (4 legacy auth component failures isolated)

### Pending (Future Task)
- **Legacy Auth Removal:** Complete removal of old JWT code after final verification (Phase 7)
- **API Routes Migration:** Verify all 58 API routes work with Better Auth session
- **E2E Testing:** Full end-to-end flow validation (signup → magic link → dashboard access)
- **Timeline:** Minimal follow-up needed; core migration complete

### Why No RLS in D1
- Cloudflare D1 (SQLite) does not support Row Level Security (RLS) policies
- **Mitigation:** App layer enforces ownership via explicit `WHERE user_id = ?` filters in all D1 queries
- This is acceptable for multi-tenant SaaS (all users are authenticated, Better Auth session is verified)
