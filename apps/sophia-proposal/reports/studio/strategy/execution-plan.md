---
title: "Sophia AI Factory — Execution Plan to $1M ARR"
description: "Phase-gated execution combining technical roadmap + OKR framework"
company: Sophia AI Factory
stage: zero_psf (Pre-Product-Market Fit)
target: $1M ARR by Q2 2027
created: 2026-03-19
owner: CEO / CTO
review_cycle: Bi-weekly sprint reviews
---

# SOPHIA AI FACTORY — EXECUTION PLAN TO $1M ARR

## Executive Summary

**North Star:** $1M ARR within 18 months (by Q2 2027)

**Critical Path:** Market Validation (Q2 2026) → Product-Market Fit (Q3-Q4 2026) → Scale (Q1-Q2 2027)

**Total Investment:** ~$1.76M cumulative burn to $1M ARR

**Key Insight:** Technical milestones MUST align with revenue gates — no feature shipped without revenue validation.

---

## 1. PHASE-GATED EXECUTION

### Phase 0 → 1: Market Validation (Q2 2026)

**Theme:** Prove agencies will pay before building

**Budget:** $125K/quarter | **Headcount:** 6 FTE | **Target:** $5K MRR

| Technical Milestone | OKR Alignment | Go/No-Go Criteria |
|---------------------|---------------|-------------------|
| **M1.1: Auth + Onboarding** (Week 1-2) | KR 1.1, KR 1.6 | Users can sign up without manual intervention |
| **M1.2: AI Proposal Text** (Week 2-4) | KR 1.3 | Generate proposal in <30s with 80%+ quality score |
| **M1.3: Polar Billing** (Week 3-5) | KR 1.4 | First $499 payment processed |
| **M1.4: Basic Dashboard** (Week 4-6) | KR 1.5 | NPS > 30 from 10 pilot users |

