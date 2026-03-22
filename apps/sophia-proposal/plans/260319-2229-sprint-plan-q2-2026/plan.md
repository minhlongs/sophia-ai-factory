---
title: "Sophia AI Factory — Sprint Plan Q2 2026 (Market Validation)"
description: "6-week sprint plan to achieve $5K MRR with 10 paid pilots"
company: Sophia AI Factory
phase: Market Validation (Phase 1)
target: $5K MRR by 2026-06-30
created: 2026-03-19
owner: CTO / OpenClaw
review_cycle: Bi-weekly sprint reviews
---

# SOPHIA AI FACTORY — SPRINT PLAN Q2 2026

## Executive Summary

**North Star:** $1M ARR by Q2 2027
**Current Phase:** Market Validation (Q2 2026)
**Sprint Goal:** 10 paid pilots at $499/mo = $5K MRR
**Timeline:** 6 weeks (3 sprints × 2 weeks)

### Critical Path

```
Week 1-2: Auth + Onboarding ──┬──► Week 3-4: AI Proposal ──┬──► Week 5-6: Polar Billing
                              │                             │
                              ▼                             ▼
                        Users can signup              First $499 payment
```

---

## Sprint Overview

| Sprint | Dates | Focus | Target MRR | Status | Go/No-Go Criteria |
|--------|-------|-------|------------|--------|-------------------|
| **S1** | W1-2 | Auth + Onboarding + Polar Setup | $0 | ✅ Done | Users can self-serve signup |
| **S2** | W3-4 | AI Proposal Text Engine | $0 | ✅ Done | Generate proposal <30s, 80%+ quality |
| **S3** | W5-6 | Polar Billing + First Payment | $500+ | ✅ Done | First $499 payment processed |

---

## Dependencies & Risks

### External Dependencies

| Dependency | Owner | Deadline | Impact if Delayed |
|------------|-------|----------|-------------------|
| Supabase project setup | CTO | Week 1 Day 1 | Blocks all auth |
| Polar.sh account approval | CEO | Week 1 Day 3 | Blocks billing |
| Claude API access | CTO | Week 2 Day 1 | Blocks AI proposal |
| HeyGen/D-ID API key | CTO | Week 4 Day 1 | Blocks video phase |

### Critical Risks

| Risk | Probability | Impact | Mitigation | Trigger |
|------|-------------|--------|------------|---------|
| Polar.sh doesn't support SEA payments | Medium | High | Stripe fallback research | Week 3 |
| Auth implementation takes >1 week | Low | High | Supabase Auth (managed) | Day 5 |
| AI proposal quality <80% | Medium | Critical | Human-in-loop review | Week 4 |
| Cannot recruit 10 pilot customers | Medium | Critical | Incentivize with $100 credits | Week 5 |

---

## Definition of Done (Per Sprint)

### Sprint 1 (Week 1-2)

- [ ] Supabase Auth working (email/password + MFA)
- [ ] Organization creation flow complete
- [ ] Welcome email sequence configured
- [ ] Polar.sh products configured (4 tiers)
- [ ] Webhook endpoint ready for billing events

### Sprint 2 (Week 3-4)

- [ ] AI proposal generation <30s
- [ ] PDF export working
- [ ] 5+ proposal templates created
- [ ] Quality score >80% on test proposals
- [ ] Proposal history dashboard complete

### Sprint 3 (Week 5-6)

- [ ] Polar checkout flow tested end-to-end
- [ ] Webhook → MCU credit sync working
- [ ] First $499 payment processed
- [ ] NPS survey sent to 10 pilot users
- [ ] 3+ case studies documented

---

## Unresolved Questions

1. **Polar.sh SEA Payment Coverage:** Does Polar.sh support GrabPay, GoPay, PromptPay for Indonesia/Thailand/Philippines?
2. **Video Provider Decision:** HeyGen (quality) vs D-ID (cost) — decision needed Week 5 for Phase 2.
3. **CRM Priority:** HubSpot (mid-market) vs Pipedrive (small agencies) — impacts ICP focus.
4. **Database Region:** Supabase Singapore for SEA latency, or multi-region for redundancy?
5. **Pilot Recruitment:** How to recruit 10 paid pilots — inbound leads vs outbound sales?

---

## Reference Documents

- Strategy: `../../reports/studio/strategy/SUMMARY.md`
- Execution Plan: `../../reports/studio/strategy/execution-plan.md`
- Technical Roadmap: `../../reports/studio/strategy/technical-roadmap.md`

---

_Phase Files:_
- `sprint-01-auth-onboarding.md` (Week 1-2)
- `sprint-02-ai-proposal-engine.md` (Week 3-4)
- `sprint-03-polar-billing.md` (Week 5-6)

_Document Version: 1.0.0_
_Created: 2026-03-19_
_Next Review: 2026-03-26 (Sprint 1 Retro)_
_Owner: CTO / OpenClaw_
