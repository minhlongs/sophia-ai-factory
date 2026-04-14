# System Architecture / Kien Truc He Thong

> Sophia AI Factory — RaaS (Reasoning-as-a-Service) Platform

**Last Updated:** 2026-04-14
**Production:** https://sophia.agencyos.network

**AUTHENTICATION MIGRATION (2026-04-14):** Dashboard Server Components and Server Actions migrated to Better Auth v1.6.2 with D1 Kysely adapter. Email/password + magic link + organization plugin. RLS not used — app layer enforces ownership via `user_id` filters.

**PAYMENT PROVIDER MIGRATION (2026-04-10):** Polar.sh references below are historical. Active providers now: NOWPayments (primary) + PayOS (Vietnam backup). See `project-changelog.md` for migration status.

---

## Component Diagram

```
                        ┌──────────────────────────┐
                        │     Next.js 15.5          │
                        │  (Cloudflare Workers)     │
                        │  opennextjs-cloudflare    │
                        └────────────┬─────────────┘
                                     │
     ┌───────────────┬───────────────┼───────────────┬───────────────┐
     │               │               │               │               │
┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
│  Pages  │    │   API     │   │ Middleware │  │   Auth    │  │  Billing  │
│  (SSR)  │    │  Routes   │   │ (JWT+MCU) │  │(JWT D1   │  │(NOWPayments)│
│  D1 Auth│    │  Routes   │   │ (JWT+MCU) │  │ + HMAC)  │  │(+ PayOS)  │
└────┬────┘    └─────┬─────┘   └───────────┘  └───────────┘  └───────────┘
     │               │                         └───────────┘
     └───────────────┤
                     │
     ┌───────────────┼───────────────┐
     │               │               │
┌────▼────┐    ┌─────▼──────┐  ┌─────▼──────┐
│Cloudflare│   │  R2 Bucket │  │  External  │
│   D1    │    │  (Cache)   │  │   APIs     │
│(SQLite) │    └────────────┘  │            │
│         │                    │ Anthropic  │
│- users  │                    │ HeyGen     │
│- orgs   │                    │ Resend     │
│- missions│                   │ Polar.sh   │
│- billing │                   └────────────┘
│- api_keys│
│- usage   │
└──────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Runtime** | Cloudflare Workers | Edge compute, global |
| **Framework** | Next.js 15.5 | App Router, SSR |
| **Adapter** | opennextjs-cloudflare | Next.js → CF Workers |
| **Database** | Cloudflare D1 | SQLite-based, `sophia-raas-db` |
| **Cache** | Cloudflare R2 | `sophia-ai-factory-opennext-cache` |
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
api_keys        — id, org_id, key_hash, name, last_used_at, revoked_at
```

### Feature Tables
```
missions        — id, org_id, template_id, status, mcu_cost
mission_results — id, mission_id, output (JSON)
usage_logs      — id, org_id, feature, mcu_used
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

### RaaS External API (Bearer Token)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/missions` | GET/POST | List/create missions |
| `/api/v1/missions/[id]` | GET | Mission detail |
| `/api/v1/missions/[id]/result` | GET | Mission output |
| `/api/v1/missions/[id]/stream` | GET | SSE real-time progress |

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

## MCU Billing System

### Subscription Tiers

| Tier | Price | MCU/month | Discount |
|------|-------|-----------|----------|
| Starter | $49/mo | 500 | — |
| Growth | $149/mo | 2,000 | 10% |
| Premium | $499/mo | 10,000 | 20% |
| Master | $999/mo | 25,000 | 30% |

### Feature Costs

| Feature | MCU |
|---------|-----|
| `proposal:text:basic` | 10 |
| `proposal:text:advanced` | 25 |
| `proposal:text:enterprise` | 50 |
| `video:intro` | 100 |
| `video:section` | 250 |
| `video:full_proposal` | 500 |
| `affiliate:blog` | 50 |
| `affiliate:social` | 10 |
| `email:send` | 1 |
| `api:call` | 1 |

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
| `JWT_SECRET=REDACTED` | Auth token signing |
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
- **Structured Logging:** JSON logger for all events (lib/logger.ts)
- **Uptime Check:** Cron job runs `/api/health` every 5 minutes for liveness monitoring
- **D1 Backup:** Nightly automated backup via GitHub Actions to Cloudflare

### Compliance
- **Data Protection:** D1 backups encrypted by Cloudflare
- **Audit Trail:** All MCU transactions logged with user/org context
- **Branch Protection:** `main` requires code review, no force push allowed

---

## Migration Status (2026-04-14)

### Completed
- **Better Auth Framework:** v1.6.2 installed with D1 Kysely adapter
- **Dashboard Server Components:** Migrated from custom JWT to Better Auth (`getCurrentUser()` from Better Auth client)
- **Server Actions:** All mutations use Better Auth session context
- **Auth Endpoints:** `/api/auth/[...all]` handling email/password + magic link
- **Database:** Migration SQL applied (0003-better-auth.sql) — Better Auth schema configured
- **Client Library:** `src/lib/auth-client.ts` with magicLinkClient plugin
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
