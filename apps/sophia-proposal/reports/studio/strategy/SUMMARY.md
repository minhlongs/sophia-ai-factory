# Sophia AI Factory — Portfolio Strategy Summary

**Company:** Sophia AI Factory
**Stage:** zero_psf (Pre-Product-Market Fit)
**Model:** SaaS B2B
**Target:** $1M ARR by Q2 2027
**ICP:** Digital agencies in Southeast Asia
**Moat:** AI proposal generation
**Date:** 2026-03-19

---

## Executive Summary

Sophia AI Factory targets the Southeast Asian digital agency market with AI-powered video proposal generation. The strategy combines technical excellence with disciplined revenue gates to achieve $1M ARR within 18 months.

### North Star Metric
**$1M ARR by Q2 2027** (18 months from zero_psf stage)

---

## Strategic Pillars

| Pillar | Description | Target |
|--------|-------------|--------|
| **1. Market Validation** | Prove agencies will pay before building | 10 paid pilots, $5K MRR (Q2 2026) |
| **2. Product-Market Fit** | Build repeatable sales motion | 50 customers, $300K ARR (Q4 2026) |
| **3. Scale** | Hypergrowth with unit economics discipline | 200 customers, $1M ARR (Q2 2027) |

---

## Portfolio Allocation

### Phase 1: Market Validation (Q2 2026)
**Budget:** $125K/quarter | **Headcount:** 6 FTE

| Initiative | Investment | Success Metric |
|------------|------------|----------------|
| Auth + Onboarding MVP | $25K | Users can self-serve signup |
| AI Proposal Text Engine | $40K | Generate proposal in <30s, 80%+ quality |
| Polar Billing Integration | $15K | First $499 payment processed |
| Basic Dashboard + Analytics | $20K | NPS > 30 from 10 pilot users |
| Customer Discovery | $25K | 50 ICP interviews, 5 case studies |

