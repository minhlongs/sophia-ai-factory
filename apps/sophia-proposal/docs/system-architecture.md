# Sophia AI Factory — System Architecture

**Version:** 3.1.0 (Sprint 4 Wave 2 — RaaS Security & Rate Limiting)
**Last Updated:** 2026-03-21
**Status:** Production Ready

---

## Overview

Sophia AI Factory is an AI-powered proposal generation platform with usage-based billing via Polar.sh and a full RaaS (Robotics-as-a-Service) layer for external API consumers. Built on Next.js App Router, Cloudflare D1 + Custom JWT Auth, Polar.sh for payment processing, and the OpenClaw PEV Engine for async mission execution.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Landing   │  │   Dashboard │  │   Billing   │              │
│  │    Pages    │  │     App     │  │   Dashboard │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APP LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   API Routes                              │   │
│  │  /api/auth/*        /api/billing/*     /api/usage/*      │   │
│  │  /api/proposals/*   /api/webhooks/*    /api/onboarding/* │   │
│  │  /api/v1/*          /api/raas/*                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Server Components                         │   │
│  │  (dashboard)/(billing)/(usage) — Protected routes         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Middleware                              │   │
│  │  Auth verification, org context, balance checks           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Billing   │  │   Proposal  │  │   Onboarding│              │
│  │   Module    │  │   Engine    │  │   Module    │              │
│  │             │  │             │  │             │              │
│  │ -polar-     │  │ -templates- │  │ -pilot-     │              │
│  │ -mcu-       │  │ -quality-   │  │ -nps-       │              │
│  │ -usage-     │  │ -generate-  │  │ -checklist- │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  OpenClaw   │  │    RaaS     │                               │
│  │  PEV Engine │  │   Layer     │                               │
│  │             │  │             │                               │
│  │ -engine-    │  │ -api-key-   │                               │
│  │ -step-      │  │ -command-   │                               │
│  │  tracker-   │  │  helpers-   │                               │
│  │ -mission-   │  │ -webhook-   │                               │
│  │  queue-     │  │  delivery-  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Cloudflare D1)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL Database                     │   │
│  │  - users / organizations / organization_members           │   │
│  │  - subscriptions / org_balances / usage_logs              │   │
│  │  - proposals / templates / customer_feedback              │   │
│  │  - billing_settings / scheduled_tasks                     │   │
│  │  - pilot_onboarding / onboarding_milestones               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Database Functions (RPC)                     │   │
│  │  - credit_mcu_balance(p_org_id, p_amount)                │   │
│  │  - deduct_mcu_balance(p_org_id, p_amount, p_feature)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Polar.sh   │  │  Anthropic  │  │   HeyGen    │              │
│  │  Billing    │  │  AI (LLM)   │  │  Video API  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  HubSpot    │  │  PartnerSt. │                               │
│  │  CRM Sync   │  │  Affiliate  │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### 1. Authentication System

**Stack:** Custom JWT Auth + Next.js Middleware

```
User Signup/Login → Custom Auth → JWT Session (Web Crypto)
                         │
                         ▼
              Middleware (auth check)
                         │
                         ▼
              Inject org context → Protected routes
```

**Key Files:**
- `lib/db/client.ts` — D1 client + auth helpers
- `middleware.ts` — Route protection
- `app/api/auth/*` — Auth endpoints

### 2. Billing System (Sprint 3)

**Stack:** Polar.sh + D1 + Custom MCU tracking

#### Billing Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Polar.sh   │     │  Webhook    │
│  Clicks     │────▶│  Checkout   │────▶│  Handler    │
│  Upgrade    │     │   Session   │     │  /api/webhooks/polar │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  Event Router   │
                                      │  - subscription │
                                      │  - order.paid   │
                                      │  - order.refund │
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   MCU Credit    │
                                      │  credit_mcu_    │
                                      │    balance()    │
                                      └─────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  org_balances   │
                                      │  + usage_logs   │
                                      └─────────────────┘
```

**Key Files:**
- `lib/billing/polar-client.ts` — Polar API client
- `lib/billing/mcu-pricing.ts` — MCU cost calculations
- `lib/billing/usage-tracker.ts` — Usage logging
- `lib/billing/balance-checker.ts` — Balance queries
- `lib/billing/pilot-onboarding.ts` — Pilot customer flow
- `app/api/webhooks/polar/route.ts` — Webhook handler
- `app/api/billing/*` — Billing endpoints

#### Pricing Tiers

| Tier | Price/Mo | MCU Included | Overage Rate |
|------|----------|--------------|--------------|
| Starter | $49 | 500 MCU | $0.10/MCU |
| Growth | $149 | 2,000 MCU | $0.08/MCU |
| Premium | $499 | 10,000 MCU | $0.06/MCU |
| Master | $999 | 25,000 MCU | $0.05/MCU |

#### Feature MCU Costs

| Feature | Base MCU Cost |
|---------|---------------|
| Proposal (basic) | 10 MCU |
| Proposal (advanced) | 25 MCU |
| Proposal (enterprise) | 50 MCU |
| Video (short) | 100 MCU |
| Video (medium) | 250 MCU |
| Video (long) | 500 MCU |
| Custom template | 50 MCU |
| PDF export | 5 MCU |

**Tier Discounts:**
- Growth: 10% off
- Premium: 20% off
- Master: 30% off

### 3. Proposal Engine (Sprint 2)

**Stack:** Anthropic Claude API + Template System

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │     │  Proposal   │     │  Anthropic  │
│   Inputs    │────▶│  Generator  │────▶│   Claude    │
│  (form)     │     │   (lib/ai)  │     │    API      │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Quality Check  │
                  │  (validation)   │
                  └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   MCU Deduct    │
                  │  deduct_mcu_    │
                  │    balance()    │
                  └─────────────────┘
```

**Key Files:**
- `lib/ai/proposal-templates.ts` — Template definitions
- `lib/ai/quality-check.ts` — Output validation
- `lib/ai/client.ts` — Anthropic client
- `app/api/proposals/*` — Proposal endpoints

### 4. Usage Tracking System

**Architecture:**

```
Feature Usage → logUsage() → deduct_mcu_balance() RPC
                                      │
                                      ▼
                              ┌───────────────────┐
                              │  Atomic Check +   │
                              │   Deduct Balance  │
                              └───────────────────┘
                                      │
                                      ▼
                              ┌───────────────────┐
                              │  Insert to        │
                              │   usage_logs      │
                              └───────────────────┘
```

**Balance Check Flow:**

```
API Request → middleware.ts → checkBalance()
                                     │
                                     ▼
                          Balance < cost? ────YES───▶ HTTP 402
                                     │
                                     NO
                                     │
                                     ▼
                              Allow Request
```

### 5. Pilot Onboarding Flow

```
Payment Success → Welcome Email → Onboarding Checklist
                                         │
                                         ▼
                                  Schedule NPS (Day 7)
                                         │
                                         ▼
                                  Track Milestones:
                                  - First proposal
                                  - Onboarding call
                                  - Feedback
```

**Key Files:**
- `lib/surveys/nps.ts` — NPS survey logic
- `components/onboarding/pilot-checklist.tsx` — UI checklist
- `app/api/onboarding/status/route.ts` — Status endpoint

### 6. OpenClaw PEV Engine (Sprint 4)

**Stack:** TypeScript + D1 + In-process queue

The OpenClaw PEV (Plan → Execute → Verify) engine orchestrates async missions with retry, sub-mission chaining, and webhook notification.

#### PEV Lifecycle

```
POST /api/v1/missions (Bearer API key)
        │
        ▼ MCU balance check + reserve
        │
        ▼ INSERT missions (status: queued)
        │
        ▼ Async trigger → /api/raas/execute
        │
┌───────────────────────────────────────┐
│        MissionQueue (per-org)         │
│  max 3 concurrent slots per org_id   │
└──────────────┬────────────────────────┘
               │
        ┌──────▼──────┐
        │    PLAN     │  buildPlan(command) → PEVPlan
        └──────┬──────┘
               │ StepTracker writes execution_log to DB
        ┌──────▼──────┐
        │   EXECUTE   │  executeCommand(mission) via command-router
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │   VERIFY    │  result.success && result.data !== undefined
        └──────┬──────┘
               │
       ┌───────┴────────┐
    SUCCESS           FAILURE
       │                │
  mark done        retry (exp. backoff)
  fire webhook     → refund MCU on permanent fail
  check parent     mark failed
```

#### Retry Strategy

Exponential backoff — delay doubles per attempt. Max retries stored in `missions.max_retries`. On permanent failure, MCU is refunded via `credit_mcu_balance()` RPC.

#### Sub-Mission Chaining

`gtm:campaign` spawns 4 child missions (`proposal:create`, `video:create`, `content:blog`, `content:social`). Children can run in parallel or sequential order based on `dependency_type`. Completion propagates to parent — the engine checks all siblings before marking the parent `completed`.

**Key Files:**

| File | Responsibility |
|------|----------------|
| `lib/openclaw/engine.ts` | PEV orchestrator, retry, sub-missions, webhook notify |
| `lib/openclaw/step-tracker.ts` | Per-step DB progress tracking (JSONB `execution_log`) |
| `lib/openclaw/mission-queue.ts` | In-process concurrency limiter (3 slots/org, FIFO) |
| `lib/raas/command-router.ts` | Route `mission.command` to correct handler |
| `lib/raas/pev-executor.ts` | Entry point called by `/api/raas/execute` |

#### Supported Commands

| Command | Steps | Sub-missions |
|---------|-------|--------------|
| `proposal:create` | Parse params → Generate content → Save to DB | — |
| `video:create` | Generate script → Submit to HeyGen → Poll completion | — |
| `crm:sync` | Connect HubSpot → Sync contacts → Sync deals | — |
| `analytics:export` | Query usage → Format output → Return export | — |
| `affiliate:generate` | Fetch program → Generate blog → Generate social | — |
| `affiliate:scrape` | Connect PartnerStack → Normalize → Upsert DB | — |
| `content:blog` | Research topic → Generate SEO post → Save | — |
| `content:social` | Fetch context → Generate LinkedIn/Twitter/TikTok → Save | — |
| `sales:battlecard` | Research competitor → Generate battlecard → Save | — |
| `gtm:campaign` | — | proposal:create + video:create + content:blog + content:social |

### 7. RaaS Layer — Sale API (Sprint 4)

**Stack:** Next.js API Routes + D1 + Bearer auth

External partners and CLI tools consume Sophia AI Factory as a service via versioned REST endpoints authenticated with long-lived API keys.

#### API Key Lifecycle

```
POST /api/raas/keys (session auth)
  → generateApiKey() → sk_live_{48 hex chars}
  → SHA-256 hash stored in raas_api_keys
  → raw key returned ONCE to caller
  → only key_prefix (first 16 chars) stored for display

Incoming request: Authorization: Bearer sk_live_xxxx
  → validateApiKey() → SHA-256 hash lookup
  → check is_active + expires_at
  → update last_used_at (fire-and-forget)
  → return { valid, orgId, keyId, permissions }
```

#### RaaS API Endpoints (External — `/api/v1/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/missions` | Bearer API key | Create + queue mission, deduct MCU |
| GET | `/api/v1/missions` | Bearer API key | List org missions (filters: status, limit) |

#### RaaS Management Endpoints (Internal — `/api/raas/`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/raas/keys` | Session | List API keys (no hash) |
| POST | `/api/raas/keys` | Session | Create API key |
| DELETE | `/api/raas/keys/[id]` | Session | Revoke API key |
| GET | `/api/raas/missions` | Session | List missions dashboard |
| GET | `/api/raas/usage` | Session | Usage statistics |
| GET | `/api/raas/templates` | Session | List mission templates |
| POST | `/api/raas/execute` | Internal secret | Trigger PEV execution |

#### Usage Metering

Every API call records to `raas_api_usage`:
- `api_key_id`, `org_id`, `endpoint`, `method`
- `status_code`, `mcu_consumed`, `response_time_ms`

#### Webhook Delivery & Security (Wave 2)

When a mission has `webhook_url`, completion fires a POST to that URL via `lib/raas/webhook-delivery.ts`:
- Payload: `{ mission_id, status, result, completed_at }`
- **HMAC-SHA256 signing** — All webhook deliveries signed with format: `t={timestamp},v1={hmac}`
- Timestamp binding prevents replay attacks
- Constant-time comparison for signature verification
- Retries with exponential backoff
- Delivery status recorded in `raas_webhook_deliveries`

**Webhook Security Flow:**
```
Mission completion
      │
      ▼
Generate timestamp (unix)
      │
      ▼
HMAC-SHA256(webhook_body + timestamp, WEBHOOK_SIGNING_SECRET)
      │
      ▼
POST with header: X-Webhook-Signature: t={ts},v1={hmac}
      │
      ▼
Recipient verifies: HMAC & timestamp within 5min window
```

**ENV Requirement:**
```
WEBHOOK_SIGNING_SECRET=sk-webhook-xxx (min 32 chars)
```

#### Rate Limiting (Wave 2)

All `/api/v1/*` endpoints enforce sliding-window rate limiting per API key:
- **Rate limit key:** `raas_api_keys.rate_limit_per_minute` (default: 60 requests/min)
- **Implementation:** In-process Map with timestamp buckets
- **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Enforcement:** HTTP 429 on exceeded limit
- **Cleanup:** Periodic removal of stale buckets (>5min old)

**Rate Limit Flow:**
```
Request with Bearer token
      │
      ▼
validateApiKey() returns rate_limit_per_minute
      │
      ▼
Check sliding window (current minute requests)
      │
      ▼
Exceeded?  ──YES──▶ HTTP 429 Too Many Requests
      │
      NO
      │
      ▼
Increment counter, return 200
Include: X-RateLimit-{Limit,Remaining,Reset} headers
```

**New Endpoints (Wave 2):**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/missions/:id` | Bearer API key | Get mission status + result (rate limited) |
| POST | `/api/v1/missions/:id/cancel` | Bearer API key | Cancel queued/planning missions, refund MCU |
| GET | `/api/v1/missions/:id/result` | Bearer API key | Lightweight polling — 202 in-progress, 200 done |

**Key Files:**

| File | Responsibility |
|------|----------------|
| `lib/raas/api-key-manager.ts` | SHA-256 key gen/validation, CRUD, revocation |
| `lib/raas/command-helpers.ts` | Real execution: proposal, video (HeyGen), CRM sync (HubSpot), analytics, GTM, battlecard |
| `lib/raas/usage-meter.ts` | Record API usage to `raas_api_usage` |
| `lib/raas/webhook-delivery.ts` | HMAC-signed async webhook POST with retry |
| `lib/raas/rate-limiter.ts` | Sliding-window per-key rate limiting (in-process Map) |
| `app/api/v1/missions/route.ts` | External API: Bearer auth, MCU billing, async PEV trigger |
| `app/api/v1/missions/[id]/route.ts` | GET status + result endpoint with rate limiting |
| `app/api/v1/missions/[id]/cancel/route.ts` | POST to cancel + refund MCU |

---

## Database Schema

### Core Tables

```sql
-- Users & Organizations (Sprint 1)
users (Custom JWT Auth)
organizations
  - id, name, slug, created_at
organization_members
  - org_id, user_id, role (admin/member)

-- Proposals (Sprint 2)
proposals
  - id, org_id, title, content, status
  - created_at, updated_at

-- Billing (Sprint 3)
subscriptions
  - id, org_id, polar_subscription_id, polar_customer_id
  - tier_name, status, mcu_monthly, mcu_overage_rate
  - current_period_start, current_period_end

org_balances
  - org_id (PK), balance, lifetime_credits, lifetime_used

usage_logs
  - id, org_id, feature, mcu_cost, metadata (JSONB)

billing_settings
  - org_id (PK), polar_customer_id, auto_recharge

customer_feedback
  - id, org_id, survey_type, responses (JSONB), nps_score

pilot_onboarding (optional)
  - org_id, started_at, status, nps_scheduled_at

onboarding_milestones (optional)
  - org_id, milestone_type, completed_at

-- OpenClaw missions (Migration 011 ALTER)
missions
  - id, org_id, title, command, params (JSONB), status
  - plan (JSONB), execution_log (JSONB[])
  - mcu_cost, mcu_reserved, priority
  - retry_count, max_retries, parent_mission_id
  - webhook_url, result (JSONB), error_message
  - started_at, completed_at, created_at, updated_at

-- Migration 011: new tables
mission_dependencies
  - id, mission_id, depends_on_mission_id, dependency_type

mission_retries
  - id, mission_id, attempt_number, error_message, retried_at

-- RaaS layer (Migration 012)
raas_api_keys
  - id, org_id, name, key_hash (SHA-256), key_prefix
  - permissions (text[]), rate_limit_per_minute
  - is_active, last_used_at, expires_at, created_at

raas_api_usage
  - id, api_key_id, org_id, endpoint, method
  - status_code, mcu_consumed, response_time_ms, created_at

raas_webhook_deliveries
  - id, mission_id, org_id, webhook_url, payload (JSONB)
  - status, attempt_count, last_attempted_at, delivered_at
```

### Key Database Functions

```sql
-- Credit MCU balance (idempotent)
credit_mcu_balance(p_org_id UUID, p_amount INTEGER, p_subscription_id TEXT)

-- Deduct MCU balance (atomic check + deduct)
deduct_mcu_balance(p_org_id UUID, p_amount INTEGER, p_feature TEXT, p_metadata JSONB)
  RETURNS BOOLEAN  -- true if successful, false if insufficient balance
```

---

## Security Architecture

### Row Level Security (RLS)

All billing tables have RLS enabled:

| Table | Select Policy | Insert/Update Policy |
|-------|---------------|---------------------|
| subscriptions | Org members | Service role only |
| usage_logs | Org members | Service role only |
| org_balances | Org members | Service role only |
| billing_settings | Org admins | Org admins only |
| customer_feedback | Org members | Org members |

### Webhook Security

Polar webhook handler implements:
1. **HMAC signature verification** — SHA256 with timestamp
2. **Event deduplication** — In-memory store with 24h window
3. **Idempotency keys** — `polar_order_id` unique constraint
4. **Amount validation** — Reject <= 0 amounts
5. **Product validation** — Verify product_id matches known tiers

### Balance Protection

1. **Atomic RPC operations** — Check + deduct in single transaction
2. **HTTP 402 on zero balance** — Middleware blocks requests
3. **No negative balances** — Deduct returns false if insufficient

---

## API Routes

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |

### Billing (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/billing/checkout` | Create Polar checkout session |
| POST | `/api/billing/portal` | Create customer portal session |
| POST | `/api/billing/subscription` | Get/update subscription |
| POST | `/api/webhooks/polar` | Polar webhook handler |

### Usage (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/usage` | Get usage history + summary |
| GET | `/api/usage/summary` | Get aggregated usage stats |

### Proposals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals` | List proposals |
| POST | `/api/proposals` | Create proposal |
| GET | `/api/proposals/[id]` | Get proposal |
| DELETE | `/api/proposals/[id]` | Delete proposal |
| POST | `/api/proposals/generate` | Generate AI proposal |

### Onboarding (Sprint 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/onboarding/status` | Get onboarding status |
| POST | `/api/feedback` | Submit NPS feedback |

### External RaaS API (Sprint 4 — Bearer API key auth, with Wave 2 rate limiting & HMAC)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/missions` | Create + queue mission, deduct MCU (rate limited) |
| GET | `/api/v1/missions` | List missions (filter: status, limit) (rate limited) |
| GET | `/api/v1/missions/:id` | Get mission status + result (rate limited) |
| GET | `/api/v1/missions/:id/result` | Lightweight result polling — 202 in-progress, 200 done (rate limited) |
| POST | `/api/v1/missions/:id/cancel` | Cancel queued/planning missions, refund MCU (rate limited) |

### RaaS Management (Sprint 4 — Session auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/raas/keys` | List API keys |
| POST | `/api/raas/keys` | Create API key (returns raw key once) |
| DELETE | `/api/raas/keys/[id]` | Revoke API key |
| GET | `/api/raas/missions` | Mission dashboard |
| GET | `/api/raas/usage` | Usage stats |
| GET | `/api/raas/templates` | Mission templates |
| POST | `/api/raas/execute` | Trigger PEV (internal secret) |

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Vercel Platform                           │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Static Pages  │  │  Serverless    │  │  Edge Config    │  │
│  │   (Landing)    │  │  Functions     │  │  (Env Vars)     │  │
│  │                │  │  (API Routes)  │  │                 │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
│                                                               │
│  Deployment: `git push origin main` → GitHub Actions → Vercel │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Cloudflare D1                             │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐                      │
│  │  D1 Database   │  │  Custom JWT    │                      │
│  │  (SQLite edge) │  │  Auth (Web     │                      │
│  │                │  │   Crypto API)  │                      │
│  └────────────────┘  └────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Polar.sh Billing                          │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐                      │
│  │  Checkout      │  │  Webhooks      │                      │
│  │  (Hosted)      │  │  (to /api)     │                      │
│  └────────────────┘  └────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

### Application Monitoring

- **Error Tracking:** Console errors logged to server
- **Performance:** Vercel Analytics for page load metrics
- **Usage Tracking:** Built-in MCU consumption logs

### Business Metrics

| Metric | Source | Target |
|--------|--------|--------|
| MRR | Polar.sh subscriptions | Track via dashboard |
| MCU Consumption | usage_logs | Monitor burn rate |
| NPS Score | customer_feedback | > 50 |
| Activation Rate | pilot_onboarding | > 60% complete Day 7 |

---

## Sprint History

| Sprint | Date | Features |
|--------|------|----------|
| Sprint 1 | 2026-03 | Auth, Organization Management |
| Sprint 2 | 2026-03 | AI Proposal Engine |
| Sprint 3 | 2026-03 | Polar Billing + MCU Tracking + Pilot Onboarding |
| Sprint 4 | 2026-03-21 | OpenClaw PEV Engine + RaaS Layer (19 files, 72 routes, migrations 011-012) |

---

## Related Documentation

- [Code Standards](./code-standards.md)
- [Deployment Guide](./deployment-guide.md)
- [API Documentation](./api-docs.md)
- [Project Overview PDR](./project-overview-pdr.md)
