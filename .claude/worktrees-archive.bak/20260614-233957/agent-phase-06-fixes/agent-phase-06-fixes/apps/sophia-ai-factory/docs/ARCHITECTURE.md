# Sophia AI Factory — System Architecture

**Date:** 2026-05-22  
**Context:** Phase 2 of Go-Live 100/100 Audit — anchored to Phase 1 synthesis + research reports.

---

## 1. System Context & Deployment Topology

Sophia runs on **Cloudflare Workers + Next.js 16** via OpenNext build.

```
┌─────────────────────────────────────────────────────────────┐
│         Customer Browsers (HTTP/HTTPS)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (sophia-ai-factory)                     │
│  Entry: middleware.ts (CORS, CSRF, CSP, i18n)              │
│  Serving: Next.js via OpenNext worker.js                    │
│  Domain: https://sophia.agencyos.network                    │
└─────────────────────┬──────────────────────────────────────┘
                      │
        ┌─────────────┼──────────────┬─────────────┐
        │             │              │             │
        ▼             ▼              ▼             ▼
    ┌─────────┐  ┌─────────┐    ┌──────────┐  ┌───────────┐
    │ D1 RaaS │  │D1 Cache │    │R2 Videos │  │R2 Backups │
    │DB (78b1)   │(7b1d)   │    │ Public   │  │ Lifecycle │
    │ 117 migs    │mig 0108│    │ 30d rot  │  │ 30d ret   │
    └─────────┘  └─────────┘    └──────────┘  └───────────┘
```

**Bindings (wrangler.toml):**
- `DB`: D1 `sophia-raas-db` (ID: `78bd1961-*`)
- `NEXT_TAG_CACHE_D1`: D1 `sophia-tag-cache` (ID: `7b1d4fd4-*`, mig 0108)
- `VIDEO_BUCKET`: R2 `sophia-videos` (CORS public)
- `BACKUPS_BUCKET`: R2 `sophia-backups` (30-day lifecycle, disaster recovery)
- `NEXT_INC_CACHE_R2_BUCKET`: R2 `sophia-ai-factory-opennext-cache` (build artifact cache)
- `WORKER_SELF_REFERENCE`: self-referential service binding for internal routing

---

## 2. Request Lifecycle

All HTTP requests follow this path:

```
1. Incoming Request (HTTPS)
       ↓
2. middleware.ts
   ├─ handleCorsPrelight (OPTIONS)
   ├─ applyCorsHeaders (origin validation)
   ├─ intlMiddleware (locale routing: en/vi)
   ├─ generateNonce (CSP per-request)
   ├─ verifyCsrfToken (POST/PUT/DELETE)
   ├─ buildCSPHeader (nonce-based policy)
   └─ emitUsageEvent (async, log to forest/usage-metering)
       ↓
3. Route Matching
   ├─ /api/* → handleApiRoute (in middleware-api-handler.ts)
   │   └─ Check: Better Auth session, org_id FK, tier gate
   ├─ /[locale]/dashboard/* → Server Components (auth required)
   ├─ /[locale]/* → Server Components + data streams (public)
   └─ Static assets → ASSETS binding (CF cache)
       ↓
4. Handler (API route or Server Component)
   ├─ Call createServerClient() [synchronous, NOT await]
   ├─ Query D1 with org_id filter (multi-tenancy)
   ├─ Call tree/forest/land business logic
   ├─ For mutations: Server Actions (via app/actions/)
   └─ Return Response or redirect
       ↓
5. Middleware post-processing
   ├─ Attach CSP header (nonce from step 2)
   ├─ Set CSRF cookie (if GET)
   ├─ Apply CORS headers
   └─ Send to client
```

**Key:** Middleware wraps ALL routes. CSP nonce is random per request; CSRF uses double-submit cookie pattern.

---

## 3. Cron Lifecycle

**18 cron patterns → 30 handlers (with 12 unscheduled/manual).**

### Routing model

Cron routes are dispatched via `__cronScheduledHandler` in `/api/cron/[handler]/route.ts`:

```
External trigger (webhook/manual curl)
    ↓
POST /api/cron/<handler> + header: CRON_SECRET
    ↓
middleware.ts (CSRF exempt for cron routes)
    ↓
__cronScheduledHandler({ params: { handler } })
    ├─ Verify CRON_SECRET header
    ├─ Route to specific handler logic
    └─ Log execution (audit trail via forest/audit)
```

