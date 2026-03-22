# Sophia AI Factory — Technical Roadmap to $1M ARR

**Company:** Sophia AI Factory
**Stage:** zero_psf (pre-product-market fit)
**Model:** SaaS B2B
**Target:** $1M ARR
**ICP:** Digital agencies in Southeast Asia
**Moat:** AI proposal generation
**Date:** 2026-03-19
**License:** MIT

---

## Executive Summary

Sophia AI Factory is positioned to capture the Southeast Asian digital agency market with AI-powered video proposal generation. This technical roadmap outlines the architecture, infrastructure, and milestones required to scale from current state (landing page + pricing) to $1M ARR.

### Current State Assessment

| Component | Status | Gap |
|-----------|--------|-----|
| Frontend (Next.js) | ✅ Production ready | No backend integration |
| Pricing Tiers | ✅ Configured (MCU model) | No Polar.sh integration |
| Authentication | ❌ Not implemented | Critical for SaaS |
| AI Proposal Engine | ❌ Not implemented | Core moat |
| Video Generation | ❌ Not implemented | Core product |
| CRM Integration | ❌ Not implemented | Required for ICP workflow |
| Billing (Polar.sh) | ❌ Not implemented | Revenue operations |
| Infrastructure | ⚠️ Vercel ready | No SEA edge optimization |

---

## 1. Core Platform Architecture

### 1.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOPHIA AI FACTORY                            │
│                   AI Video Proposal Platform                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend       │────▶│   API Gateway    │────▶│   AI Engine      │
│   Next.js 16     │◀────│   Edge Functions │◀────│   Proposal Gen   │
│   React 19       │     │   Rate Limiting  │     │   Video AI       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                │
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Database │ │  Polar   │ │   CRM    │
              │ Postgres │ │  Billing │ │Integration│
              │ + RLS    │ │  Webhooks│ │          │
              └──────────┘ └──────────┘ └──────────┘
```

### 1.2 Core Components

| Component | Technology | Purpose | Build/Buy |
|-----------|------------|---------|-----------|
| **Frontend** | Next.js 16 + React 19 | Landing, dashboard, proposal editor | Build |
| **API Layer** | Cloudflare Workers | Edge API, rate limiting, auth | Build |
| **Database** | Supabase (Postgres) | Users, proposals, analytics | Buy |
| **Auth** | Supabase Auth + MFA | User management, sessions | Buy |
| **AI Proposal** | Claude API + custom prompts | Generate proposal content | Build (prompt engineering) |
| **Video Engine** | HeyGen/D-ID API + ffmpeg | AI avatar video generation | Buy + Build (orchestration) |
| **Storage** | Cloudflare R2 | Video assets, templates | Buy |
| **Billing** | Polar.sh | Subscriptions, MCU credits | Buy |
| **CRM Sync** | HubSpot/Salesforce API | Lead management | Build (integration) |
| **Queue** | Cloudflare Queues | Async video generation | Buy |

### 1.3 Data Model (Core Tables)

```sql
-- Users & Organizations
users (id, email, role, created_at)
organizations (id, name, plan_tier, mcu_balance, polar_customer_id)
org_members (org_id, user_id, role)

-- Proposals (Core Product)
proposals (id, org_id, title, status, ai_prompt, generated_content)
proposal_videos (id, proposal_id, video_url, avatar_id, duration_sec)
proposal_templates (id, org_id, name, template_json, is_system)

-- CRM Integration
crm_leads (id, org_id, crm_provider, external_id, data_json)
crm_sync_log (id, org_id, status, last_sync_at, error_message)

-- Billing & Usage
mcu_transactions (id, org_id, amount, type, reference_id)
usage_logs (id, org_id, feature, mcu_cost, timestamp)
subscriptions (id, org_id, polar_subscription_id, tier, status)

-- Analytics
proposal_metrics (id, proposal_id, views, clicks, converted_at)
```

### 1.4 AI Proposal Generation Flow

```
1. User Input (form/template)
         │
         ▼
2. Prompt Engineering Layer
   - Industry context (agency vertical)
   - Client data injection
   - Value proposition framework
         │
         ▼
3. LLM Generation (Claude API)
   - Executive summary
   - Solution architecture
   - Timeline & pricing
   - Case studies
         │
         ▼
4. Content Structuring
   - Slide deck JSON
   - Speaker notes
   - Visual cues for video
         │
         ▼
5. Video AI Orchestration
   - Avatar selection
   - TTS generation
   - Lip sync + rendering
         │
         ▼
6. Final Proposal Package
   - PDF deck
   - Video presentation
   - Interactive web version