**Decision Gate 1 (2026-06-30):**
- 10 paid pilots at $499/mo = **GO to Phase 2**
- < 5 paid pilots = **PIVOT** (adjust pricing or ICP)
- 0 paid pilots = **STOP** (market doesn't value)

---

### Phase 1 → 10: Product-Market Fit (Q3-Q4 2026)

**Theme:** Build repeatable sales motion

**Budget:** $205K (Q3) + $310K (Q4) | **Headcount:** 8 → 14 FTE | **Target:** $25K MRR

| Technical Milestone | OKR Alignment | Go/No-Go Criteria |
|---------------------|---------------|-------------------|
| **M2.1: Video AI Pipeline** (Week 7-10) | KR 2.1, KR 2.6 | Video proposal in <5 min, cost < $2/video |
| **M2.2: CRM Sync (HubSpot)** (Week 9-12) | KR 2.4 | 1-click lead → proposal, 20% activation |
| **M2.3: Analytics Dashboard** (Week 11-14) | KR 2.5 | Show 40%+ win rate lift to customers |
| **M2.4: Self-Serve Onboarding** (Week 13-16) | KR 3.3 | 80% activation without human touch |
| **M3.1: Multi-language (SEA)** (Week 17-20) | KR 4.3 | Vietnamese, Thai, Indonesian live |
| **M3.2: Team Collaboration** (Week 19-22) | KR 2.3 | Multi-user editing, 90% retention |
| **M3.3: Enterprise Tier** (Week 21-26) | KR 2.6 | First $25K ACV deal closed |

**Decision Gate 2 (2026-09-30):**
- $12.5K MRR + <5% churn + 40% PMF score = **GO to Scale**
- < $8K MRR OR >10% churn = **EXTEND PMF Phase** (another quarter)
- < $5K MRR = **PIVOT** (reassess product-market fit)

**Decision Gate 3 (2026-12-31):**
- $25K MRR + NRR >100% + playbook documented = **GO to Series A prep**
- < $15K MRR = **DELAY Series A** (focus on revenue)

---

### Phase 10 → 100: Scale (Q1-Q2 2027)

**Theme:** Hypergrowth with unit economics discipline

**Budget:** $460K (Q1) + $660K (Q2) | **Headcount:** 19 → 28 FTE | **Target:** $83K MRR ($1M ARR)

| Technical Milestone | OKR Alignment | Go/No-Go Criteria |
|---------------------|---------------|-------------------|
| **M3.4: Advanced Analytics** (Week 27-32) | KR 4.6 | A/B testing, LTV:CAC >3:1 visible |
| **M4.1: API Platform** (Week 30-36) | KR 3.4 | Public API, 10+ integrations |
| **M4.2: White-label Program** (Week 34-40) | KR 4.2 | 5+ reseller partners |
| **M4.3: Mobile App** (Week 38-44) | KR 4.4 | iOS + Android, 30% MAU adoption |
| **M4.4: Self-hosted Video** (Week 42-52) | Cost reduction | 50% lower video costs |

**Decision Gate 4 (2027-03-31):**
- $500K ARR + LTV:CAC >3:1 + clear path to $1M = **GO to Series A raise**
- < $300K ARR = **BOOTSTRAP EXTENSION** (extend runway, delay raise)

**Decision Gate 5 (2027-06-30):**
- $83K MRR + 200 customers + 85% GRR = **MISSION ACCOMPLISHED**
- < $60K MRR = **RECALIBRATE** (diagnose growth blockers)

---

## 2. CRITICAL PATH TO $1M ARR

### Revenue Math (Bottom-Up)

```
$1M ARR = $83,333 MRR

Customer Mix Required:
┌─────────────┬──────────────┬─────────────┬──────────────┐
│ Tier        │ Price/mo     │ Customers   │ MRR          │
├─────────────┼──────────────┼─────────────┼──────────────┤
│ Starter     │ $49          │ 170         │ $8,330       │
│ Growth      │ $149         │ 350         │ $52,150      │
│ Premium     │ $499         │ 46          │ $22,954      │
├─────────────┴──────────────┴─────────────┴──────────────┤
│ TOTAL         │              │ 566         │ $83,434      │
└─────────────────────────────────────────────────────────┘
```

### Critical Path Dependencies

```
Week 1-2: Auth working ─────────────────────────────┐
                                                     ▼
Week 3-5: Polar integration → FIRST PAYMENT ────────┐
                                                     ▼
Week 7-10: Video AI → PRODUCT COMPLETE ─────────────┐
                                                     ▼
Week 9-12: CRM sync → REPEATABLE SALES ─────────────┐
                                                     ▼
Week 13-16: Self-serve → SCALE READY ───────────────┐
                                                     ▼
Week 17-26: Multi-language → SEA EXPANSION ─────────┐
                                                     ▼
Week 27-52: Enterprise + API → $1M ARR ─────────────► $1M
```

### Single Points of Failure

| Risk | Impact | Mitigation | Owner | Deadline |
|------|--------|------------|-------|----------|
| **Polar.sh doesn't support SEA** | Revenue blocked | Stripe fallback + local payment research | CEO | Week 3 |
| **Video quality < 80% score** | Product unusable | HeyGen + D-ID parallel testing | CTO | Week 8 |
| **Customer interviews < 50** | No PMF signal | Incentivize with $100 credits | CPO | Week 6 |
| **Key engineer departure** | Timeline slips 4-8 weeks | Documentation + cross-training | CTO | Ongoing |
| **Runway < 6 months at Gate 2** | Forced pivot/raise | Bridge round prep + burn reduction | CEO | Gate 2 |

---

## 3. RESOURCE DEPLOYMENT SCHEDULE

### Quarterly Budget Allocation (Cumulative: $1.76M)

| Category | Q2 2026 | Q3 2026 | Q4 2026 | Q1 2027 | Q2 2027 | TOTAL |
|----------|---------|---------|---------|---------|---------|-------|
| **Engineering** | $80K | $120K | $180K | $250K | $350K | $980K |
| **Sales** | $20K | $40K | $60K | $100K | $150K | $370K |
| **Marketing** | $15K | $30K | $50K | $80K | $120K | $295K |
| **Operations** | $10K | $15K | $20K | $30K | $40K | $115K |
| **Total/Quarter** | $125K | $205K | $310K | $460K | $660K | **$1.76M** |

### Headcount Ramp (1 → 28 FTE)

| Quarter | Eng | Product | Sales | Marketing | Ops | TOTAL |
|---------|-----|---------|-------|-----------|-----|-------|
| **Q2 2026** | 2 | 1 | 1 | 1 | 1 | 6 |
| **Q3 2026** | 3 | 1 | 2 | 1 | 1 | 8 |
| **Q4 2026** | 5 | 2 | 3 | 2 | 2 | 14 |
| **Q1 2027** | 7 | 2 | 5 | 3 | 2 | 19 |
| **Q2 2027** | 10 | 3 | 8 | 4 | 3 | 28 |

**Hiring Triggers:**
- Hire Engineer #3 when MRR > $5K (Q3)
- Hire Sales #2 when pipeline > $50K (Q3)
- Hire ML Engineer when video costs > $500/mo (Q4)
- Hire DevOps when uptime incidents > 2/month (Q1 2027)

---

## 4. MILESTONE CHECKPOINTS

### Bi-Weekly Sprint Cadence

| Sprint | Dates | Focus Milestone | Revenue Check |
|--------|-------|-----------------|---------------|
| **S1** | W1-2 | Auth + Onboarding | $0 |
| **S2** | W3-4 | AI Proposal MVP | $0 |
| **S3** | W5-6 | Polar Billing + First $ | $500+ |
| **S4** | W7-8 | Video AI Pipeline | $2K+ |
| **S5** | W9-10 | CRM Integration | $5K+ (Gate 1) |
| **S6** | W11-12 | Analytics Dashboard | $7.5K+ |
| **S7** | W13-14 | Self-Serve Onboarding | $10K+ |
| **S8** | W15-16 | Template Marketplace | $12.5K+ (Gate 2) |
| **S9** | W17-18 | Multi-Language (SEA) | $15K+ |
| **S10** | W19-20 | Team Collaboration | $18K+ |
| **S11** | W21-22 | Enterprise Tier | $22K+ |
| **S12** | W23-24 | Partner Channel | $25K+ (Gate 3) |
| **S13** | W25-26 | Advanced Analytics | $30K+ |
| **S14** | W27-28 | API Platform | $35K+ |
| **S15** | W29-30 | White-Label Program | $42K+ |
| **S16** | W31-32 | Mobile App | $50K+ (Gate 4) |
| **S17** | W33-34 | Self-Hosted Video | $60K+ |
| **S18** | W35-36 | SEA Expansion (2 markets) | $70K+ |
| **S19** | W37-38 | Enterprise SSO | $75K+ |
| **S20** | W39-40 | API Partner Ecosystem | $80K+ |
| **S21** | W41-42 | Performance Optimization | $82K+ |
| **S22** | W43-44 | Final Push | $83K+ (Gate 5) |

### Monthly Review Cadence

| Month | Review Date | OKR Check | Pivot Decision |
|-------|-------------|-----------|----------------|
| **Apr 2026** | 2026-04-30 | S1-S2 complete? | Auth delays = reassess timeline |
| **May 2026** | 2026-05-31 | First payment? | No payment by W6 = pricing pivot |
| **Jun 2026** | 2026-06-30 | Gate 1 | < 5 pilots = major pivot |
| **Jul 2026** | 2026-07-31 | Video quality? | < 80% score = provider switch |
| **Aug 2026** | 2026-08-31 | CRM adoption? | < 50% activation = UX overhaul |
| **Sep 2026** | 2026-09-30 | Gate 2 | < $8K MRR = extend PMF phase |
| **Oct 2026** | 2026-10-31 | Churn rate? | > 10% = product fix sprint |
| **Nov 2026** | 2026-11-30 | NRR trend? | < 100% = upsell motion fix |
| **Dec 2026** | 2026-12-31 | Gate 3 | < $15K MRR = delay Series A |
| **Jan 2027** | 2027-01-31 | CAC trend? | Rising CAC = channel pivot |
| **Feb 2027** | 2027-02-28 | LTV:CAC? | < 3:1 = pricing/retention fix |
| **Mar 2027** | 2027-03-31 | Gate 4 | < $500K ARR = bootstrap extension |
| **Apr 2027** | 2027-04-30 | SEA expansion? | Missed = focus on core markets |
| **May 2027** | 2027-05-31 | $1M trajectory? | Off = recalibrate plan |
| **Jun 2027** | 2027-06-30 | Gate 5 | Mission complete or diagnose |

---

## 5. DECISION GATES (GO/NO-GO CRITERIA)

### Gate 1: Pilot Validation (2026-06-30)

| Criteria | Target | Weight | Pass/Fail |
|----------|--------|--------|-----------|
| Paid pilot customers | 10 agencies | 30% | ☐ |
| NPS from pilots | > 30 | 20% | ☐ |
| Proposal win rate lift | > 40% | 25% | ☐ |
| MRR achieved | $5K+ | 25% | ☐ |

**Decision Logic:**
- **GO (70%+ pass):** Proceed to Phase 2, hire Engineer #3
- **PIVOT (40-69%):** Adjust pricing/ICP, extend Gate 1 by 4 weeks
- **STOP (<40%):** Shut down or pivot to adjacent market

---

### Gate 2: PMF Signal (2026-09-30)

| Criteria | Target | Weight | Pass/Fail |
|----------|--------|--------|-----------|
| MRR achieved | $12.5K+ | 30% | ☐ |
| Monthly churn | < 5% | 25% | ☐ |
| Sean Ellis PMF score | > 40% "very disappointed" | 25% | ☐ |
| Sales cycle | < 45 days | 20% | ☐ |

**Decision Logic:**
- **GO (70%+ pass):** Begin Series A prep, hire Sales #2-3
- **EXTEND PMF (40-69%):** Another quarter to prove PMF, reduce burn 20%
- **PIVOT (<40%):** Reassess product-market fit, consider acquihire

---

### Gate 3: Scale Ready (2026-12-31)

| Criteria | Target | Weight | Pass/Fail |
|----------|--------|--------|-----------|
| MRR achieved | $25K+ | 35% | ☐ |
| Net Revenue Retention | > 100% | 25% | ☐ |
| Sales playbook documented | Complete | 20% | ☐ |
| Support SLA | < 4 hours | 20% | ☐ |

**Decision Logic:**
- **GO (70%+ pass):** Launch Series A raise at $2-3M valuation
- **DELAY SERIES A (40-69%):** Extend runway 6 months, hit $40K MRR first
- **RESTRUCTURE (<40%):** Cost reduction, focus on profitability over growth

---

### Gate 4: Series A (2027-03-31)

| Criteria | Target | Weight | Pass/Fail |
|----------|--------|--------|-----------|
| ARR achieved | $500K+ | 40% | ☐ |
| LTV:CAC ratio | > 3:1 | 30% | ☐ |
| Path to $1M ARR | Clear model | 20% | ☐ |
| Team completeness | 80% of plan | 10% | ☐ |

**Decision Logic:**
- **GO (70%+ pass):** Raise $2-3M Series A at $10-15M pre-money
- **BRIDGE (40-69%):** Raise $500K-1M bridge at $5-7M valuation
- **BOOTSTRAP (<40%):** Extend runway, focus on profitability

---

### Gate 5: $1M ARR (2027-06-30)

| Criteria | Target | Weight | Pass/Fail |
|----------|--------|--------|-----------|
| MRR achieved | $83K+ | 40% | ☐ |
| Active customers | 200+ agencies | 25% | ☐ |
| Gross Revenue Retention | > 85% | 20% | ☐ |
| Geographic expansion | 2+ new markets | 15% | ☐ |

**Decision Logic:**
- **MISSION ACCOMPLISHED:** Celebrate, begin Series B prep
- **RECALIBRATE (60-79%):** Diagnose growth blockers, adjust 6-month plan
- **CRITICAL (<60%):** Board intervention, CEO/CTO performance review

---

## 6. RISK REGISTER

### Critical Risks (Immediate Action Required)

| ID | Risk | Impact | Probability | Owner | Mitigation | Trigger |
|----|------|--------|-------------|-------|------------|---------|
| R1 | Market doesn't value AI proposals | Critical | Medium | CEO | Pre-sell to 10 anchor customers before building | < 3 paid pilots by Week 6 |
| R2 | Run out of runway before PMF | Critical | Medium | CEO | Raise bridge round early, reduce burn if needed | Cash < 6 months at any gate |
| R3 | Video quality < 80% score | High | Medium | CTO | HeyGen + D-ID parallel testing, fallback to human-in-loop | Quality score < 70% at Week 10 |

### High Priority Risks

| ID | Risk | Impact | Probability | Owner | Mitigation | Trigger |
|----|------|--------|-------------|-------|------------|---------|
| R4 | Competitor launches similar product | High | High | CEO | Focus on SEA penetration, build network effects | Competitor funding announced |
| R5 | Cannot achieve target CAC | High | Medium | CMO | Double down on content, build referral engine | CAC > $1,500 at Q3 end |
| R6 | Key engineer departure | High | Low | CTO | Document systems, cross-train team | Resignation notice |

### Medium Priority Risks

| ID | Risk | Impact | Probability | Owner | Mitigation | Trigger |
|----|------|--------|-------------|-------|------------|---------|
| R7 | Customer churn > 10%/month | High | Low | CS Lead | Weekly check-ins, usage analytics, proactive outreach | Churn > 8% for 2 consecutive months |
| R8 | AI quality/regulatory issues | Medium | Low | CTO | Human-in-loop review, model audits | Customer complaint or legal notice |
| R9 | Sales cycle extends beyond 60 days | Medium | Medium | CRO | Implement PLG motion, self-serve tier | Avg cycle > 50 days at Q3 |
| R10 | Infrastructure doesn't scale | Medium | Low | CTO | Load testing quarterly, auto-scaling | Uptime < 99.5% in any month |

---

## 7. SUCCESS METRICS DASHBOARD

### Weekly Tracking (Leadership Team)

| Metric | Current | Target | Trend | Owner |
|--------|---------|--------|-------|-------|
| MRR | $0 | See monthly targets | 📈 | CEO |
| Active Customers | 0 | See sprint targets | 📈 | CRO |
| Proposal Win Rate Lift | — | > 40% | 📈 | CPO |
| Video Quality Score | — | > 80% | 📈 | CTO |
| Burn Rate | $0 | $40K/mo (Q2) | 📉 | CFO |
| Runway (months) | — | > 12 | 📈 | CEO |

### Monthly OKR Grading

| Quarter | Objective | Grade (0-1) | Status |
|---------|-----------|-------------|--------|
| Q2 2026 | Market Validation | ☐ Pending | 🔴 Not Started |
| Q3 2026 | Early Traction | ☐ Pending | 🔴 Not Started |
| Q4 2026 | Product-Market Fit | ☐ Pending | 🔴 Not Started |
| Q1 2027 | Scale Phase 1 | ☐ Pending | 🔴 Not Started |
| Q2 2027 | $1M ARR | ☐ Pending | 🔴 Not Started |

---

## 8. UNRESOLVED QUESTIONS

1. **Video Provider Final Decision:** HeyGen (quality) vs D-ID (cost) vs self-hosted (control)? Decision needed by Week 5.

2. **Database Region Strategy:** Supabase Singapore for SEA latency, or multi-region for redundancy? Trade-off: ~50ms latency vs 99.99% uptime SLA.

3. **CRM Priority:** HubSpot first (mid-market) or Pipedrive (small agencies)? Decision impacts ICP focus.

4. **Polar.sh SEA Payment Methods:** Does Polar.sh support GrabPay, GoPay, PromptPay for local SEA customers? If not, need Stripe fallback.

5. **AI Model Fine-tuning Timeline:** Fine-tune open-source models vs continue Claude API? Cost-benefit analysis needed at $50K MRR milestone.

6. **Series A Timing:** Raise at Gate 3 ($25K MRR) or Gate 4 ($500K ARR)? Earlier = more dilution, later = more risk.

7. **First Market After Singapore:** Vietnam (founder familiarity) or Thailand (larger TAM)? Decision impacts Q4 2026 expansion.

---

*Document Version: 1.0.0*
*Created: 2026-03-19*
*Next Review: 2026-03-26 (Sprint 1 Planning)*
*Owner: CEO / CTO*
*Distribution: Leadership Team, Board*