### 30 Cron handlers (per researcher-01)

| Handler | Status | Trigger | Purpose |
|---------|--------|---------|---------|
| `ab-winner-picker` | Scheduled | Daily | Pick winning variant from A/B tests |
| `affiliate-scout` | Scheduled | Daily | Scan affiliate network updates |
| `clearance-promote` | Scheduled | Daily | Auto-promote tier after trial |
| `d1-backup` | Manual (route exists) | External QStash | D1 snapshot → R2 backup |
| `daily-rollup` | Scheduled | Daily | Aggregate usage metrics |
| `dunning-advance` | Scheduled | Hourly | Failed payment retry state machine |
| `email-drip` | Scheduled | 6-hourly | Send queued email campaigns |
| `email-outbox-flush` | Scheduled | Hourly | Process outgoing emails (Inngest) |
| `error-digest` | Scheduled | 6-hourly | Aggregate Sentry errors, send admin alerts |
| `fulfillment-reconcile` | Scheduled | Daily | Match orders to fulfillment (affiliate) |
| `fulfillment-retry` | Scheduled | Hourly | Retry failed fulfillment webhooks |
| `handover-status-sync` | Scheduled | 30-min | Sync Telegram handover status (tree/handover) |
| `heartbeat` | Scheduled | 5-min | Liveness check (monitoring) |
| `hourly-rollup` | Scheduled | Hourly | Hourly usage aggregation |
| `llm-cache-purge` | Scheduled | Daily | Clean expired LLM cache (tree/byok) |
| `local-mode-health` | Manual | Dev testing | Local-mode test endpoint |
| `mcu-monthly-reset` | Scheduled | Month-end | MCU (monthly custom usage) reset |
| `oauth-token-cleanup` | Scheduled? | On-demand | Revoke expired OAuth tokens (Supabase) |
| `promo-trial-expiry` | Scheduled | Daily | Expire promotional trial periods |
| `quota-check` | Scheduled | Hourly | Check quota exhaustion, send warnings |
| `scheduled-campaigns` | Scheduled | 30-min | Trigger scheduled video campaigns |
| `sop-template-sync` | Scheduled? | Weekly? | Sync Standard Operating Procedure templates |
| `stripe-connect-sync` | Scheduled? | Daily | Sync Stripe Connect balances (affiliate) |
| `tag-cache-cleanup` | Scheduled | Daily | Clean OpenNext revalidateTag D1 cache |
| `team-invites-cleanup` | Scheduled | Daily | Expire pending org invitations |
| `tier-change-events` | Manual? | On-demand | Emit tier change events to Inngest |
| `ttl-cleanup` | Manual | On-demand | Run TTL (time-to-live) cleanup jobs |
| `user-cleanup` | Scheduled? | Weekly | Archive inactive users (GDPR) |
| `video-fulfillment` | Scheduled | 5-min | Fulfill video generation requests |
| `webhook-failure-retry` | Scheduled | Hourly | Retry failed webhooks (NOWPayments, etc.) |

**Flag:** 12 routes visible in /api/cron/ but some handlers' cron registration unknown (manual, external qstash, or deactivated). Verify via grep in Inngest job definitions.

---

## 4. Authentication & Tier Model

### Auth Flow

```
User Login
    ↓
Better Auth v1.6.2 (email/password or magic link)
    ├─ Create session (7-day expiry)
    ├─ Set http-only cookie (better-auth-session-token)
    └─ (Optional: Org plugin creates org if first login)
    ↓
middleware.ts calls getAuth() → returns session + user
    ├─ Cache session in request header (x-auth-user)
    └─ Available to all route handlers via getCurrentUser()
    ↓
API routes check: org_id from session
    └─ Query D1 with: WHERE org_id = $1 (tenant isolation)
```

### Tier Enforcement (Dual-Layer)

**1. Setup (MASTER tier only):**
- Customers enter API keys in Setup Wizard (BYOK)
- API keys encrypted via AES-GCM-256 + BYOK_MASTER_KEY (tree/byok-setup.ts)
- Tier enum: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase)