```

---

## 2. Infrastructure for SEA Market

### 2.1 Geographic Strategy

| Region | Target Cities | Latency Target | Compliance |
|--------|---------------|----------------|------------|
| **Singapore** | SG | <50ms | PDPA ready |
| **Vietnam** | HCMC, Hanoi | <100ms | Data localization |
| **Thailand** | Bangkok | <100ms | PDPA compliance |
| **Indonesia** | Jakarta | <150ms | PDP Law |
| **Philippines** | Manila | <150ms | DPA compliance |
| **Malaysia** | KL | <100ms | PDPA |

### 2.2 Infrastructure Stack

| Layer | Provider | Configuration | Cost (est.) |
|-------|----------|---------------|-------------|
| **Edge/CDN** | Cloudflare | Global + SEA PoPs | $0-20/mo |
| **Frontend** | Cloudflare Pages | Auto-scaling | $0-5/mo |
| **Edge API** | Cloudflare Workers | 100K req/day free | $0-50/mo |
| **Database** | Supabase | Pro plan (regional) | $25/mo |
| **AI/ML** | Anthropic API | Usage-based | ~$500/mo at scale |
| **Video** | HeyGen/D-ID | Per-minute pricing | ~$200/mo at scale |
| **Storage** | Cloudflare R2 | 10GB free | $0-10/mo |
| **Billing** | Polar.sh | 5% + $0.30/tx | Transaction-based |

**Total Infrastructure at $1M ARR:** ~$3-5K/mo (10-15% of revenue)

### 2.3 Compliance Requirements

| Regulation | Country | Requirement | Implementation |
|------------|---------|-------------|----------------|
| **PDPA** | Singapore | Consent management, data access | Supabase RLS + audit logs |
| **PDPA** | Thailand | Data protection officer | Privacy policy + DPO contact |
| **PDP Law** | Indonesia | Data localization | Supabase AWS SG region |
| **DPA** | Philippines | Privacy impact assessment | Documentation + encryption |
| **PDPA** | Malaysia | Security safeguards | HTTPS, encryption at rest |

### 2.4 Latency Optimization

```yaml
strategy:
  - Cloudflare CDN for all static assets (images, videos, JS bundles)
  - Edge Functions in SIN (Singapore) for API responses
  - Database connection pooling via Supabase
  - Video streaming via Cloudflare Stream or Mux
  - Prefetching for common proposal templates

targets:
  - TTFB: <200ms (SEA region)
  - FCP: <1.5s
  - LCP: <2.5s
  - Video load: <3s initial frame
```

---

## 3. Integration Points

### 3.1 CRM Integrations (Priority: HIGH)

| CRM | ICP Segment | Integration Method | Timeline |
|-----|-------------|-------------------|----------|
| **HubSpot** | Mid-market agencies | REST API + Webhooks | Phase 2 |
| **Salesforce** | Enterprise | SOAP/REST API | Phase 3 |
| **Pipedrive** | Small agencies | REST API | Phase 2 |
| **Zoho CRM** | Cost-conscious | Deluge API | Phase 4 |

**Data Sync Flow:**
```
CRM Lead Created ──▶ Webhook ──▶ Sophia Queue ──▶ Auto-generate proposal draft
```

### 3.2 Video AI Providers

| Provider | Use Case | Pricing | Recommendation |
|----------|----------|---------|----------------|
| **HeyGen** | Avatar presentations | $0.10-0.30/min | Primary (quality) |
| **D-ID** | Talking head videos | $0.05-0.15/min | Secondary (cost) |
| **Synthesia** | Enterprise custom | Custom | Phase 3 |
| **Self-hosted (SadTalker)** | Cost optimization | GPU cost | Phase 4 |

### 3.3 Polar.sh Billing Integration

```yaml
endpoints:
  checkout: POST /api/billing/checkout
  webhook: POST /api/webhooks/polar
  portal: GET /api/billing/portal

events:
  - subscription.created
  - subscription.updated
  - subscription.cancelled
  - order.paid
  - refund.processed

mcu_sync:
  - On payment: credit MCU balance
  - On usage: deduct MCU balance
  - On zero balance: HTTP 402 (Payment Required)
```

### 3.4 LLM Provider Strategy

| Provider | Model | Use Case | Fallback |
|----------|-------|----------|----------|
| **Anthropic** | Claude Sonnet 4 | Primary proposal generation | Qwen 3.5 |
| **DashScope** | Qwen 3.5 Plus | Cost-optimized generation | DeepSeek |
| **OpenRouter** | Multi-model | Fallback routing | - |

---

## 4. Technical Milestones to $1M ARR

### Revenue Math
```
$1M ARR = $83,333 MRR

