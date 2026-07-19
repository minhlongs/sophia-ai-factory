---
title: "Project Handoff — Sophia AI Factory"
audience: "Engineering team, operators, founders"
generated: 2026-06-20
current_sha: 94f5796b
production_url: https://sophia.agencyos.network
deploy_doctrine: cf-direct
status: in-progress
---

# 📋 Sophia AI Factory — Project Handoff Document

> **Last Updated:** 2026-06-20 | **Local SHA:** `94f5796b` | **Production:** https://sophia.agencyos.network

---

## 🇻🇳 Tiếng Việt — Tóm tắt

Sophia AI Factory đang trong giai đoạn **ổn định sản xuất** với tất cả 14 phases chính đã hoàn thành (2026-04-30). Go-live thành công vào 2026-05-03 với tất cả 3 gaps đã đóng.

**Hiện tại đang làm:**
- **Phase 06.1 UI:** Stitch MCP integration + Campaign Dashboard (đang active development, có TypeScript errors cần fix)
- **Phase 10-12 Optimization:** Refinement cho các phases đã complete (multi-channel publisher, tenant isolation, OpenClaw)

**Vấn đề nổi bật:**
- Missing i18n keys trong Stitch components
- Stitch MCP authentication chưa stable
- Một số TypeScript build errors cần resolve

---

## 🇬🇧 English — Executive Summary

Sophia AI Factory is in **production stabilization** phase with all 14 core phases completed (2026-04-30). Go-live successful on 2026-05-03 with all 3 gaps closed.

**Current Work:**
- **Phase 06.1 UI:** Stitch MCP integration + Campaign Dashboard (active development, TypeScript errors present)
- **Phase 10-12 Optimization:** Post-completion refinement for already-shipped features

**Notable Issues:**
- Missing i18n keys in Stitch components
- Stitch MCP authentication instability
- TypeScript build failures need resolution

---

## 1. Deployment Status

### Production Environment

| Item | Status | Details |
|------|--------|---------|
| **URL** | ✅ LIVE | https://sophia.agencyos.network |
| **Deploy Method** | ✅ CF-direct | `npm run deploy:full` (wrangler CLI) |
| **GitHub Actions** | ⚠️ DISABLED | Disabled by design since 2026-05-03 |
| **Last Verified Green** | ✅ 2026-05-17 | SHA `4bca4710`, 4431/4431 tests |
| **Current Local SHA** | 🔄 94f5796b | Not yet deployed to production |
| **Build Status** | ⚠️ FAILING | TypeScript errors in Stitch components |
| **Test Coverage** | ✅ 100% | 4431 tests pass (31 skipped) |

### D1 Database

| Item | Value |
|------|-------|
| **Migrations Applied** | 120 SQL files (highest: 0117) |
| **Migration Command** | `npx wrangler d1 migrations apply sophia-raas-db --remote` |
| **Schema Status** | ✅ All phases schema applied |

### Secrets Configuration

All required secrets documented in `docs/deployment-guide.md`. Key secrets for production:

```bash
# Core AI Services
OPENROUTER_API_KEY
ELEVENLABS_API_KEY
HEYGEN_API_KEY
HEYGEN_WEBHOOK_SECRET

# Payment Providers
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
# PayOS configured via Setup Wizard (Vietnam domestic)

# Communications
TELEGRAM_BOT_TOKEN
RESEND_API_KEY

# Security & Auth
CRON_SECRET
BETTER_AUTH_SECRET

# BYOK Encryption
CREDENTIALS_MASTER_KEY   # 64 hex chars (AES-GCM-256)
BYOK_MASTER_KEY          # base64 32 bytes (LLM/media BYOK)

# Optional Features
LLM_CACHE_ENABLED        # "1" to enable exact-match cache
LANGFUSE_PUBLIC_KEY      # LLM observability (optional)
LANGFUSE_SECRET_KEY      # LLM observability (optional)
```

### Active Cron Jobs

