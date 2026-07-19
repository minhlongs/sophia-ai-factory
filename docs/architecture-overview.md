# System Architecture Overview

This document presents a high-level overview of the architectural design, compute environment, database layer, background job pipeline, and external integration points of the **Sophia AI Factory** project.

For deep-dive configurations and infrastructure policies, refer to the historical [system-architecture.md](file:///Users/macbook/projects/sophia-ai-factory/docs/system-architecture.md) and the [cloud-infrastructure.md](file:///Users/macbook/projects/sophia-ai-factory/docs/cloud-infrastructure.md) runbooks.

---

## 1. Edge-Compute & Monorepo Topology

The project is designed as a partial monorepo centered on a primary serverless Next.js edge-worker application:

- **Primary Production Hub:** [apps/sophia-ai-factory/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/). Compiled using OpenNext to run inside Cloudflare Pages isolates.
- **Sidecar Services:** FastAPI containers configured under [services/](file:///Users/macbook/projects/sophia-ai-factory/services/) designed for external hosting (e.g. Fly.io or Runpod) to offload heavy rendering tasks from edge isolates.
- **Prototype Bots:** Python-based bot wrappers inside [apps/sophia-video-bot/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-video-bot/).
- **Legacy Components:** Legacy Supabase database files inside [supabase/](file:///Users/macbook/projects/sophia-ai-factory/supabase/). Note that while SQLite/D1 is the primary production database, Supabase is NOT fully obsoleted and is still actively used for JWKS token verification in the RaaS licensing layer and gateway endpoints.

---

## 2. Main System Layering (4-Layer ESM Schema)

Modules within [apps/sophia-ai-factory/src/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/) are divided into 4 layers to enforce clean separation of concerns and avoid dependency cycles. The dependency hierarchy flows strictly downward:

1. **Seed Layer:** Foundational primitives, configurations, and database query clients.
   - D1 Query Client: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts)
   - Better Auth integration: [better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts)
2. **Tree Layer:** Reusable domain-level libraries and helpers.
   - Payout calculations: [apps/sophia-ai-factory/src/tree/handover/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/handover/)
3. **Forest Layer:** Infrastructure coordination (email senders, cron routing, Inngest event mappings).
   - Inngest Client: [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/client.ts)
4. **Land Layer:** Routes, UI views, Next.js server actions, and translations.
   - Endpoint controllers: [apps/sophia-ai-factory/src/land/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/land/)

---

## 3. Core Compute & Storage Topology

```
                  ┌─────────────────────────────────────┐
                  │      Cloudflare Edge Pages          │
                  │  (NextJS Server Components & APIs)  │
                  └──────┬──────────────────────┬───────┘
                         │                      │
       ┌─────────────────▼─────────┐      ┌─────▼──────────────────┐
       │   Cloudflare D1 (SQLite)  │      │  Cloudflare R2 Buckets │
       │   - sophia-raas-db        │      │  - sophia-videos       │
       │   - sophia-tag-cache      │      │  - sophia-backups      │
       └─────────────────┬─────────┘      └────────────────────────┘
                         │
       ┌─────────────────▼─────────┐
       │     Upstash Redis REST    │
       │     - Nonce validation    │
       │     - Key revocations     │
       └───────────────────────────┘
```

- **Cloudflare Workers Pages (Compute):** Runs Next.js SSR components, edge API routing, and middlewares.
- **Cloudflare D1 (SQLite Persistence):**
  - Schema migrations are tracked chronologically inside [apps/sophia-ai-factory/migrations/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/migrations/).
  - Intercepted by [d1-client-rpc.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-client-rpc.ts) to support PostgREST-style compatibility queries.
- **Supabase (JWKS Token Verification):**
  - While SQLite/D1 is the primary production database, Supabase is actively used in the primary worker runtime for JWKS token verification in the RaaS licensing layer and gateway endpoints.
- **Cloudflare R2 (Asset Storage):** Holds raw assets, daily backups, and composed output video MP4s.
- **Upstash Redis (Cache/Security):** Lazily initialized in [redis.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/redis.ts) to handle fast key revocation queries and prevent replay attacks.

---

## 4. Background Job & Queue Architecture (Inngest)

Asynchronous workflows are handled via **Inngest**, avoiding long-running node processes.
- The entrypoint at [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts) serves background events to the Inngest runner.
- Critical processes include multi-step video compiling, token rotations, and batch ledger payouts.
- *For details on unregistered/dead background handlers, refer to the [Technical Debt Audit](file:///Users/macbook/projects/sophia-ai-factory/docs/codebase-audit/TECH_DEBT.md).*

---

## 5. External Integrations Coupling

1. **HeyGen Webhook Flow:** Validates video completions at [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts). Webhook validation resolves credentials using the tenant isolation script [heygen-webhook-secret-resolver.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/heygen-webhook-secret-resolver.ts).
2. **NOWPayments IPN Callback:** Processes subscription upgrades at [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts) using HMAC SHA-512 checks.
3. **Telegram Bot webhook:** Processes bot updates at [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts) using pairing logic linked to JWT tokens.
4. **MoviePy Rendering Microservice:** Heavy video processing (crops, subtitles) is routed to the microservice [services/moviepy-render/server.py](file:///Users/macbook/projects/sophia-ai-factory/services/moviepy-render/server.py) from [composer-ffmpeg.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts). This route is protected by a circuit breaker to avoid Worker timeouts.

---

## 6. Security & Compliance

### BYOK (Bring Your Own Key)
Customers supply their own API keys via Setup Wizard. Keys are encrypted using AES-256-GCM and stored in `user_provider_credentials`. Runtime decryption happens in-memory only.

### BYOK Rotation Framework
Key versioning infrastructure with dual-decrypt window. Inngest background job handles re-encryption. Framework complete, staging test in progress (2026-06).

### Audit Logging with Hash Chain
All critical operations logged to `raas_audit_logs` with cryptographic hash chaining for tamper-evidence (migration `0183`).

### SOC 2 Type I (In Progress)
- Auditor engaged Q2 2026
- Controls walkthrough completed
- Evidence collection in progress
- Target completion: Q3 2026

---

## 7. Deploy Pipeline & Guard

**Deploy Doctrine:** CF-direct (GitHub Actions disabled by design since 2026-05-03).

```
git push origin main
  ↓
cd apps/sophia-ai-factory && npm run deploy:full
  (type-check + build + OpenNext + SHA injection + wrangler deploy)
  ↓
Verify: /api/version shortSha matches local git SHA
```

**Deploy Guard (2026-06):** Multi-operator approval required for production deploys.
- 2 distinct admin approvals required
- Pre-push hook opens request
- Admin UI: `/dashboard/admin/deploy-guard`
- 24h TTL on approval requests
- All events logged with hash chain

**Rollback:** `npx wrangler rollback --name sophia-ai-factory`

---

## 8. Observability

### Production Stack
- **Better Stack:** Structured logging, daily error digests, 5min heartbeats
- **Sentry:** Frontend, server, edge error tracking
- **PostHog:** Event tracking, A/B testing, funnel analysis

### OpenTelemetry (Staging Complete)
- **Vendor:** Honeycomb
- **SDK:** `@opentelemetry/api` v1.9.1
- **Status:** Staging verified 2026-06-22; production rollout pending `HONEYCOMB_API_KEY`
- **Instrumentation:** API routes, Inngest functions, fetch calls
- **Report:** See `OTEL-STAGING-VERIFICATION-REPORT.md`

**Runbooks:** `docs/apm-runbook.md`, `docs/observability-runbook.md`

---
