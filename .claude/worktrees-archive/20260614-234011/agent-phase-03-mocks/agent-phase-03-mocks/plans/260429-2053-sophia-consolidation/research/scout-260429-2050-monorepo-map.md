# Sophia AI Monorepo Consolidation Map

**Date:** 2026-04-29 | **Thoroughness:** Medium | **Scope:** Video-gen affiliate SaaS gaps

---

## 1. MONOREPO STRUCTURE TREE

```
/Users/macbook/projects/sophia-ai-factory/
├── package.json (monorepo root, Next.js 16 + D1 stack)
├── wrangler.jsonc (Cloudflare Workers: D1, R2, KV, AI binding)
├── CLAUDE.md (canon stack: D1, Better Auth, NOWPayments)
├── TECH_DEBT_TRACKING.md (TS cleanup Phase 1-2 done)
│
├── apps/
│   ├── sophia-ai-factory/ (Next.js 16, ACTIVE, ~844 tests)
│   │   ├── package.json (better-auth, stripe, inngest, upstash-redis)
│   │   ├── src/app/api/ (42 route dirs: admin, auth, billing, heygen, cron)
│   │   ├── src/lib/
│   │   │   ├── ai/ (anthropic-adapter.ts, llm-router.ts)
│   │   │   ├── heygen/ (heygen-client.ts, integration tests)
│   │   │   ├── video/ (video-storage-service.ts → R2 upload)
│   │   │   ├── affiliates/ (commission-calculator.ts, clickbank-verifier.ts)
│   │   │   ├── discovery/ (affiliate-scoring.ts, ai-scorer.ts)
│   │   │   ├── db/ (D1 + Kysely sync client, get-user-tier.ts)
│   │   │   ├── billing/ (dunning FSM, email templates, NOWPayments IPN)
│   │   │   ├── auth/ (better-auth-session wrapper)
│   │   │   ├── raas/ (audit-logging, permissions, invoice-gen)
│   │   │   ├── usage-metering/ (event collector, rollup engine)
│   │   │   ├── telegram/ (bot handlers, webhook integration)
│   │   │   └── [50+ other service libs]
│   │   └── supabase/migrations/ (legacy auth, OAuth callbacks only)
│   │
│   ├── sophia-proposal/ (Next.js 15.5.14, DEPRECATED)
│   │   ├── package.json (@anthropic-ai/sdk, @react-pdf/renderer)
│   │   ├── migrations/ (0006-schema-alignment.sql → 0010-health-checks.sql)
│   │   └── [Merged into sophia-ai-factory /dashboard/proposals]
│   │
│   ├── sophia-backend/ (Python FastAPI, LEGACY REFERENCE)
│   │   ├── MIGRATION_NOTE.md (stack mismatch: OpenAI + Supabase pgvector)
│   │   ├── main.py (FastAPI entrypoint)
│   │   ├── ai_client.py (OpenAI embeddings + GPT-4)
│   │   ├── brand_voice.py (RAG over pgvector corpus)
│   │   ├── proposal_generator.py (core proposal logic)
│   │   └── [Decision pending: port to TS or deprecate]
│   │
│   ├── sophia-video-bot/ (STUB, no package.json)
│   │   └── [Empty placeholder for video bot integration]
│   │
│   └── 84tea/ (Next.js 16, Material Design 3, Pure UI)
│       ├── package.json (NO external integrations: pure UI)
│       └── [Vietnamese tea franchise brand guidelines + MD3]
│
└── docs/
    ├── migrations/
    │   └── usage-events-schema.sql (D1 schema)
    └── [Roadmap, changelog, code-standards]
```

---

## 2. PER-APP STACK & STATUS

### sophia-ai-factory (CANONICAL)
- **Framework:** Next.js 16 + React 19 + TypeScript 5.7
- **Deployment:** Cloudflare Workers (OpenNext build → wrangler deploy)
- **Database:** Cloudflare D1 (PostgreSQL compat) + Kysely ORM
- **Auth:** Better Auth 1.6.2 (session wrapper in `@/lib/better-auth-session`)
- **Payment:** NOWPayments (USDT crypto IPN webhook) + Stripe (for legacy)
- **Key Deps:** better-auth, stripe, inngest, upstash-redis, @posthog/next, telegraf
- **Completion:** ~90% (core + billing + auth + telegram bot wired)
- **Tests:** 844+ passing (vitest)
- **Known TODOs:**
  - `[ ] Remotion (video client-side rendering) — blocked, edge incompatible`
  - `[ ] Polar.sh — REJECTED by business logic (CLAUDE.md line 9)`
  - `[ ] Anthropic API — only in proposal generator (sopaia-backend, not wired here)`
  - `[ ] Python FastAPI backend — unintegrated (stack mismatch warning)`