Pricing Tiers:
- Starter: $49/mo → 170 customers = $8,330 MRR
- Growth: $149/mo → 350 customers = $52,150 MRR
- Premium: $499/mo → 46 customers = $22,954 MRR

Total: 566 customers → $83,434 MRR → $1M+ ARR
```

### 4.1 Phase 1: Foundation (Weeks 1-4) — Target: $0 ARR

**Goal:** MVP with core proposal generation

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| **M1.1: Auth + Onboarding** | - Supabase Auth<br>- Org creation<br>- Welcome flow | Users can sign up and create org |
| **M1.2: AI Proposal Text** | - Prompt templates<br>- Claude integration<br>- PDF export | Generate text proposal in <30s |
| **M1.3: Polar Billing** | - Checkout flow<br>- Webhook handling<br>- MCU credits | First paid customer |
| **M1.4: Basic Dashboard** | - Usage tracking<br>- Proposal history<br>- Settings | User can manage account |

**Exit Criteria:** First paying customer, proposal generation working end-to-end

### 4.2 Phase 2: Video + CRM (Weeks 5-12) — Target: $10K MRR

**Goal:** Video proposal generation + CRM integrations

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| **M2.1: Video AI Integration** | - HeyGen API<br>- Avatar selection<br>- Video rendering queue | Video proposal in <5 min |
| **M2.2: CRM Sync (HubSpot)** | - OAuth flow<br>- Lead import<br>- Auto-proposal trigger | CRM lead → proposal in 1 click |
| **M2.3: Proposal Analytics** | - View tracking<br>- Click tracking<br>- Conversion metrics | Show proposal ROI to users |
| **M2.4: Template Marketplace** | - Pre-built templates<br>- Custom template editor<br>- Share templates | 10+ templates available |

**Exit Criteria:** $10K MRR, 50+ active customers, video proposals working

### 4.3 Phase 3: Scale (Weeks 13-24) — Target: $50K MRR

**Goal:** Enterprise features + market expansion

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| **M3.1: Multi-language** | - Vietnamese, Thai, Indonesian<br>- Auto-translate proposals<br>- Localized templates | SEA market ready |
| **M3.2: Team Collaboration** | - Multi-user editing<br>- Comments & approvals<br>- Version history | Teams can collaborate |
| **M3.3: Enterprise SSO** | - SAML/OAuth<br>- Custom domains<br>- SLA monitoring | Enterprise customers onboarded |
| **M3.4: Advanced Analytics** | - A/B testing proposals<br>- AI optimization suggestions<br>- Revenue attribution | Data-driven proposal improvements |

**Exit Criteria:** $50K MRR, 3+ enterprise customers, 3+ countries

### 4.4 Phase 4: Moat Expansion (Weeks 25-52) — Target: $100K+ MRR

**Goal:** Defensible AI advantage + ecosystem

| Milestone | Deliverables | Success Criteria |
|-----------|--------------|------------------|
| **M4.1: Custom AI Fine-tuning** | - Industry-specific models<br>- Customer data fine-tuning<br>- Proprietary datasets | 2x proposal quality vs competitors |
| **M4.2: API Platform** | - Public API<br>- Developer docs<br>- Partner integrations | 10+ third-party integrations |
| **M4.3: White-label** | - Agency reseller program<br>- Custom branding<br>- Revenue share | 5+ reseller partners |
| **M4.4: AI Video Self-hosted** | - Open-source video models<br>- GPU cluster<br>- Cost optimization | 50% reduction in video costs |

**Exit Criteria:** $100K+ MRR, defensible moat, path to $1M ARR clear

---

## 5. Security & Compliance

### 5.1 Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Edge Security (Cloudflare)                    │
│  - DDoS protection                                      │
│  - WAF rules                                            │
│  - Bot management                                       │
├─────────────────────────────────────────────────────────┤
│  Layer 2: API Security                                  │
│  - JWT authentication                                   │
│  - Rate limiting (100 req/min per user)                 │
│  - Input validation (zod schemas)                       │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Data Security                                 │
│  - Row-Level Security (RLS) in Postgres                 │
│  - Encryption at rest (AES-256)                         │
│  - Encryption in transit (TLS 1.3)                      │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Application Security                          │
│  - XSS prevention (React auto-escape)                   │
│  - CSRF tokens                                          │
│  - Content Security Policy headers                      │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Security Checklist

| Control | Status | Implementation |
|---------|--------|----------------|
| **Authentication** | | |
| - Email/password + MFA | ❌ Phase 1 | Supabase Auth |
| - Session management | ❌ Phase 1 | JWT tokens |
| - Password policies | ❌ Phase 1 | Supabase defaults |
| **Authorization** | | |
| - Role-based access (RBAC) | ❌ Phase 1 | Postgres RLS |
| - Organization isolation | ❌ Phase 1 | RLS policies |
| - API key management | ❌ Phase 2 | Encrypted storage |
| **Data Protection** | | |
| - Encryption at rest | ✅ Provided | Supabase default |
| - Encryption in transit | ✅ Provided | HTTPS/TLS |
| - PII data classification | ❌ Phase 1 | Data inventory |
| - Right to deletion | ❌ Phase 2 | GDPR/PDPA compliance |
| **API Security** | | |
| - Rate limiting | ❌ Phase 1 | Cloudflare |
| - Input validation | ❌ Phase 1 | Zod schemas |
| - SQL injection prevention | ❌ Phase 1 | Parameterized queries |
| - XSS prevention | ⚠️ Partial | React auto-escape |
| **Monitoring** | | |
| - Error tracking | ❌ Phase 1 | Sentry |
| - Audit logging | ❌ Phase 2 | Supabase logs |
| - Security alerts | ❌ Phase 2 | PagerDuty integration |

### 5.3 Compliance Roadmap

| Quarter | Compliance Target | Requirements |
|---------|-------------------|--------------|
| **Q2 2026** | Basic Privacy | Privacy policy, ToS, cookie consent |
| **Q3 2026** | PDPA (Singapore) | DPO appointment, data access requests |
| **Q4 2026** | SOC 2 Type I | Security controls documentation |
| **Q1 2027** | SOC 2 Type II | 6-month audit period |
| **Q2 2027** | ISO 27001 | Full ISMS implementation |

### 5.4 Data Residency

| Data Type | Storage Location | Compliance |
|-----------|------------------|------------|
| User credentials | Supabase (AWS Singapore) | PDPA compliant |
| Proposal content | R2 (Cloudflare global) | Encrypted |
| Video assets | Cloudflare Stream (global CDN) | - |
| Analytics data | Supabase (Singapore) | PDPA |
| Backup data | AWS Singapore + Backup region | DR compliance |

---

## Appendix A: Resource Estimates

### Team Requirements

| Phase | Role | Count | Type |
|-------|------|-------|------|
| **Phase 1** | Full-stack Engineer | 2 | Core build |
| **Phase 1** | AI/Prompt Engineer | 1 | Proposal quality |
| **Phase 2** | Video Engineer | 1 | Video pipeline |
| **Phase 2** | Sales Engineer | 1 | Customer integration |
| **Phase 3** | DevOps/SRE | 1 | Infrastructure |
| **Phase 3** | Frontend Specialist | 1 | UX polish |
| **Phase 4** | ML Engineer | 2 | Fine-tuning |
| **Phase 4** | Security Engineer | 1 | Compliance |

### Infrastructure Cost Projection

| Phase | Customers | MRR | Infrastructure Cost | % of Revenue |
|-------|-----------|-----|---------------------|--------------|
| Phase 1 | 10 | $500 | $100/mo | 20% |
| Phase 2 | 100 | $10K | $800/mo | 8% |
| Phase 3 | 350 | $50K | $2.5K/mo | 5% |
| Phase 4 | 700 | $100K | $4K/mo | 4% |

---

## Appendix B: Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **AI quality insufficient** | High | Medium | Invest in prompt engineering, fine-tuning, human feedback loop |
| **Video costs too high** | Medium | Medium | Self-hosted models, batch processing, optimization |
| **SEA compliance complexity** | Medium | High | Legal counsel per market, start with Singapore |
| **Competitor copycat** | High | High | Speed to market, customer relationships, data moat |
| **LLM provider dependency** | Medium | Low | Multi-provider routing, abstraction layer |
| **CRM API changes** | Low | Low | Abstraction layer, monitoring, quick iteration |

---

## Appendix C: Unresolved Questions

1. **Video Generation Strategy:** HeyGen vs D-ID vs self-hosted? Trade-off between quality, cost, and control.
2. **Database Region:** Supabase Singapore for SEA latency, or multi-region for redundancy?
3. **CRM Priority:** HubSpot first or Pipedrive (simpler, cheaper for small agencies)?
4. **Polar.sh vs Stripe:** Polar.sh is mandated, but does it support SEA payment methods adequately?
5. **AI Model Strategy:** Fine-tune open-source models vs continue with Claude API for proposal generation?

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-19
**Owner:** CTO / OpenClaw
**Review Cadence:** Bi-weekly during sprints
