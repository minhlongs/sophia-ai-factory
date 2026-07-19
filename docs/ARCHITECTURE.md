# System Architecture — Sophia AI Factory

This document defines the system topology, layered architecture, data scoping, request life cycles, and execution runtimes for the Sophia AI Factory platform.

---

## 1. System Context & Deployment Topology

Sophia is deployed on **Cloudflare Workers** using **Next.js 16** via an OpenNext compilation.

```
┌─────────────────────────────────────────────────────────────┐
│         Customer Browsers (HTTP/HTTPS)                      │
│──────────────────────┬──────────────────────────────────────│
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (sophia-ai-factory)                     │
│  Entry: middleware.ts (CORS, CSRF, CSP, i18n)              │
│  Serving: Next.js via OpenNext worker.js                    │
│  Domain: https://sophia.agencyos.network                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼──────────────┬─────────────┐
        │             │              │             │
        ▼             ▼              ▼             ▼
    ┌─────────┐  ┌─────────┐    ┌──────────┐  ┌───────────┐
    │ D1 RaaS │  │D1 Cache │    │R2 Videos │  │R2 Backups │
    │ DB      │  │         │    │ Public   │  │ Lifecycle │
    └─────────┘  └─────────┘    └──────────┘  └───────────┘
```

### Wrangler Bindings (`wrangler.toml`)
* `DB`: D1 database (`sophia-raas-db`) for application data.
* `NEXT_TAG_CACHE_D1`: D1 database (`sophia-tag-cache`) for Next.js cache revalidations.
* `VIDEO_BUCKET`: R2 bucket (`sophia-videos`) storing output video files.
* `BACKUPS_BUCKET`: R2 bucket (`sophia-backups`) storing database backup SQL scripts.

---

## 2. Request Lifecycle

Every HTTP request undergoes the following lifecycle:
1. **Request Entry**: Intercepted by `middleware.ts`.
2. **Security Checks**: Verifies CSRF headers for mutating calls (POST/PUT/DELETE) and injects content-security-policy (CSP) headers containing a random per-request nonce.
3. **Locale Routing**: Evaluates language prefixes (`en` or `vi`) via `intlMiddleware`.
4. **Session Extraction**: Validates the Better Auth session token cookie. If verified, the user context and current tenant ID (`org_id`) are injected into the request context.
5. **Route Execution**: Routes targeting `/api/*` run database queries scoped to the validated `org_id` before invoking business logic.

---

## 3. Data Scoping & Multi-Tenancy

The platform isolates tenant data using query-level constraints:
* **Multi-tenant Isolation**: Database schemas include an `org_id` column. Handlers check that queries filter against the current user's session organization (e.g. `eq(table.org_id, orgId)`).
* **Exception Areas**: In tables where `org_id` is nullable (such as historical `signals_events` rows), handlers default to checking `user_id` coordinates to prevent data exposure.

---

## 4. BYOK Architecture (Setup Wizard)

Customers supply their own API keys via the Setup Wizard.
1. The Setup Wizard collects raw keys securely over HTTPS.
2. The server encrypts these keys immediately using AES-256-GCM and a unique IV.
3. The server signs the payload with the `BYOK_MASTER_KEY` environment secret.
4. The encrypted credentials are saved in the `user_provider_credentials` table.
5. At runtime, the keys are decrypted on-demand in-memory, ensuring plaintext credentials never write to disk or database logs.

**Rotation Framework (2026-06):** Key versioning infrastructure with dual-decrypt window and Inngest re-encryption job. Framework complete, staging test in progress.

---

## 5. Deploy Guard (Multi-Operator Approvals)

Production deployment requires 2-party approval:
- **Gate**: Pre-deploy approval workflow in `/dashboard/admin/deploy-guard`
- **CI Integration**: Pre-push hook checks approval status
- **Audit**: All deploy events logged with cryptographic hash chain
- **TTL**: Approvals expire after 24 hours

**Workflow:** Push → Open request → Second admin approves → Deploy allowed

---

## 6. Observability & APM

**Production Stack:**
- Better Stack for structured logging (PII-safe)
- Sentry for error tracking (frontend, server, edge)
- PostHog for product analytics and A/B testing
- Daily error digest cron + uptime heartbeats (5min)

**OpenTelemetry (Staging Complete):**
- Honeycomb OTLP exporter, 100% sampling on staging
- Auto-instrumentation for API routes, Inngest, fetch
- Production rollout pending `HONEYCOMB_API_KEY`

---

## 7. Architectural Layers

The codebase is organized into four distinct inward-facing layers:
* **`seed`**: Base configuration, database clients, authentication hooks, and system logging utilities.
* **`tree`**: Domain-specific helpers, Telegram bot connectors, and audit trail handlers.
* **`forest`**: Orchestration components, Inngest task setups, and rate-limiting rules.
* **`land`**: Customer workflows, affiliate payout calculations, and subscription checkouts.

Import boundaries are strict: `seed ← tree ← forest ← land`. Backward imports (such as `seed` calling `land`) are prohibited to avoid cyclic dependencies.