### sophia-proposal (DEPRECATED)
- **Stack:** Next.js 15.5.14 + React 18 + @anthropic-ai/sdk 0.80
- **Purpose:** Proposal generation with PDF export (@react-pdf)
- **Completion:** 100% (but DEPRECATED)
- **Status:** Features merged into sophia-ai-factory `/dashboard/proposals`
- **Migration:** Database migrations exist but schema is legacy
- **Impact:** Do NOT develop here; use sophia-ai-factory instead

### sophia-backend (LEGACY, UNINTEGRATED)
- **Stack:** Python FastAPI (3.9+) + OpenAI + Supabase pgvector
- **Purpose:** Brand voice RAG + proposal generation (pre-TypeScript era)
- **Completion:** ~70% (functional but isolated)
- **Stack Mismatch:**
  - Uses OpenAI (canon uses Anthropic via proposal-gen)
  - Uses Supabase (canon uses D1)
  - Uses pgvector (canon uses D1 vector ops via Workers AI)
- **Decision Required:** Port to TypeScript Edge Function vs. Keep as separate service
- **Files Worth Cherry-Picking:**
  - `proposal_generator.py` (section generation logic)
  - `brand_voice.py` (RAG pattern for voice/style consistency)

### sophia-video-bot (STUB)
- **Stack:** Placeholder only
- **Status:** 0% — no package.json or source
- **Purpose:** Intended video bot integration (Telegram/Discord?)
- **Recommendation:** Extend sophia-ai-factory with new video routes instead of creating separate app

### 84tea (STANDALONE BRAND UI)
- **Stack:** Next.js 16 + Tailwind + Material Design 3
- **Purpose:** Vietnamese tea franchise brand guidelines (non-technical)
- **Completion:** 0% (spec doc only, no implementation)
- **Status:** Not part of Sophia product; separate branding project

---

## 3. MAIN APP API ROUTES (sophia-ai-factory)

### Admin Routes (/api/admin)
- `/api/admin/api-keys` (GET, POST, DELETE)
- `/api/admin/audit/receipt` (verification + downloads)
- `/api/admin/licenses` (CRUD, extend, reactivate, regenerate)
- `/api/admin/dunning` (suspension, restoration, state machine)
- `/api/admin/payouts` (queue, mark-paid)
- `/api/admin/quota` (adjust, mark-billable, overage summary)

### Billing Routes (/api/billing)
- `/api/billing/summary` (overage events aggregator)
- NOWPayments IPN webhook (likely under /webhooks or /billing/ipn)

### Auth Routes (/api/auth)
- OAuth callbacks: tiktok, youtube, google (Supabase exceptions)
- Better Auth session endpoints (via better-auth middleware)

### Video Routes (PARTIAL, NOT YET COMPLETE)
- `/api/heygen/...` (HeyGen video generation trigger)
- No dedicated `/api/video/...` routes yet (gap for video-gen SaaS)

### Usage Routes (/api/usage)
- `/api/v1/usage` (POST — track heygen, elevenlabs, openrouter consumption)
- `/api/usage/mock` (development mock service)
- `/api/usage/export` (usage history download)
- `/api/usage/debug` (admin usage inspection)

### Affiliate Routes (/api/r/)
- `/api/r/[code]` (shortlink redirect → attribution)
- Discovery: `/api/discovery/score`, `/api/discovery/search`, `/api/discovery/top-50`

### Health & Setup
- `/api/health` (service status, key validation)
- `/api/setup/verify` (heygen, d-id, openrouter, elevenlabs key validation)

---

## 4. INTEGRATION STATUS: WIRED vs. STUBBED

### WIRED (Live, Production-Ready)
| Integration | Status | Files | Notes |
|---|---|---|---|
| **Better Auth** | ✅ WIRED | `lib/better-auth-session` | Session wrapper, single source of truth |
| **Cloudflare D1** | ✅ WIRED | `lib/db/client.ts` + Kysely ORM | Sync, non-async createServerClient() |
| **Cloudflare R2** | ✅ WIRED | `lib/video/r2-binding.ts` | HeyGen video upload fallback |
| **NOWPayments IPN** | ✅ WIRED | `lib/billing/nowpayments-ipn-*` | Tier activation webhook |
| **HeyGen API** | ✅ WIRED | `lib/heygen/heygen-client.ts` | Video generation trigger |
| **Inngest** | ✅ WIRED | `lib/inngest/functions/*` | Background job queue |
| **Telegram Bot** | ✅ WIRED | `lib/telegram/handlers/*` | @Sophia_Bbot webhook |
| **Upstash Redis** | ✅ WIRED | `@upstash/redis` dep | Rate limiting, caching |
| **PostHog** | ✅ WIRED | `@posthog/next` | Feature flags, A/B testing |
| **Stripe** | ✅ WIRED | `stripe` (14.0.0) | Legacy payment (secondary to NOW) |