**2. Runtime (all tiers):**
- Middleware middleware-api-handler.ts checks tier gate (seed/config/tiers)
- Feature flags per tier (e.g., MASTER only: custom branding, advanced analytics)
- Quota enforcement per tier (forest/quota): API calls, video renders, storage (land/billing/quota-enforcer)
- If quota exceeded: 429 response or async warning email (land/billing/usage-aggregator)

**Config source:** `@/seed/config/tiers` (unified, tested).

---

## 5. Multi-Tenancy Enforcement

Sophia enforces multi-tenancy via **org_id FK + query-time filtering**. No RLS (Row-Level Security) because D1 doesn't support it natively.

### org_id propagation

```
1. User logs in → getCurrentUser() → session.org_id
2. Middleware injects: request.org_id = session.org_id
3. All API handlers pass org_id to D1 queries:
   SELECT * FROM campaigns WHERE org_id = $1 AND ...
4. Server Actions receive org_id implicitly from auth context
5. Inngest jobs receive org_id in payload (forest/inngest/functions/*)
```

### Exceptions (org_id is nullable or absent)

- **campaigns table**: `user_id` only (no `org_id`) — single-user campaigns before org migration
- **signals_events table**: `org_id` nullable — legacy events from pre-multi-tenant era
- **user_sop_installations**: has org_id but used for both single-user and org contexts

**Risk:** If org_id is not checked in a route, data may leak across orgs. Mitigated by: pre-push tests + ESLint rule (TBD).

---

## 6. BYOK Architecture (Setup Wizard)

Customers configure integrations via **Setup Wizard** (no operator involvement).

```
Setup Wizard UI (React)
    ├─ openrouter: input API key
    ├─ elevenLabs: input API key
    ├─ d-id or heygen: input API key
    ├─ telegram: input bot token
    ├─ payment provider: NOWPayments or PayOS (selected, not setup)
    └─ affiliate network: optional (Awin, ShareASale)
         ↓
    Server Action: action:save-setup-wizard
         ├─ Receive credentials (plaintext)
         ├─ Encrypt via AES-GCM-256 + IV + BYOK_MASTER_KEY
         ├─ Store ciphertext in user_provider_credentials table
         └─ Return org_id + setup status
         ↓
    Runtime: forest/raas/provider-resolver.ts
         ├─ Fetch ciphertext from D1
         ├─ Decrypt on-demand (in-memory)
         ├─ Use plaintext secret in API calls (OpenRouter, ElevenLabs, etc.)
         └─ Never persist plaintext to DB
```

**Guarantees:**
- Customer keys never leave their org (org_id FK in user_provider_credentials)
- Operator has NO access to BYOK_MASTER_KEY (injected at deploy time only)
- Key rotation available via Setup Wizard re-entry (overwrite ciphertext)

---

## 7. Durable Objects (Workers specific)

Sophia uses **3 Durable Objects** for state coordination:

| Object | Binding | Purpose | Lifecycle |
|--------|---------|---------|-----------|
| Queue | `QUEUE_DO` | Distribute Inngest jobs across workers | Created per org; persists until explicit delete |
| TagCache | `TAG_CACHE_DO` | Cache revalidateTag directives (D1 backup) | Auto-GC; synced to D1 migration 0108 |
| BucketPurge | `BUCKET_PURGE_DO` | Coordinate R2 object deletion (cleanup) | Ephemeral; short-lived locks |

**Use:** Long-lived coordinator for distributed system operations. Not for business logic.

---

## 8. Three Phase-1 Unresolved Questions (Flags)

### Q1: TagCache DB scope (`sophia-tag-cache` vs `sophia-raas-db`)

**Issue:** Migration 0108 creates `revalidations` table in separate D1 instance (`sophia-tag-cache`).  
**Question:** Why not in main `sophia-raas-db`? Was this an accident or intentional?  
**Risk:** Two D1 instances = two failover paths. If `sophia-tag-cache` is unavailable, OpenNext tag revalidation fails silently.  
**Action:** Phase 4 to clarify and possibly consolidate to single D1 instance.

### Q2: `enriched-jwt.ts` purpose

**File:** `src/seed/auth/enriched-jwt.ts`  
**Question:** What does this middleware do? Is it used in production or legacy?  
**Risk:** If not used, it's technical debt. If used, its security implications (JWT signing key) need audit.  
**Action:** Verify import count via grep; document or remove.

### Q3: OpenNext version sync mechanism