**Go/No-Go Gate (2026-06-30):**
- ✅ 10 paid pilots at $499/mo → GO to Phase 2
- ⚠️ < 5 paid pilots → PIVOT (adjust pricing/ICP)
- ❌ 0 paid pilots → STOP (market doesn't value)

---

### Phase 2: Product-Market Fit (Q3-Q4 2026)
**Budget:** $515K total | **Headcount:** 8 → 14 FTE

| Initiative | Investment | Success Metric |
|------------|------------|----------------|
| Video AI Pipeline | $80K | Video in <5 min, cost < $2/video |
| CRM Sync (HubSpot) | $45K | 1-click lead→proposal, 20% activation |
| Analytics Dashboard | $35K | Show 40%+ win rate lift to customers |
| Self-Serve Onboarding | $50K | 80% activation without human touch |
| Multi-language (SEA) | $60K | Vietnamese, Thai, Indonesian live |
| Team Collaboration | $55K | Multi-user editing, 90% retention |
| Enterprise Tier | $70K | First $25K ACV deal closed |
| Sales/Marketing ramp | $120K | Pipeline generation |

**Go/No-Go Gate (2026-09-30):**
- ✅ $12.5K MRR + <5% churn + 40% PMF score → GO to Scale
- ⚠️ < $8K MRR OR >10% churn → EXTEND PMF Phase
- ❌ < $5K MRR → PIVOT (reassess PMF)

**Go/No-Go Gate (2026-12-31):**
- ✅ $25K MRR + NRR >100% + playbook documented → GO to Series A prep
- ⚠️ < $15K MRR → DELAY Series A

---

### Phase 3: Scale (Q1-Q2 2027)
**Budget:** $1.12M total | **Headcount:** 19 → 28 FTE

| Initiative | Investment | Success Metric |
|------------|------------|----------------|
| Advanced Analytics | $100K | A/B testing, LTV:CAC >3:1 visible |
| API Platform | $150K | Public API, 10+ integrations |
| White-label Program | $120K | 5+ reseller partners |
| Mobile App (iOS+Android) | $180K | 30% MAU adoption |
| Self-hosted Video | $200K | 50% lower video costs |
| SEA Market Expansion | $250K | 6-country coverage |
| Sales/Marketing scale | $420K | Pipeline acceleration |

**Go/No-Go Gate (2027-03-31):**
- ✅ $500K ARR + LTV:CAC >3:1 + clear path → GO to Series A
- ⚠️ < $300K ARR → BOOTSTRAP EXTENSION

**Go/No-Go Gate (2027-06-30):**
- ✅ $83K MRR + 200 customers + 85% GRR → MISSION ACCOMPLISHED
- ⚠️ < $60K MRR → RECALIBRATE

---

## Technical Architecture Summary

### Core Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16 + React 19 | Landing, dashboard, proposal editor |
| API Layer | Cloudflare Workers | Edge API, rate limiting, auth |
| Database | Supabase (Postgres) | Users, proposals, analytics + RLS |
| Auth | Supabase Auth + MFA | User management, sessions |
| AI Proposal | Claude API + custom prompts | Generate proposal content |
| Video Engine | HeyGen/D-ID API + ffmpeg | AI avatar video generation |
| Storage | Cloudflare R2 | Video assets, templates |
| Billing | Polar.sh | Subscriptions, MCU credits |
| CRM Sync | HubSpot/Salesforce API | Lead management |
| Queue | Cloudflare Queues | Async video generation |

### SEA Infrastructure Requirements
- **Latency targets:** <50ms (Singapore) to <150ms (Indonesia/Philippines)
- **Compliance:** PDPA (SG, TH, MY), PDP Law (ID), DPA (PH)
- **Data residency:** All data in Singapore (PDPA compliant)
- **Infrastructure cost:** ~$3-5K/mo at $1M ARR (10-15% of revenue)

---

## Key Milestones Timeline

| Quarter | Revenue | Customers | Key Deliverables |
|---------|---------|-----------|------------------|
| Q2 2026 | $5K MRR | 10 pilots | Auth, AI text, Polar billing |
| Q3 2026 | $12.5K MRR | 25 customers | Video AI, CRM sync, analytics |
| Q4 2026 | $25K MRR | 50 customers | Multi-language, self-serve, enterprise tier |
| Q1 2027 | $500K ARR | 100 customers | API platform, advanced analytics |
| Q2 2027 | $1M ARR | 200 customers | White-label, mobile app, SEA expansion |

---

## Revenue Math to $1M ARR

```
Tier Breakdown at $1M ARR:
- Starter ($49/mo):    200 customers × $49  = $9,800/mo
- Growth ($149/mo):    250 customers × $149 = $37,250/mo
- Premium ($499/mo):   50 customers × $499  = $24,950/mo
- Master ($999/mo):    10 customers × $999  = $9,990/mo
---------------------------------------------------------
Total:                 510 customers         = $81,990/mo ≈ $1M ARR
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Market doesn't value AI proposals | Medium | Critical | 10 paid pilots before heavy build |
| Video costs too high | Medium | High | Set $2/video target, self-host fallback |
| Competition (HeyGen, Canva) | High | Medium | Focus on proposal workflow, not just video |
| Hiring delays in SEA | Medium | Medium | Remote-first, contractor pipeline |
| Polar.sh SEA payment gaps | Low | High | Manual invoice fallback for enterprise |
| LLM API cost volatility | Medium | Low | Multi-provider routing (Claude→Qwen→DeepSeek) |

---

## Success Metrics Dashboard

| Metric | Current | Q2 2026 | Q4 2026 | Q2 2027 |
|--------|---------|---------|---------|---------|
| MRR | $0 | $5K | $25K | $83K |
| Active Customers | 0 | 10 | 50 | 200 |
| Churn (monthly) | — | <10% | <5% | <3% |
| NPS | — | >30 | >40 | >50 |
| PMF Score | — | — | >40% | — |
| LTV:CAC | — | — | — | >3:1 |
| GRR | — | — | — | >85% |
| NRR | — | — | >100% | >110% |

---

## Next Actions (Immediate)

### Week 1-2: Foundation
- [ ] Set up Supabase project + Auth
- [ ] Configure Polar.sh products + webhooks
- [ ] Build basic Next.js auth integration
- [ ] Draft 50 customer interview script

### Week 3-4: MVP
- [ ] AI proposal text generation (Claude API)
- [ ] Basic dashboard with proposal list
- [ ] Polar checkout flow integration
- [ ] Recruit 10 pilot customers

### Week 5-6: Pilot Launch
- [ ] Onboard 10 paid pilots at $499/mo
- [ ] Collect feedback + iterate
- [ ] Document 3 case studies

---

## Unresolved Questions

1. **Video Provider Selection:** HeyGen (quality) vs D-ID (cost) vs self-hosted (control)
2. **Database Region Strategy:** Singapore-only (simpler) vs multi-region (lower latency)
3. **CRM Priority:** HubSpot (enterprise) vs Pipedrive (SMB)
4. **Polar.sh SEA Coverage:** Need to verify payment method coverage for Indonesia/Philippines
5. **AI Model Strategy:** Fine-tune vs multi-provider API routing
6. **Series A Timing:** Gate 3 ($25K MRR) vs Gate 4 ($500K ARR)
7. **First SEA Market After Singapore:** Vietnam (founder familiarity) vs Thailand (larger market)

---

**Reports Generated:**
- Technical Roadmap: `./technical-roadmap.md`
- OKR Framework: `./okr-framework.md`
- Execution Plan: `./execution-plan.md`

**Strategy Session Complete.** Ready for implementation planning.