### STUBBED / PARTIAL (Placeholder, Not Production)
| Integration | Status | Files | Gap |
|---|---|---|---|
| **Anthropic API** | ⚠️ PARTIAL | `lib/ai/anthropic-adapter.ts` | Used in sophia-backend (deprecated), not in main app |
| **Supabase Auth** | ⚠️ LEGACY ONLY | `lib/supabase/` (shims) | OAuth callbacks only (tiktok, youtube); main auth via Better Auth |
| **D-ID** | ❌ STUBBED | `/api/setup/verify` (case statement) | Endpoint accepts key but no actual integration |
| **ElevenLabs** | ❌ STUBBED | `/api/setup/verify` (case statement) | Usage tracking placeholder; no actual TTS |
| **OpenRouter** | ⚠️ PARTIAL | `lib/services/real/` | Mock service ready; real service decision pending |
| **Polar.sh** | ❌ BANNED | CLAUDEE.md line 9 | "Polar.sh REJECTED this product — DO NOT use Polar" |
| **Remotion** | ❌ BLOCKED | CLAUDE.md (render rule) | Client-side rendering incompatible with Cloudflare Workers edge |
| **Supabase pgvector** | ❌ DEPRECATED | `apps/sophia-backend/` | Replaced by D1 vector ops via Workers AI |

---

## 5. GAPS FOR VIDEO-GEN AFFILIATE SAAS

### Critical Gaps

1. **Video Pipeline NOT WIRED** (heygen-client only generates, no webhook polling)
   - ✅ HeyGen API key validation (setup/verify)
   - ✅ Video upload to R2 (video-storage-service.ts)
   - ❌ Poll HeyGen for video readiness (stub: `/api/heygen/check-status` missing)
   - ❌ Template/script management (no endpoint for video templates)
   - ❌ Quality/resolution selection (no enum for video formats)

2. **Affiliate Commission Dashboard** (partial)
   - ✅ Commission calculator (`lib/affiliates/commission-calculator.ts`)
   - ✅ ClickBank signature verifier (postback parser)
   - ✅ Affiliate discovery (AI scorer)
   - ❌ Affiliate payout reporting (no `/api/affiliate/payouts` route)
   - ❌ Earnings history (no affiliate-facing dashboard)
   - ❌ Tier-gated video generation (no feature entitlements check per tier)

3. **Monetization Tiers** (partially defined)
   - ✅ Tier config (`@/config/tiers` single source of truth)
   - ✅ Tier enforcement on API (quota enforcer)
   - ❌ Video generation limits per tier (not in tier config)
   - ❌ Storage quota per tier (R2 object count limit missing)
   - ❌ Affiliate commission split per tier (no tier-aware revenue share)

4. **Webhook + Async Processing**
   - ✅ NOWPayments IPN (tier activation)
   - ✅ ClickBank postback (conversion attribution)
   - ❌ HeyGen video completion webhook (poll-based, not event-driven)
   - ❌ Video encoding failure recovery (no retry logic)
   - ❌ Affiliate performance digest (missing weekly/monthly emails)

5. **Observability for Video**
   - ✅ LLM trace logging (langfuse integration)
   - ✅ Audit logging (comprehensive)
   - ❌ Video generation cost tracking (HeyGen per-minute billing not metered)
   - ❌ Video failure reasons (no structured error logging)
   - ❌ Affiliate attribution replay (ClickBank postback deduplication logic missing)

---

## 6. RECOMMENDED STARTING POINT FOR VIDEO-GEN AFFILIATE SAAS

### Best Option: **EXTEND sophia-ai-factory (don't create new app)**

**Why:**
1. Stack is canonical (D1 + Better Auth + TypeScript)
2. Affiliate infrastructure already 60% in place
3. Inngest queue ready for async video jobs
4. Tier system can be extended for video quotas
5. Tests + CI/CD already passing (844 tests)

**High-Impact Modules to Build:**
1. **Video Job Manager** (`src/lib/video/video-job-pipeline.ts`)
   - Job queue (Inngest function for polling HeyGen)
   - Status tracking (database table: `video_jobs`)
   - Retry logic + exponential backoff

2. **Affiliate Dashboard Routes** (`src/app/api/affiliate/[userId]/`)
   - `/earnings` (monthly commission history)
   - `/payouts` (withdrawal requests)
   - `/campaigns` (video campaign stats)
   - `/conversions` (ClickBank attribution feed)

3. **Tier-Gated Video API** (`src/app/api/videos/generate`)
   - Check user tier from `getUserTier(userId)`
   - Enforce quota: `video_jobs_monthly` per TIER_CONFIG
   - Return R2 URL on completion