**Issue:** `src/app/api/version/route.ts:33` hardcodes `opennextVersion: '1.17.3'` while `package.json` specifies `^1.19.5`.  
**Question:** How is this version string maintained? Is there a manual sync step?  
**Risk:** Drift between reported version and actual deployment. Affects audit trail.  
**Action:** Phase 4 to auto-inject version at build time.

---

## 9. Request Flow Diagram (ASCII)

```
              ┌─ Cron (30 routes)
              │  /api/cron/<handler>
              │  ├─ CRON_SECRET auth
              │  ├─ No CSRF check
              │  └─ Async job dispatch → Inngest
              │
HTTP Request ┤─ API (/api/*)
             │  ├─ Better Auth session
             │  ├─ org_id filtering
             │  ├─ Zod validation (contract tests)
             │  └─ Server Action or JSON response
             │
             └─ Server Component (/[locale]/*)
                ├─ React Server Components (RSC)
                ├─ Streaming responses
                └─ Static assets (CSS, JS, images)

                 All routes:
                 1. CORS + CSP nonce (middleware)
                 2. i18n locale routing
                 3. CSRF double-submit verification
                 4. Usage event emission (forest/usage-metering)
```

---

## 10. Data Layer

**Primary:** Cloudflare D1 (SQLite) with 117 migrations applied.

**Key tables (by domain):**
- **Auth:** `accounts`, `sessions`, `organizations` (Better Auth plugin)
- **Users:** `users`, `user_profiles`, `user_api_keys`, `user_provider_credentials` (BYOK)
- **Billing:** `orders`, `order_items`, `payment_events`, `tier_change_events`, `invoices`
- **Usage:** `llm_cache`, `quota_check_logs`, `rate_limits`, `signals_events`
- **Handover:** `telegram_pairings`, `handover_status`, `user_sop_installations`
- **Campaigns:** `campaigns`, `campaign_videos`, `publishing_jobs`, `video_jobs`
- **Affiliate:** `affiliate_applications`, `stripe_connect_links`, `revenue_split_rules`
- **Observability:** `error_logs`, `audit_logs`, `ab_experiments`

**Exceptions (Supabase, not D1):**
- OAuth token persistence (TikTok, YouTube, GitHub OAuth)
- Admin invite verification (email-based, short-lived)
- Checkpoint persistence (agent evaluation milestones)

**Queries:** All are parameterized. Accessed via `createServerClient()` (sync, from `@/seed/db/client`).

---

## 11. Layered Architecture (seed→tree→forest→land)

Sophia follows a 4-layer model for code organization:

```
seed (147 files)
├─ Primitives: types, config, DB client, auth base, security utils
├─ Examples: seed/auth/better-auth-session.ts, seed/config/tiers/, seed/db/client.ts
└─ Import: can be imported by ANY layer (foundational)

tree (162 files)
├─ Domain-reusable: bot logic, BYOK store, handover, audit
├─ Examples: tree/byok/, tree/handover/, tree/telegram/, tree/audit/
└─ Import: seed only

forest (362 files)
├─ Infrastructure orchestration: Inngest jobs, RAAS gateway, usage metering, quota
├─ Examples: forest/inngest/, forest/raas/, forest/usage-metering/, forest/quota/
└─ Import: seed + tree (may call land for orchestration)

land (113 files)
├─ Business workflows: billing, payouts, affiliates, promos, refunds
├─ Examples: land/billing/, land/payouts/, land/affiliates/
└─ Import: seed + tree + forest (receives orchestration calls from forest)
```

**Rules:** No backward edges (land → forest forbidden; would be circular).

---

## Summary

Sophia AI Factory is a **no-code RaaS platform** deployed on Cloudflare Workers + D1. Architecture enforces:
- **Multi-tenancy:** org_id query-time filtering (no RLS)
- **BYOK security:** customer keys encrypted at rest (AES-GCM-256 + master key)
- **Tier gating:** dual-layer (setup + runtime quota enforcement)
- **Async jobs:** Inngest + 30 cron handlers for background work
- **Modular code:** 4-layer architecture (seed→tree→forest→land) with clear boundaries

**Deployment:** CF-direct via `npm run deploy:full` (GitHub Actions disabled). Verification requires SHA match via `/api/version` endpoint.

**Open:** 3 flagged questions regarding TagCache scope, enriched-jwt purpose, and OpenNext version sync.