| Schedule | Route | Purpose |
|----------|-------|---------|
| `*/5 * * * *` | `/api/cron/uptime-check` | Self-monitoring + Telegram alert |
| `5 * * * *` | `/api/cron/usage-export` | Hourly usage rollup |
| `0 1 * * *` | `/api/cron/dunning` | Dunning state machine (Phase 6) |
| `0 7 * * *` | `/api/cron/llm-cache-purge` | Expire LLM cache rows |
| `0 */4 * * *` | `/api/cron/affiliate-scout` | Affiliate network discovery |
| `0 0 1 * *` | `/api/cron/d1-backup` | Daily D1 → R2 backup (external trigger) |
| `0 * * * *` | `/api/cron/overage-billing` | Hourly overage reconciliation |

---

## 2. Phase 06.1 UI Status

### Overview

Phase 06.1 focuses on **UI modernization and Stitch MCP integration** to improve the customer-facing interface and design system consistency.

### Current Status

| Task | Status | Details |
|------|--------|---------|
| **Stitch MCP Integration** | 🔄 IN PROGRESS | Task #71: Fix authentication and resume workflow |
| **Campaign Dashboard UI** | 🔄 IN PROGRESS | Task #75: Implement new dashboard components |
| **i18n Keys for Stitch** | ⏳ PENDING | Task #72: Add missing translation keys |
| **Design Overrides** | ⏳ PENDING | Task #73: Create page-specific overrides |
| **Build & Test Stitch** | ⏳ PENDING | Task #74: Integration testing |
| **i18n in Stitch Components** | ⏳ PENDING | Task #76: Component-level internationalization |
| **TypeScript Build Errors** | ⏳ PENDING | Task #77: Create missing modules |

### Known Issues (Phase 06.1)

1. **Missing i18n Keys**
   - Stitch auth screens reference keys that don't exist in translation files
   - Affected files:
     - `src/components/stitch/screens/auth/register-page.tsx`
     - Multiple i18n keys missing: `stitch.auth.register.successMessage`, `stitch.auth.register.goToLogin`, etc.
   - **Fix:** Run `npm run i18n:autofill` to auto-generate missing keys

2. **Stitch MCP Authentication**
   - Authentication flow not fully stable
   - Need to verify MCP server connectivity and token handling

3. **TypeScript Build Failures**
   ```bash
   # Current errors in Stitch components
   at src/components/stitch/screens/auth/register-page.tsx:44
   "stitch.auth.register.successMessage" missing
   ```

### Next Steps (Phase 06.1)

1. ✅ Fix missing i18n keys via autofill
2. ✅ Resolve Stitch MCP authentication issues
3. ✅ Build and test Stitch integration
4. ✅ Complete Campaign Dashboard UI implementation
5. ✅ Ensure all TypeScript errors resolved before merge

---

## 3. Phase 10-12 Optimization Status

### Original Completion

Phases 10-12 were **completed on 2026-04-30** as part of the feature-complete milestone:

| Phase | Status | Completion |
|-------|--------|------------|
| **Phase 10: Multi-Channel Publisher** | ✅ DONE | TikTok Shop, YouTube Shorts, Instagram Reels publishers |
| **Phase 11: Tenant Isolation** | ✅ DONE | D1 RLS, tier quotas, cost ledger |
| **Phase 12: OpenClaw Orchestrator** | ✅ DONE | 10 primitives wired, Claude SDK + Qwen router |

### Optimization Focus (Current)

Since core features are shipped, Phase 10-12 optimization refers to **post-launch refinement**:

#### Phase 10: Multi-Channel Publisher Optimization

- **Rate limiting per platform:** Ensure TikTok/YouTube/Instagram API quotas respected
- **FTC disclosure validator:** Pre-publish compliance check (deferred to launch hardening, may need review)
- **Caption + hashtag generator:** Qwen integration tuning
- **Error handling:** Platform-specific error taxonomy

#### Phase 11: Tenant Isolation Hardening

- **Quota enforcement accuracy:** Verify per-tenant usage tracking
- **Cost ledger reconciliation:** Ensure tenant cost rollup matches actual spend
- **Storage tracker cron:** R2 usage per tenant

#### Phase 12: OpenClaw Orchestrator Polish

- **Circuit breaker:** Already implemented, verify effectiveness
- **Retry semantics:** Bounded exponential backoff validation
- **Prompt contracts:** Zod validation for typed prompts
- **Checkpoint/resume:** D1-native state persistence