4. **Video Templates** (`src/lib/video/templates.ts`)
   - Script/brand voice selection
   - HeyGen avatar + voice mapping
   - Output format enum (1080p/720p, duration variants)

5. **Monitoring** (extend existing telemetry)
   - Video generation latency (CloudWatch via Inngest)
   - Cost attribution per affiliate
   - Failure reason classification

---

## 7. DRIFT TO CHERRY-PICK FROM MEKONG-CLI

### From `/Users/macbook/mekong-cli/apps/sophia-factory/`
| File | Reason | Action |
|---|---|---|
| `backend/ai_client.py` | OpenAI embedding pattern | Reference only (use @anthropic-ai/sdk instead) |
| `backend/brand_voice.py` | RAG pattern (pgvector) | **Port to TypeScript** + adapt for D1 vector support |
| `backend/proposal_generator.py` | Section generation logic | **Reuse prompt templates** from `lib/ai/` |
| `src/pages/api/proposals/*` | Proposal endpoint structure | Reference for `/api/dashboard/proposals/*` equivalents |

### From `/Users/macbook/mekong-cli/apps/sophia-proposal/`
| File | Reason | Action |
|---|---|---|
| `app/page.tsx` | Proposal landing page | Deprecated (merged into sophia-ai-factory) |
| `migrations/*.sql` | Database schema | **DO NOT cherry-pick** (schema is legacy, D1 uses Kysely) |

**Note:** Avoid Supabase-specific code. If RAG needed, implement via Workers AI semantic search (D1 vector binding).

---

## 8. KNOWN INTEGRATIONS SUMMARY

### Communication
- **Telegram:** ✅ Wired (@Sophia_Bbot commands: /campaign, /status, /results)
- **Email:** ✅ Resend + Supabase (legacy only for OAuth)

### AI/LLM
- **Anthropic (Claude):** ⚠️ In sophia-backend only (should migrate here)
- **OpenRouter:** ⚠️ Mock ready, real service pending decision
- **OpenAI:** ❌ Removed from main app (legacy in sophia-backend)
- **ElevenLabs:** ❌ Stubbed (setup key validation only)

### Video/Avatar
- **HeyGen:** ✅ Wired (client + R2 upload, missing polling)
- **D-ID:** ❌ Stubbed (key validation only, no actual generation)

### Payments
- **NOWPayments:** ✅ Wired (IPN webhook → tier activation)
- **Stripe:** ✅ Wired (secondary to NOWPayments)
- **Polar.sh:** ❌ BANNED (CLAUDE.md explicit rejection)

### Database/Storage
- **Cloudflare D1:** ✅ Wired (canonical, Kysely ORM)
- **R2:** ✅ Wired (video storage with HeyGen fallback)
- **KV:** ✅ Wired (feature flag cache, experiment A/B)
- **Supabase:** ⚠️ Legacy only (OAuth callbacks for tiktok, youtube)
- **Upstash Redis:** ✅ Wired (rate limiting, caching)

### Analytics/Observability
- **PostHog:** ✅ Wired (feature flags)
- **Sentry:** ✅ Wired (error tracking)
- **Langfuse:** ✅ Wired (LLM tracing)
- **Inngest:** ✅ Wired (background jobs)

### Affiliate/Conversion
- **ClickBank:** ✅ Signature verifier (postback parser)
- **Affiliate Discovery:** ✅ AI scorer + OpenRouter niche enhancer

---

## 9. ACTIONABLE NEXT STEPS

1. **Phase 1: Video Pipeline (Week 1)**
   - Create `src/lib/video/video-job-pipeline.ts` (Inngest function)
   - Add `/api/videos/generate` endpoint (tier-gated)
   - Add `/api/videos/status/[jobId]` endpoint (polling)

2. **Phase 2: Affiliate Dashboard (Week 2)**
   - Extend `/api/affiliate/*` routes
   - Add earnings history query
   - Integrate ClickBank postback feed

3. **Phase 3: Quotas & Tiers (Week 3)**
   - Update TIER_CONFIG with `videoGenerationsPerMonth`
   - Extend quota enforcer for video
   - Add tier-aware commission splits

4. **Phase 4: Monitoring (Week 4)**
   - Add video cost metering (HeyGen per-minute)
   - Failure reason classification
   - Affiliate performance digest (cron email)

---

## FILES REFERENCED

- Root configs: `/Users/macbook/projects/sophia-ai-factory/{package.json,wrangler.jsonc,CLAUDE.md}`
- Main app: `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`
- Deprecated apps: `/Users/macbook/projects/sophia-ai-factory/apps/{sophia-proposal,sophia-backend}/`
- Mekong forks: `/Users/macbook/mekong-cli/apps/{sophia-factory,sophia-proposal}/`

**Report Generated:** 2026-04-29 20:50 UTC | **Token Budget:** Medium-thoroughness search
