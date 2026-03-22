# Product Sprint Plan — Sophia AI Factory Market Validation (Q2 2026)

**Date:** 2026-03-19
**Sprint Lead:** CTO / OpenClaw
**Company:** Sophia AI Factory
**Stage:** Market Validation (Phase 1)
**Target:** $5K MRR by 2026-06-30

---

## Executive Summary

**North Star:** $1M ARR by Q2 2027
**Current Phase:** Market Validation (Q2 2026)
**Sprint Goal:** 10 paid pilots at $499/mo = $5K MRR
**Timeline:** 6 weeks (3 sprints x 2 weeks)

### Critical Path

```
Week 1-2: Auth + Onboarding ──┬──► Week 3-4: AI Proposal ──┬──► Week 5-6: Polar Billing
                              │                             │
                              ▼                             ▼
                        Users can signup              First $499 payment
```

### Go/No-Go Gate (2026-06-30)

| Outcome | Decision |
|---------|----------|
| 10 paid pilots | GO to Phase 2 |
| 5-9 pilots | PIVOT (adjust pricing/ICP) |
| 0-4 pilots | STOP (market doesn't value) |

---

## Sprint-by-Sprint Breakdown

### Sprint 1: Auth + Onboarding + Polar Setup (Week 1-2)

**Owner:** CTO / Full-stack Engineer
**Target:** Users can self-serve signup without manual intervention

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US1.1 | As a user, I can sign up with email/password | Signup form validates, creates user in Supabase |
| US1.2 | As a user, I can login with magic link | Magic link sent via email, logs me in on click |
| US1.3 | As a user, I can create my organization | Onboarding wizard captures name, slug, industry |
| US1.4 | As an admin, I can invite team members | Invite sent, new user joins org with role |
| US1.5 | As a user, I can view pricing tiers | 4 Polar products displayed with features |

#### Technical Tasks

- [ ] Create Supabase project (Singapore region)
- [ ] Configure auth providers (email, magic link, MFA)
- [ ] Run migrations: organizations, org_members, subscriptions
- [ ] Enable RLS policies for org isolation
- [ ] Build signup, login, onboarding pages
- [ ] Implement auth context + protected routes
- [ ] Create Polar.sh account + 4 products
- [ ] Build webhook handler for subscription events
- [ ] Build basic dashboard with org context

#### Definition of Done

- [ ] Supabase Auth working (email/password + MFA)
- [ ] Organization creation flow complete
- [ ] Welcome email sequence configured
- [ ] Polar.sh products configured (4 tiers)
- [ ] Webhook endpoint ready for billing events

---

### Sprint 2: AI Proposal Text Engine (Week 3-4)

**Owner:** CTO / AI Engineer
**Target:** Generate proposal in <30s with 80%+ quality score

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US2.1 | As a user, I can input client details | Form captures client name, industry, pain points |
| US2.2 | As a user, I can select a template | 3 templates available (Agency, SaaS, Ecommerce) |
| US2.3 | As a user, AI generates my proposal | Full proposal generated in <30s |
| US2.4 | As a user, I can edit generated content | Rich text editor per section, regenerate any section |
| US2.5 | As a user, I can export to PDF | Professional PDF downloaded with branding |

#### Technical Tasks

- [ ] Research winning proposal structures (50+ samples)
- [ ] Define prompt templates per industry
- [ ] Build prompt builder with variable injection
- [ ] Create proposals, proposal_sections tables
- [ ] Build CRUD endpoints for proposals
- [ ] Implement /generate endpoint with Claude API
- [ ] Add rate limiting (10 gen/hour per org)
- [ ] Build proposal editor with section-level editing
- [ ] Integrate PDF generation (react-pdf or puppeteer)
- [ ] Implement quality scoring system

#### Definition of Done

- [ ] AI proposal generation <30s
- [ ] PDF export working
- [ ] 5+ proposal templates created
- [ ] Quality score >80% on test proposals
- [ ] Proposal history dashboard complete

---

### Sprint 3: Polar Billing + Pilot Onboarding (Week 5-6)

**Owner:** CTO / CEO
**Target:** First $499 payment processed, 10 pilot users onboarded

#### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US3.1 | As a user, I can subscribe via Polar | Checkout flow completes, subscription active |
| US3.2 | As a user, my MCU credits are added | Balance updated immediately after payment |
| US3.3 | As a user, I can see my usage | Usage history shows MCU consumption |
| US3.4 | As a system, I block usage at zero balance | HTTP 402 returned, prompt to add credits |
| US3.5 | As a pilot, I receive onboarding support | 30-min call, case study template, NPS survey |

#### Technical Tasks

- [ ] Create Polar.sh products (Starter/Growth/Premium/Master)
- [ ] Build /api/billing/checkout endpoint
- [ ] Implement webhook signature verification
- [ ] Handle subscription.created, order.paid events
- [ ] Credit MCU balance on payment
- [ ] Implement usage tracking + MCU deduction
- [ ] Add balance check middleware
- [ ] Build billing dashboard + usage view
- [ ] Create pilot onboarding flow
- [ ] Set up NPS survey (7-day trigger)

#### Definition of Done

- [ ] Polar checkout flow tested end-to-end
- [ ] Webhook to MCU credit sync working
- [ ] First $499 payment processed
- [ ] NPS survey sent to 10 pilot users
- [ ] 3+ case studies documented

---

## Dependencies

### External Dependencies

| Dependency | Owner | Deadline | Impact if Delayed |
|------------|-------|----------|-------------------|
| Supabase project setup | CTO | Week 1 Day 1 | Blocks all auth |
| Polar.sh account approval | CEO | Week 1 Day 3 | Blocks billing |
| Claude API access | CTO | Week 2 Day 1 | Blocks AI proposal |
| HeyGen/D-ID API key | CTO | Week 4 Day 1 | Blocks video phase |

### Internal Dependencies

```
Sprint 1 (Auth) ──► Sprint 2 (AI Proposal) ──► Sprint 3 (Billing)
       │                      │                        │
       ▼                      ▼                        ▼
  User accounts         Content generated       Revenue validated
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation | Trigger |
|------|-------------|--------|------------|---------|
| Polar.sh doesn't support SEA | Medium | Critical | Stripe fallback research | Week 3 |
| AI quality <80% | Medium | Critical | Human-in-loop review | Week 4 |
| Cannot recruit 10 pilots | Medium | Critical | Incentivize with $100 credits | Week 5 |
| Auth delays cascade | Low | High | Use managed Supabase Auth | Day 5 |

---

## Success Metrics Dashboard

| Metric | Current | S1 Target | S2 Target | S3 Target |
|--------|---------|-----------|-----------|-----------|
| Active Users | 0 | 50 signups | 100 signups | 150 signups |
| Proposals Generated | 0 | 0 | 50 | 200 |
| Paid Pilots | 0 | 0 | 0 | 10 |
| MRR | $0 | $0 | $0 | $5K |
| Quality Score | - | - | >80% | >85% |
| NPS | - | - | - | >30 |

---

## Unresolved Questions

1. **Polar.sh SEA Payment Coverage:** Does Polar.sh support GrabPay, GoPay, PromptPay for Indonesia/Thailand/Philippines?
2. **Video Provider Decision:** HeyGen (quality) vs D-ID (cost) - decision needed Week 5 for Phase 2.
3. **CRM Priority:** HubSpot (mid-market) vs Pipedrive (small agencies) - impacts ICP focus.
4. **Database Region:** Supabase Singapore for SEA latency, or multi-region for redundancy?
5. **Pilot Recruitment:** How to recruit 10 paid pilots - inbound leads vs outbound sales?

---

## Reference Documents

- Strategy: `reports/studio/strategy/SUMMARY.md`
- Execution Plan: `reports/studio/strategy/execution-plan.md`
- Technical Roadmap: `reports/studio/strategy/technical-roadmap.md`

---

## Plan Location

All sprint plans saved to:
`/Users/macbook/mekong-cli/apps/sophia-proposal/plans/260319-2229-sprint-plan-q2-2026/`

### Files Created

| File | Description |
|------|-------------|
| `plan.md` | Overview plan with sprint summary |
| `sprint-01-auth-onboarding.md` | Sprint 1 detailed plan (Week 1-2) |
| `sprint-02-ai-proposal-engine.md` | Sprint 2 detailed plan (Week 3-4) |
| `sprint-03-polar-billing.md` | Sprint 3 detailed plan (Week 5-6) |

---

**Document Version:** 1.0.0
**Created:** 2026-03-19
**Next Review:** 2026-03-26 (Sprint 1 Planning)
**Owner:** CTO / OpenClaw
