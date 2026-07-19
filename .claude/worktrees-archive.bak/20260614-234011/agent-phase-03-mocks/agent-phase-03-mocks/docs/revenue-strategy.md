# Revenue Strategy — Sophia AI Factory

**Date:** 2026-06-03  
**Gate:** 4 — First Revenue  
**Stage:** Zero → Problem-Solution Fit → First Revenue

---

## 1. Revenue Model Overview

### Primary Revenue: Subscription + Usage Metering

Sophia operates on a **B2B SaaS + RaaS** (Robot-as-a-Service) model:

- **Subscription Tiers**: BASIC ($199), PREMIUM ($399), ENTERPRISE ($799), MASTER ($4,999)
- **Usage Metering**: MCU (Mission Credit Unit) — prevents abuse, enables overage
- **BYOK Platform Fee**: Customers bring their own API keys (HeyGen, ElevenLabs, MuAPI)
- **Crypto Payments**: NOWPayments (USDT) for global, PayOS (VND) for domestic

### Revenue Projections

| Period | MRR Target | Customers | Assumptions |
|--------|-----------|-----------|-------------|
| Month 1-2 | $0 | 0 | Building pipeline |
| Month 3 | $199 | 1 | First BASIC customer |
| Month 4 | $598 | 3 | +2 BASIC |
| Month 5 | $997 | 5 | +1 BASIC +1 PREMIUM |
| Month 6 | $1,995 | 10 | 7 BASIC + 2 PREMIUM + 1 ENTERPRISE |
| Q2 2026 Target | $5,000 | 15 | 10 BASIC + 3 PREMIUM + 2 ENTERPRISE |

---

## 2. First Revenue Path: Immediate Actions

### Phase A: Warm Lead Conversion (Weeks 1-2)

**Goal**: Close first paying customer from identified warm leads

**Target**: 3–5 Vietnamese marketing agencies or content creators

**Process**:
1. **Day 1-3**: Personal Telegram/Zoom demo for each lead
   - Show full pipeline: signup → BYOK → first video → download
   - Offer BASIC tier ($199) with 1-month free support
2. **Day 4-7**: Follow up with demo recording + pricing sheet
3. **Day 8-14**: Close payment via NOWPayments (USDT) or PayOS (VND)

**Success Criteria**: 1 customer paid and active

### Phase B: Channel Launch (Weeks 3-4)

**Goal**: Automated acquisition channels live

| Channel | Action | Owner | Timeline |
|---------|--------|-------|----------|
| **Landing Page** | `/pricing` route with pricing table + CTA | CTO | Week 3 |
| **Affiliate Program** | `/affiliates` page + 30% commission tracking | CTO | Week 3-4 |
| **Content SEO** | 5 VN articles published on `/blog/*` | CSO | Week 4 |
| **Telegram Outreach** | 3 DMs/day to creator niche | Sales | Ongoing |

### Phase C: Scale (Month 2+)

| Metric | Target | Method |
|--------|--------|--------|
| Weekly signups | 20+ | SEO + affiliates + outreach |
| Trial → Paid | 20% conversion | Email automation + Telegram bot |
| MRR growth | 50% MoM | Referral loop + content marketing |

---

## 3. Acquisition Channels Detail

### Channel 1: Direct Sales (Primary)

- **Approach**: Personal demo + 1-month free support
- **Volume**: 3–5 leads/week
- **Conversion**: 20–30% (high-touch)
- **Cost**: $0 (founder time)
- **Status**: READY — leads identified

### Channel 2: Affiliate Program

- **Commission**: 30% recurring for 12 months
- **Payout**: Monthly via NOWPayments mass-send
- **Target Affiliates**: VN marketing influencers, tech reviewers
- **Volume**: 10–50 affiliates
- **Conversion**: 5–10% of referred traffic
- **Status**: PLANNED — infrastructure code ready

### Channel 3: Content/SEO

- **Articles**: 5 VN + 5 EN long-form
- **Topics**: BYOK setup, ROI calculator, Telegram bot FSM, refund policy, agency scaling
- **Distribution**: `/blog/*` with sitemap + JSON-LD
- **CTA**: "Try Sophia free" → `/signup?ref=blog-<slug>`
- **Traffic Target**: 500/month within 60 days
- **Status**: PLANNED — content framework ready

### Channel 4: Telegram Creator Outreach

- **Volume**: 3 DMs/day, capped at 20/week
- **Template**: Bilingual, 80 words max, 1 link
- **Tracking**: `?ref=outreach-tg-<creator>` codes
- **Status**: PLANNED — DM template ready

---

## 4. Revenue Tracking & Metrics

### Key Metrics Dashboard

| Metric | Target (Q2) | Current | Gap |
|--------|-------------|---------|-----|
| MRR | $5,000 | $0 | $5,000 |
| Paying Customers | 15 | 0 | 15 |
| Trial Signups | 50/mo | 0 | 50/mo |
| Trial → Paid | 20% | 0% | 20% |
| Affiliate Commissions | $500/mo | $0 | $500/mo |
| Blog Traffic | 500/mo | 0 | 500/mo |

### Revenue Events to Track

1. `payment_success` — customer completed checkout
2. `tier_upgrade` — customer moved to higher tier
3. `tier_downgrade` — customer moved to lower tier
3. `churn` — customer canceled
4. `affiliate_commission` — affiliate earned commission
5. `trial_start` — free trial initiated

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| No first customer in 30 days | Medium | High | Expand outreach to 10 DMs/day, lower BASIC price to $99 for first 3 |
| BYOK complexity scares users | Medium | Medium | Pre-configured API keys for BASIC tier (subsidized) |
| Payment friction (crypto unfamiliar) | High | Medium | Add PayOS VND as primary, NOWPayments as secondary |
| Competitor undercuts price | Low | Medium | Emphasize BYOK + Vietnamese localization as moat |
| Single founder dependency | High | High | AI agent delegation (CTO role automated) |

---

## 6. First Revenue Milestone Definition

**Gate 4 (first-revenue) is achieved when ALL of the following are true:**

1. ✅ `.mekong/tasks/01-first-paying-customer.md` — mission complete
2. ✅ At least 1 customer has completed payment (NOWPayments or PayOS)
3. ✅ Customer has active subscription tier (not trial)
4. ✅ Customer has generated at least 1 AI video on platform
5. ✅ IPN/webhook confirmed payment success
6. ✅ Revenue visible in payment dashboard

**Estimated Time to Gate 4**: 2–4 weeks from now (2026-06-03)

---

## 7. Immediate Actions (Next 7 Days)

| Day | Action | Owner |
|-----|--------|-------|
| Day 1 | Identify 3–5 additional warm leads | Founder |
| Day 2 | Personal Telegram DM to all leads | Founder |
| Day 3 | Schedule Zoom demos (2–3 this week) | Founder |
| Day 4 | Deploy `/pricing` route with Stripe/NOWPayments | CTO |
| Day 5 | Run first demo, record session | Founder |
| Day 6 | Send demo recording + pricing to all leads | Founder |
| Day 7 | Follow up, offer 20% discount for first 3 customers | Founder |

---

*Generated: 2026-06-03*  
*Source: Phase 5 Cook Pipeline — Steps 1, 2, 3*
