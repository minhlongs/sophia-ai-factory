# Project Overview & PDR — Sophia AI Factory

> **Product Development Requirements** document for Sophia AI Factory: A reasoning-as-a-service (RaaS) platform enabling autonomous solopreneurs to create, distribute, and monetize AI-generated content at scale.

**Document Version:** Phase 14 Final (2026-04-30)
**Production URL:** https://sophia.agencyos.network
**Git SHA:** df22a4f7 | **Tests:** 1798/1798 passing (100%)
**Target Metrics:** $1M ARR, 100/100 a16z solo company score, 50+ customers across 5 continents

---

## Executive Summary

Sophia AI Factory is a no-code platform for solopreneurs to:
1. **Generate** AI-powered business proposals (Claude 3.5 Sonnet)
2. **Create** professional videos automatically (Inngest 6-step pipeline)
3. **Discover & Track** affiliate partnerships (5 networks)
4. **Publish** content across social media (TikTok, YouTube, Instagram)
5. **Earn** commissions from affiliate referrals (NOWPayments USDT)
6. **Automate** via Telegram bot + OpenClaw agent orchestrator

**Phase 11-14 Complete (2026-04-30):**
- Tenant isolation via D1 Kysely plugin
- Video pipeline (Inngest 6-step: script → TTS → visual → compose → upload → publish)
- Affiliate networks (TikTok Shop, Awin, ClickBank, AccessTrade, Amazon)
- OpenClaw orchestrator (Claude SDK + Qwen 3 32B)
- Revenue split (commission ledger + 14-day clawback + NOWPayments USDT)
- FTC compliance (#ad overlay, GDPR export/delete)

---

## Functional Requirements

### 1. Proposal Generation
- **Input:** Business description (text, URL, PDF)
- **Output:** Professional 10-50 page proposal (PDF + HTML)
- **MCU Cost:** 10-50 depending on complexity
- **Features:**
  - Multi-section templates (executive summary, methodology, pricing, timeline)
  - Real-time editing + version history
  - Client feedback loop (comments, revisions)
  - Export to PDF, HTML, Markdown

### 2. Video Generation (Phases 6-8 Complete)
- **Input:** Script, slides, template, avatar style
- **Output:** MP4 video (1080p, 15-300s duration)
- **MCU Cost:** 100-500 depending on length + quality
- **Features:**
  - Inngest 6-step pipeline (script → TTS → visual → compose → upload → publish)
  - Multiple TTS voices (Coqui XTTS v2 on Fly.io)
  - 2 visual paths: template (MoviePy) + cinematic (HunyuanVideo on Runpod)
  - Automatic #ad overlay (FFmpeg drawtext, last 3s)
  - Automatic upload to R2 + dashboard gallery
  - Onboarding video (ENTERPRISE/MASTER tier auto-triggers post-purchase)

### 3. Affiliate Network Integration (Phase 9 Complete)
- **Networks:** TikTok Shop, Awin, ClickBank, AccessTrade, Amazon
- **Features:**
  - HMAC-verified webhook ingestion
  - Click tracking (IP hash, attribution window, 14-day clawback)
  - Commission calculation per network
  - Real-time dashboard (earnings, top products, conversion rates)
  - Affiliate profile management

### 4. Content Publishing (Phase 10 Complete)
- **Platforms:** TikTok Shop, YouTube, Instagram
- **Features:**
  - Token encryption (AES-GCM)
  - Multi-channel scheduling
  - Automatic #ad caption prefix (FTC compliance)
  - Rate limiting per channel
  - Analytics integration (views, likes, shares)

### 5. Revenue Operations (Phase 13 Complete)
- **Commission Ledger:** Track all affiliate clicks + clawback
- **Payout Batches:** Daily aggregation, NOWPayments USDT mass-payout
- **Reconciliation:** Cron job validates incoming payments vs. ledger
- **Currency:** USDT (TRC20 preferred, ERC20 fallback)
- **Settlement:** Weekly (configurable)

### 6. Compliance & Data Protection (Phase 14 Complete)
- **FTC Compliance:** #ad overlay on all videos (last 3 seconds)
- **GDPR:** `/api/account/export` + `/api/account/delete` endpoints
- **Data Export:** User can download entire org data (JSON format)
- **Account Deletion:** Anonymize + soft-delete user + all associated data
- **Runbook:** 10+ incident recovery procedures documented

### 7. Automation via Telegram Bot
- **Commands:** `/campaign`, `/status`, `/results`, `/earnings`
- **FSM:** Multi-step workflows (e.g., campaign creation)
- **Rate Limiting:** SQL-based per-user limits
- **Notifications:** Real-time campaign status + earnings updates

### 8. OpenClaw Agent Orchestrator (Phase 12 Complete)
- **10 Primitives:** spawnAgentFleet, withTenant, onEvent, activateSkill, scheduleAgent, memory, mcp, enqueue, audit, rateLimitGate
- **LLM Router:** Claude SDK + Qwen 3 32B (localhost:11434 or Bailian API)
- **Circuit Breaker:** Graceful degradation on external API failures
- **Skill Activation:** Dynamic loading of agent capabilities
- **Example Agents:**
  - Affiliate Scout: discovers new partnership opportunities
  - Content Producer: generates campaign ideas from affiliate data
  - Auto Publisher: schedules posts across channels

---

## Non-Functional Requirements

### Performance
- **Build Time:** < 10 seconds
- **Page Load:** < 2.5s LCP (Lighthouse 80+)
- **API Latency:** < 500ms p95 (excluding external API calls)
- **Database:** D1 SQLite, org-scoped queries with indexes
- **Cache:** Cloudflare R2 (video assets) + KV (edge quota checks)

### Scalability
- **MCU Metering:** Real-time balance tracking, 1 million+ events/day
- **Concurrent Users:** 1000+ concurrent (Cloudflare Workers auto-scaling)
- **Video Pipeline:** 50+ simultaneous Inngest jobs
- **Affiliate Webhooks:** 10,000+ events/day (10 second processing latency)

### Reliability
- **Uptime:** 99.95% (monitored via 5-minute health checks)
- **Error Rate:** < 0.1% (Better Stack + Sentry monitoring)
- **Data Backup:** Nightly automated D1 export to R2
- **Rollback:** 1-hour canary (Wrangler deployment with auto-rollback on error spike)

### Security
- **Auth:** Better Auth v1.6.2 (D1 Kysely adapter)
- **Session:** HttpOnly, secure, sameSite=lax cookies
- **Encryption:** AES-GCM for per-user API keys (BYOK)
- **API Keys:** PBKDF2 hashing + revocation support
- **Secrets:** CF Worker secrets (no hardcoded values in code)
- **Webhook Verification:** HMAC signature verification
- **Rate Limiting:** Per-IP (demo endpoint) + per-user (Telegram bot)
- **SQL Injection:** Parameterized queries via Kysely (no raw SQL)
- **XSS Prevention:** DOMPurify + React auto-escape
- **HSTS:** max-age=31536000, includeSubDomains
- **CSP:** script-src 'self' + whitelisted CDNs

### Observability
- **Logging:** Structured JSON (Better Stack integration)
- **Error Tracking:** Sentry for frontend + server errors
- **APM:** Inngest tracing, LLM cache stats, webhook latency
- **Alerts:** Telegram notifications for critical events (health check failure, payment webhook error)
- **Dashboards:** Admin monitoring page (D1 aggregates + workflow status)

---

## Architecture Decisions

### Database
- **Provider:** Cloudflare D1 (SQLite)
- **Why:** Zero-cost, globally distributed, no RLS needed (app-layer enforced)
- **Schema:** 20+ tables (users, orgs, missions, videos, affiliate networks, payments, commissions)
- **Tenant Isolation:** D1 Kysely tenant-scope plugin (auto-injects tenant_id on all queries)
- **Migrations:** 8+ versioned SQL files (idempotent, IF NOT EXISTS guards)

### Authentication
- **Provider:** Better Auth v1.6.2 (D1 Kysely adapter)
- **Why:** Zero-dependency, type-safe, multi-tenant support
- **Methods:** Email/password + magic link + organizations plugin
- **Session:** D1 tables (better_auth_users, better_auth_sessions, better_auth_accounts)
- **No RLS:** Cloudflare D1 lacks RLS; app enforces `WHERE org_id = ?` in all queries

### Payment
- **Primary:** NOWPayments (USDT, global reach)
- **Backup:** PayOS (Vietnam domestic, VietQR)
- **Why:** NOWPayments supports USDT payout (crucial for affiliate settlement)
- **Webhook:** HMAC signature verification, IPN callback triggers tier activation + onboarding video
- **MCU System:** Monthly credits per tier, deducted per feature

### Video Pipeline
- **Orchestrator:** Inngest (event-driven)
- **6-Step Flow:**
  1. Script generation (OpenRouter gpt-4o-mini)
  2. TTS (Coqui XTTS v2 on Fly.io Docker)
  3. Visual generation (HeyGen or HunyuanVideo on Runpod)
  4. Composition (FFmpeg + #ad overlay)
  5. Upload (R2 + verify)
  6. Publish (subscriber notification)
- **Why:** Decoupled, resumable, error recovery via Inngest

### Affiliate Integration
- **5 Networks:** TikTok Shop (0-12% commission), Awin (CPS), ClickBank (40%+ commission), AccessTrade (Vietnam), Amazon (2-10%)
- **Webhook Standardization:** Each network adapter implements HMAC verification + rate limiting
- **Commission Ledger:** Append-only D1 table, 14-day clawback window before settlement
- **Why:** Diversify income streams, lower risk via clawback period

### AI Reasoning
- **Provider:** Claude SDK (Anthropic) + Qwen 3 32B (localhost:11434 or Bailian API)
- **Caching:** D1 LLM cache (SHA-256 exact-match, 24h TTL, org-scoped)
- **Why:** Claude for structured reasoning; Qwen for high-volume local inference

---

## Success Metrics

### Business Metrics
| Metric | Target | Status (2026-04-30) |
|--------|--------|---|
| Monthly Recurring Revenue (MRR) | $80K+ | In progress |
| Annual Recurring Revenue (ARR) | $1M+ | 2026-12-31 target |
| Customer Count | 50+ | 5 beta customers |
| LTV (Lifetime Value) | $5,000+ | $600 (early stage) |
| CAC (Customer Acquisition Cost) | < $1,000 | $200 (referral-driven) |
| Churn Rate | < 5% | 0% (retention focus) |
| Net Promoter Score (NPS) | 60+ | 72 (5 customers) |

### Technical Metrics
| Metric | Target | Status |
|--------|--------|--------|
| Build Time | < 10s | 8.2s ✅ |
| Test Pass Rate | 100% | 1798/1798 (100%) ✅ |
| TypeScript Strict | 0 `:any` types | 0 (Phase 12+) ✅ |
| Uptime | 99.95% | 99.97% ✅ |
| Error Rate | < 0.1% | 0.02% ✅ |
| Page Load (LCP) | < 2.5s | 1.8s ✅ |
| API Latency (p95) | < 500ms | 320ms ✅ |

### Product Metrics (Phase 14)
| Feature | Status | Adoption |
|---------|--------|----------|
| Proposal Generation | ✅ Live | 100% of users |
| Video Pipeline (6-step) | ✅ Live | 60% (ENTERPRISE+) |
| Affiliate Networks (5) | ✅ Live | 40% (exploratory) |
| Content Publishing (3 platforms) | ✅ Live | 30% |
| Revenue Operations | ✅ Live | 0% (coming soon) |
| Telegram Bot | ✅ Live | 80% |
| OpenClaw Orchestrator | ✅ Live | 5% (experimental) |

---

## Roadmap & Phases (Complete 2026-04-30)

### Phase 1-5: Foundation (Q1 2026) ✅
- RaaS core (mission pipeline + D1 database)
- MCU billing (tiers + NOWPayments)
- Cloudflare migration (Workers + D1 + R2)
- Security audit (83→97/100)
- a16z 100/100 (solopreneur-first, async ops)

### Phase 6-8: Video Pipeline ✅
- Inngest orchestration (6-step flow)
- TTS service (Coqui XTTS v2 on Fly.io)
- Visual generation (HeyGen + HunyuanVideo)
- Onboarding video trigger (post-purchase)

### Phase 9: Affiliate Networks ✅
- 5 network adapters (TikTok Shop, Awin, ClickBank, AccessTrade, Amazon)
- Webhook ingestion (HMAC verified)
- Commission tracking + clawback

### Phase 10: Content Publishing ✅
- 3 platform adapters (TikTok, YouTube, Instagram)
- Token encryption (AES-GCM)
- Scheduler cron + FTC caption prefix

### Phase 11: Tenant Isolation ✅
- D1 Kysely tenant-scope plugin
- Tier quota enforcement
- Storage tracker cron

### Phase 12: OpenClaw Orchestrator ✅
- 10-primitive orchestrator framework
- Claude SDK + Qwen 3 integration
- Circuit breaker + skill activation

### Phase 13: Revenue Split ✅
- Commission ledger + 14-day clawback
- Payout batches (NOWPayments USDT)
- Reconciliation cron

### Phase 14: FTC Hardening ✅
- #ad overlay (FFmpeg drawtext)
- GDPR export/delete endpoints
- Runbook (10+ incidents)

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Affiliate network API changes | High | Medium | Monitor webhooks, maintain 2 backup networks |
| Video rendering failure | High | Low | Inngest retry logic (3 attempts), fallback to template |
| Payment settlement delay | Medium | Low | Weekly reconciliation cron, NOWPayments status monitoring |
| Data loss (D1 corruption) | High | Low | Nightly automated backup to R2, monthly restore tests |
| Regulatory (FTC/GDPR) | High | Low | #ad overlay + GDPR endpoints implemented, audit trail |
| Qwen inference timeout | Medium | Medium | Circuit breaker + Claude SDK fallback, 25s timeout gate |

---

## Next Steps (Post-Phase 14)

### Phase 15: Revenue Launch (2026-05-15)
- Enable affiliate payouts for beta customers
- Premium tier pricing adjustments
- Customer success playbook

### Phase 16: Scale & Growth (2026-06-30)
- Multi-language support (Vietnamese, Mandarin)
- Mobile app (React Native)
- Marketplace for custom agents

### Phase 17: Enterprise Features (2026-08-31)
- White-label solution
- Advanced analytics (cohort analysis, LTV curves)
- Custom integrations (HubSpot, Salesforce)

---

**Last Reviewed:** 2026-04-30 | **Next Review:** 2026-05-15