### Open Items for Optimization

From the master plan (`plans/260429-2053-sophia-consolidation/plan.md`), deferred items include:

1. **E2E Playwright suite** — 12 scenarios (currently unit tests only, 4431 passing)
2. **Load testing** — k6 smoke/steady/spike/soak/stress profiles
3. **Stripe Connect KYC** — Alternative payout method (currently NOWPayments USDT only)
4. **Customer status page** — Public `/status` with 90d uptime metrics
5. **Fly.io deployment** — Coqui/MoviePy sidecar services (currently external providers)

---

## 4. Known Issues & Caveats

### Critical Path Blockers

| Issue | Severity | Impact | Fix Status |
|-------|----------|--------|------------|
| Stitch MCP auth instability | HIGH | Blocks Phase 06.1 UI work | In progress (Task #71) |
| Missing i18n keys in Stitch | HIGH | Build failures | Pending autofill |
| TypeScript build errors | HIGH | Prevents deploy | Pending (Task #77) |

### Production Caveats (From Handover V2)

1. **HeyGen render polling** — Videos async; `video:create` returns instantly but asset ready in 3-10 min via `cron/video-status-sync`. Setup Wizard should highlight this to customers.
2. **ElevenLabs sample upload** — `voice:clone` requires customer-hosted HTTPS audio sample URLs. UI helper needed for upload.
3. **D-ID Basic Auth format** — D-ID keys pre-base64-encoded by dashboard; raw keys cause `did_401` errors. Setup Wizard should validate format.
4. **Single-slot YouTube** — Data model holds 1 active `refresh_token`; multi-account requires schema change. Current copy says "6+ social platforms" (accurate for publishers, not multi-account YT).

### Performance Snapshot

| Metric | Measured | Verdict |
|--------|----------|---------|
| TTFB median | 253ms | "Edge response" (honest copy) |
| Mission dispatch latency | 2s stubs / 5-30s LLM | "< 60s" accurate |
| Video render (HeyGen) | 3-10 min vendor | Polling every 5min |
| Crypto at rest | AES-GCM-256 | "256-bit Encrypted" accurate |
| Build time | < 10s | ✅ |
| Test pass rate | 4431/4431 (100%) | ✅ |

---

## 5. Architecture Summary

### Layer Status (a16z Solo Company 4-Layer)

| Layer | Status | Completion | Notes |
|-------|--------|-----------|-------|
| **Layer 1: Seed** | ✅ COMPLETE | 2026-04-14 | RaaS core: missions, D1, Better Auth, tier metering |
| **Layer 2: Tree** | ✅ COMPLETE | 2026-04-17 | Cloudflare Workers, D1, R2, observability, CF-direct deploy |
| **Layer 3: Forest** | ✅ COMPLETE | 2026-04-30 | Video pipeline, affiliate networks, publishers, tenancy, OpenClaw |
| **Layer 4: Land** | ✅ COMPLETE | 2026-05-03 | Self-serve checkout, magic-link E2E, mission control handover |

### Canonical Import Paths (Post-Consolidation)

```typescript
// Auth
import { getCurrentUser } from '@/seed/auth/better-auth-session'

// Database
import { createServerClient } from '@/seed/db/client'  // sync, NOT async

// Tier lookup
import { getUserTier } from '@/seed/db/get-user-tier'

// Tier config
import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'

// BANNED imports (violate layer architecture)
// ❌ @/lib/auth, @/lib/subscription, @/lib/unified-tier-config, @/lib/tier-gate
```

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js 16 App Router (App Directory)              │  │
│  │  - SSR Pages (dashboard, pricing, login)           │  │
│  │  - Server Components (default)                     │  │
│  │  - API Routes (/api/**)                            │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Bindings                                │
│  ┌────────────┬────────────┬────────────┬──────────────┐  │
│  │ D1 (sophia-│ R2 Buckets │ KV Store   │ Inngest      │  │
│  │ raas-db)   │            │            │ (queue)      │  │
│  └────────────┴────────────┴────────────┴──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     External Services                       │
│  ┌────────────┬────────────┬────────────┬──────────────┐  │
│  │ NOWPayments│ HeyGen API │ OpenRouter │ ElevenLabs   │  │
│  │ (USDT)     │ (Video)    │ (LLM)      │ (TTS)        │  │
│  └────────────┴────────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Next Steps & Recommendations

### Immediate (Before Next Deploy)

1. **Fix TypeScript Build Errors**
   - Run `npm run i18n:autofill` to generate missing Stitch translation keys
   - Review `apps/sophia-ai-factory/src/components/stitch/screens/auth/register-page.tsx` for other issues
   - Ensure `npm run type-check` passes with 0 errors

2. **Complete Phase 06.1 Tasks**
   - Task #71: Resolve Stitch MCP authentication
   - Task #75: Finish Campaign Dashboard UI
   - Tasks #72-74, #76-77: i18n, design overrides, integration testing

3. **Verify Production Parity**
   - Deploy current SHA `94f5796b` after fixes
   - Post-deploy verification:
     ```bash
     LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
     LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
     echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"  # Must match
     curl -sI https://sophia.agencyos.network | head -1  # HTTP/2 200
     ```

### Short-term (1-2 weeks)

1. **Phase 10-12 Optimization Validation**
   - Run integration tests for multi-channel publisher rate limiting
   - Verify tenant quota enforcement with load test
   - Validate OpenClaw circuit breaker behavior

2. **E2E Smoke Test Suite**
   - Budget ~$30-100 for BYOK API calls (OpenRouter, ElevenLabs, D-ID, NOWPayments test)
   - Run full customer journey: signup → setup wizard → campaign → video → publish
   - Document findings in `plans/reports/smoke-YYYYMMDD-test-run.md`

3. **Observability Enhancement**
   - Tasks #28-39: Deploy OTEL to staging, configure APM dashboard, define SLOs
   - Current: basic logging + Sentry source maps
   - Target: OpenTelemetry traces, latency metrics, error budgets

### Medium-term (1-3 months)

1. **Security Hardening**
   - Tasks #41-65: SOC 2 Type I audit preparation
   - Implement audit logger with hash chain (Task #44)
   - Quarterly access review automation (Task #49)

2. **Key Rotation Infrastructure**
   - BYOK key versioning (Task #59)
   - Inngest re-encrypt background job (Task #60)
   - Key rotation runbook + operator training (Tasks #61-64)

3. **Scalability Improvements**
   - Multi-region D1 replication (DR)
   - Fly.io deployment for Coqui/MoviePy sidecars
   - Edge KV for session cache optimization

### Long-term (Q3-Q4 2026)

1. **Feature Expansion**
   - White-label branding (MASTER tier)
   - Team collaboration (multi-user orgs)
   - Custom integrations marketplace
   - Advanced reporting (CSV/PDF export)

2. **Growth Targets**
   - ARR: $1M (current ~$5K)
   - Expand to APAC with Vietnamese-first UX
   - Affiliate network expansion (Impact, CJ, ShareASale)

---

## 7. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Stitch MCP integration incomplete** | HIGH | HIGH | Task #71 in progress; allocate dedicated time |
| **TypeScript errors block deploy** | HIGH | MEDIUM | Auto-fill i18n keys; fix missing modules |
| **BYOK cost overruns in smoke test** | MEDIUM | LOW | Set hard cap $100; stop on budget |
| **SOC 2 audit delays** | MEDIUM | HIGH | Start auditor engagement early (Task #54) |
| **Tenant quota bypass via API** | LOW | HIGH | Regular security audits; RLS enforcement |
| **HeyGen vendor lock-in** | MEDIUM | MEDIUM | Document Remotion/MoviePy fallback path |
| **NOWPayments outage** | LOW | HIGH | PayOS backup configured via Setup Wizard |

---

## 8. Documentation References

### Canonical Sources

1. `README.md` — Product, stack, deploy doctrine
2. `docs/deployment-guide.md` — CF-direct deploy, secrets, verification
3. `docs/codebase-summary.md` — Repo map, ownership boundaries
4. `docs/system-architecture.md` — Request/data flow, topology
5. `docs/development-roadmap.md` — Phase timeline, metrics
6. `AGENTS.md` — Agent roles, mandatory work rules
7. `CLAUDE.md` — Sophia-specific standards, protected flows

### Recent Reports

- `plans/reports/handover-260516-raas-zero-bug.md` — Zero-bug audit results
- `plans/reports/UI-UX-REPORT.md` — UI/UX analysis (if exists)
- `docs/codebase_edge_cases_report.md` — Edge cases and gotchas
- `go-live-workflow.md` — Full go-live checklist and verification

### Active Plans

- `plans/260429-2053-sophia-consolidation/plan.md` — Master 14-phase plan
- `plans/260429-2053-sophia-consolidation/phase-10-multi-channel-publisher.md`
- `plans/260429-2053-sophia-consolidation/phase-11-tenant-isolation-quotas.md`
- `plans/260429-2053-sophia-consolidation/phase-12-openclaw-orchestrator.md`

---

## 9. Quick Reference

### Deploy Commands

```bash
cd apps/sophia-ai-factory

# Type check
npm run type-check

# Run tests
npm test

# Build
npm run build

# Deploy to production (CF-direct)
npm run deploy:full

# Post-deploy verification
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"

# Rollback if needed
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes
```

### Database Operations

```bash
# Apply all migrations
npx wrangler d1 migrations apply sophia-raas-db --remote

# Check migration state
npx wrangler d1 execute sophia-raas-db --command="SELECT migration_name FROM d1_migrations ORDER BY id DESC LIMIT 5" --remote

# Execute ad-hoc query
npx wrangler d1 execute sophia-raas-db --command="SELECT COUNT(*) FROM users;" --remote
```

### Secrets Management

```bash
# List all secrets
npx wrangler secret list

# Set new secret
npx wrangler secret put SECRET_NAME --value "secret_value"
```

---

## 10. Contact & Ownership

| Role | Responsibility | Notes |
|------|----------------|-------|
| **CTO** | Architecture, deployment, security | CF-direct doctrine, layer boundaries |
| **COO** | Operations, fulfillment, customer handover | Setup Wizard, Telegram bot, NOWPayments IPN |
| **CMO** | Bilingual copy, SEO, conversion | All customer-facing content VN + EN |
| **CSO** | Sales motion, lead qualification | Apollo/Hunter BYOK integration |
| **Founder** | Product decisions, BYOK model | Final authority on scope changes |

**Support Email:** `support@mekongmind.com`

---

## Appendix A: Phase 06.1 Detailed Task Breakdown

| Task ID | Description | Status | Owner |
|---------|-------------|--------|-------|
| #71 | Fix Stitch MCP authentication and resume Phase 6.1 workflow | 🔄 in_progress | Engineering |
| #72 | Add i18n keys for Stitch screens | ⏳ pending | Frontend |
| #73 | Create page-specific design overrides | ⏳ pending | Design |
| #74 | Build and test Stitch integration | ⏳ pending | QA |
| #75 | Implement Campaign Dashboard UI | 🔄 in_progress | Frontend |
| #76 | Implement i18n in Stitch screen components | ⏳ pending | i18n |
| #77 | Fix TypeScript build errors - create missing modules | ⏳ pending | Engineering |

**Blocking:** Tasks #72 (i18n keys) blocks #71, #74, #76 completion.

---

## Appendix B: Go-Live Verification Checklist

From `docs/deployment-checklist.md` (summarized):

- [ ] SHA match between local and production (`/api/version`)
- [ ] HTTP 200 on production URL
- [ ] All 9 smoke tests passing
- [ ] TypeScript errors: 0
- [ ] Test suite: 100% pass (no skipped critical tests)
- [ ] D1 migrations: latest applied
- [ ] Cron jobs: firing (check `cron_run_log`)
- [ ] Secrets: all required set in wrangler
- [ ] R2 buckets: accessible with correct bindings
- [ ] Webhook endpoints: NOWPayments IPN verified, Telegram webhook set

---

**Document Status:** Living document — update after each milestone or major issue resolution.

**Next Review:** 2026-06-27 (weekly cadence) or upon Phase 06.1 completion.
