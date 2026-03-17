# Sales Pipeline Tracking System — Sophia AI Video Factory

**Generated:** 2026-03-17
**Version:** 1.0
**Owner:** Sales/Revenue Team
**Input:** Customer Research (3 personas) + Lead Gen Strategy (9 channels)

---

## Executive Summary

### Pipeline Architecture Overview

| Component | Description | Target |
|-----------|-------------|--------|
| **Pipeline Stages** | 7 stages from Prospect → Closed Won/Lost | Standardized qualification |
| **Velocity Metrics** | Opportunities × Win Rate × ACV / Cycle Length | Predictable revenue |
| **Lead Scoring** | 100-point scale (firmographic + behavioral) | Prioritized outreach |
| **Forecasting** | Weighted pipeline with 3 scenarios | 90%+ accuracy |
| **Sales Activities** | Playbooks per stage per persona | Consistent execution |
| **CRM Automation** | Required fields + triggers | Zero manual entry |

### Segment Alignment (from Customer Research)

| Segment | Share | ARPU | Sales Cycle | Primary Channel |
|---------|-------|------|-------------|-----------------|
| **Agencies (5-50)** | 45% | $199-499/mo | 1-3 days | LinkedIn Outreach |
| **SMEs (Ecom, SaaS)** | 35% | $49-199/mo | 1-2 weeks | Content + Paid Ads |
| **Enterprise (500+)** | 20% | $499-999+/mo | 3-5 months | Direct Sales + POC |

---

## 1. Pipeline Stages Definition

### 1.1 Stage Framework

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SOPHIA AI FACTORY SALES PIPELINE                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PROSPECT → QUALIFIED → DEMO → PROPOSAL → NEGOTIATION → CLOSED          │
│     │          │         │          │            │           │          │
│     │          │         │          │            │           │          │
│   Cold      MQL/      Live       Sent         Terms       Won/Lost     │
│   Lead      SQL      Demo      Proposal    Discussion                  │
│                                                                         │
│  Conversion: 100% → 60% → 40% → 25% → 15% → 8% (overall win rate)      │
│  Time:       -      → 2d   → 5d    → 7d      → 10d      → Close        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stage Details by Segment

#### STAGE 1: PROSPECT

| Attribute | Definition |
|-----------|------------|
| **Description** | Any lead that has entered the system |
| **Entry Criteria** | • Form fill (website, landing page) <br> • Inbound email/call <br> • LinkedIn connection accepted <br> • Event attendee list <br> • Cold email reply (positive) |
| **Exit Criteria** | • Lead score ≥ 30 <br> • Basic BANT confirmed (Budget, Authority, Need, Timeline) <br> • Responded to initial outreach |
| **Conversion Rate** | 100% → 60% (40% disqualified) |
| **Avg Time in Stage** | 1-3 days (Agencies/SMEs), 1-2 weeks (Enterprise) |
| **Owner** | SDR / Marketing Automation |

**Disqualification Criteria (Stage 1):**
- ❌ Lead score < 10 (not ICP fit)
- ❌ No response after 7 touches
- ❌ Explicitly not interested
- ❌ Competitor/Spam

---

#### STAGE 2: QUALIFIED (MQL/SQL)

| Attribute | Definition |
|-----------|------------|
| **Description** | Lead has shown intent + meets ICP criteria |
| **Entry Criteria** | • Lead score ≥ 50 (MQL) or ≥ 70 (SQL) <br> • BANT confirmed: Budget exists, Decision maker identified, Pain verified, Timeline < 90 days <br> • Engaged with content (downloaded, attended webinar) |
| **Exit Criteria** | • Demo scheduled and confirmed <br> • Discovery call completed <br> • Mutual action plan created |
| **Conversion Rate** | 60% → 40% (33% drop-off) |
| **Avg Time in Stage** | 2-5 days (Agencies/SMEs), 1-3 weeks (Enterprise) |
| **Owner** | SDR → AE Handoff |

**BANT Qualification Framework:**

| Criteria | Agency | SME | Enterprise |
|----------|--------|-----|------------|
| **Budget** | $500-2K/mo video spend confirmed | $100-500/mo marketing budget | $5K-20K/mo department budget |
| **Authority** | Owner/Director is decision maker | Marketing Manager + Founder approval | Committee (CMO + CTO + Procurement) |
| **Need** | 20+ videos/month, capacity crunch | Daily content demand, agency bottleneck | Training/comms rollout, remote work |
| **Timeline** | "Starting this month" | "Within 30 days" | "Q2/Q3 initiative" |

---

#### STAGE 3: DEMO

| Attribute | Definition |
|-----------|------------|
| **Description** | Live product demonstration scheduled/completed |
| **Entry Criteria** | • Demo booked (Calendly link) <br> • Discovery call completed <br> • Use case identified <br> • Stakeholders confirmed attending |
| **Exit Criteria** | • Demo completed successfully <br> • Technical requirements confirmed <br> • Next steps agreed (trial, POC, proposal) <br> • Champion identified |
| **Conversion Rate** | 40% → 25% (37.5% drop-off) |
| **Avg Time in Stage** | 3-7 days (scheduling + demo + follow-up) |
| **Owner** | Account Executive (AE) |

**Demo Success Criteria:**
- ✅ Customer articulates pain in their own words
- ✅ Demo uses THEIR data/use case (not generic)
- ✅ All stakeholders present (or recording shared)
- ✅ Clear next step scheduled before call ends
- ✅ Trial/POC started within 24 hours

---

#### STAGE 4: PROPOSAL

| Attribute | Definition |
|-----------|------------|
| **Description** | Formal proposal/quote sent to prospect |
| **Entry Criteria** | • Demo/trial completed successfully <br> • Use case + ROI quantified <br> • Pricing tier selected <br> • Proposal template customized |
| **Exit Criteria** | • Proposal received by all stakeholders <br> • Proposal walkthrough completed <br> • Objections surfaced and addressed <br> • Verbal commitment to timeline |
| **Conversion Rate** | 25% → 15% (40% drop-off) |
| **Avg Time in Stage** | 5-10 days (varies by segment) |
| **Owner** | Account Executive (AE) |

**Proposal Components:**
- Executive summary (1 page)
- Current state analysis (pain quantified)
- Proposed solution (tier selected)
- ROI calculation (payback period)
- Implementation timeline
- Pricing + contract terms
- Case studies (social proof)
- Next steps + mutual action plan

---

#### STAGE 5: NEGOTIATION

| Attribute | Definition |
|-----------|------------|
| **Description** | Contract terms, pricing, legal review |
| **Entry Criteria** | • Proposal accepted in principle <br> • Procurement/legal engaged <br> • Pricing/terms discussion started <br> • Redlines received |
| **Exit Criteria** | • All terms agreed <br> • Contract signed by both parties <br> • Payment processed <br> • Onboarding scheduled |
| **Conversion Rate** | 15% → 8% (47% drop-off) |
| **Avg Time in Stage** | 7-14 days (Agencies/SMEs), 4-8 weeks (Enterprise) |
| **Owner** | Account Executive + Legal |

**Negotiation Levers:**

| Lever | Agency | SME | Enterprise |
|-------|--------|-----|------------|
| **Price Discount** | 10% max (annual prepay) | 5% max (annual only) | 15-20% (multi-year) |
| **Payment Terms** | Monthly/Quarterly | Monthly only | Annual/Net-30 |
| **Contract Length** | 6-12 months | 12 months | 24-36 months |
| **Add-ons** | White-label, API access | Brand kit, templates | SSO, SLA, dedicated support |

---

#### STAGE 6: CLOSED WON

| Attribute | Definition |
|-----------|------------|
| **Description** | Contract signed, payment processed |
| **Entry Criteria** | • Fully executed contract <br> • First payment received <br> • Account setup in Polar.sh |
| **Exit Criteria** | • Onboarding completed <br> • First video created <br> • CSM handoff done <br> • 30-day check-in scheduled |
| **Conversion Rate** | 8% overall win rate (from Prospect) |
| **Avg Time to Close** | 7-14 days (Agencies), 14-30 days (SMEs), 60-120 days (Enterprise) |
| **Owner** | Customer Success Manager (CSM) |

**Closed Won Handoff Checklist:**
- [ ] Welcome email sent (automated)
- [ ] Account created + credentials shared
- [ ] Onboarding call scheduled (Day 1-3)
- [ ] Success plan created (Day 7)
- [ ] First video published (Day 14)
- [ ] 30-day business review (Day 30)

---

#### STAGE 7: CLOSED LOST

| Attribute | Definition |
|-----------|------------|
| **Description** | Deal lost to competitor, budget, timing |
| **Entry Criteria** | • Prospect explicitly declines <br> • Ghosted after 14 days <br> • Chose competitor <br> • Budget cut/frozen |
| **Exit Criteria** | • Loss reason documented <br> • Feedback captured <br> • Nurturing sequence enrolled <br> • Re-engagement date set |
| **Conversion Rate** | N/A (terminal stage) |
| **Owner** | Account Executive |

**Loss Reason Categories:**

| Reason | % of Losses | Recovery Strategy |
|--------|-------------|-------------------|
| **No Decision** | 35% | Nurture sequence (monthly check-ins) |
| **Competitor** | 25% | Competitive battlecard update |
| **Budget** | 20% | Re-engage in 90 days (budget cycle) |
| **Timing** | 15% | Quarterly check-in |
| **Features** | 5% | Product roadmap notification |

---

### 1.3 SaaS Benchmark Comparison

| Metric | Sophia Target | SaaS Industry Avg | Top Quartile |
|--------|---------------|-------------------|--------------|
| **Overall Win Rate** | 8% | 5-10% | 15%+ |
| **Stage 1→2 (Prospect→Qualified)** | 60% | 50-60% | 70%+ |
| **Stage 2→3 (Qualified→Demo)** | 67% | 60-70% | 80%+ |
| **Stage 3→4 (Demo→Proposal)** | 62.5% | 50-60% | 75%+ |
| **Stage 4→5 (Proposal→Negotiation)** | 60% | 50-60% | 70%+ |
| **Stage 5→6 (Negotiation→Won)** | 53% | 50-60% | 65%+ |
| **Avg Sales Cycle** | 14-45 days | 30-90 days | 15-30 days |

---

## 2. Pipeline Velocity Metrics

### 2.1 Velocity Formula

```
┌─────────────────────────────────────────────────────────┐
│  PIPELINE VELOCITY FORMULA                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         (Opportunities × Win Rate × ACV)                │
│  Velocity = ─────────────────────────────────────       │
│              Sales Cycle Length (days)                  │
│                                                         │
│  Example (Agencies):                                    │
│         (100 opps × 8% × $4,788) / 14 days              │
│       = $38,304 / 14 = $2,736/day = $82K/month          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Target Velocity by Segment

| Segment | Opportunities | Win Rate | ACV | Cycle (days) | Velocity/Day | Velocity/Month |
|---------|---------------|----------|-----|--------------|--------------|----------------|
| **Agencies** | 100 | 8% | $4,788 ($399/mo × 12) | 14 | $2,736 | $82,080 |
| **SMEs** | 200 | 6% | $1,188 ($99/mo × 12) | 21 | $679 | $20,370 |
| **Enterprise** | 30 | 12% | $12,000 ($1K/mo × 12) | 90 | $480 | $14,400 |
| **Total** | 330 | 7.5% (weighted) | — | 35 (avg) | $3,895 | $116,850 |

**Assumptions:**
- Agency ACV: $399/mo (Premium tier average) × 12 months
- SME ACV: $99/mo (Growth tier average) × 12 months
- Enterprise ACV: $1,000/mo (Master tier) × 12 months
- Win rates based on SaaS benchmarks for PLG + sales-assisted

### 2.3 Bottleneck Detection Framework

```
┌─────────────────────────────────────────────────────────┐
│  BOTTLENECK DETECTION MATRIX                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SYMPTOM                          ROOT CAUSE            │
│  ─────────────────────────────────────────────────────  │
│  Low Prospect→Qualified (<50%)    → Lead quality issue │
│                                   → ICP mismatch        │
│                                   → SDR qualification   │
│                                                         │
│  Low Qualified→Demo (<60%)        → Demo scarcity       │
│                                   → AE availability     │
│                                   → Scheduling friction │
│                                                         │
│  Low Demo→Proposal (<50%)         → Demo quality issue  │
│                                   → Wrong stakeholders  │
│                                   → No clear next step  │
│                                                         │
│  Low Proposal→Negotiation (<50%)  → Pricing objection    │
│                                   → Competitor win      │
│                                   → No urgency created  │
│                                                         │
│  Low Negotiation→Won (<50%)       → Legal/procurement   │
│                                   → Budget freeze       │
│                                   → Champion churn      │
│                                                         │
│  Long Sales Cycle (>target)       → Too many approvers  │
│                                   → POC dragging        │
│                                   → Decision criteria   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Velocity Improvement Levers

| Lever | Agency Impact | SME Impact | Enterprise Impact |
|-------|---------------|------------|-------------------|
| **Increase Opportunities (+20%)** | +$16K/mo | +$4K/mo | +$3K/mo |
| **Improve Win Rate (+2pp)** | +$20K/mo | +$5K/mo | +$3K/mo |
| **Increase ACV (+10%)** | +$8K/mo | +$2K/mo | +$1.5K/mo |
| **Shorten Cycle (-20%)** | +$20K/mo | +$5K/mo | +$4K/mo |

**Priority by Segment:**
- **Agencies:** Shorten cycle (self-serve flow) + improve win rate (demo quality)
- **SMEs:** Increase opportunities (content scale) + shorten cycle (automation)
- **Enterprise:** Improve win rate (POC success) + increase ACV (expansion)

---

## 3. Lead Scoring Integration

### 3.1 Lead Score → Pipeline Stage Mapping

| Lead Score | Tier | Pipeline Stage | Action |
|------------|------|----------------|--------|
| **70-100** | 🔥 Priority (SQL) | Stage 2-3 (Qualified/Demo) | Call within 1 hour, AE assignment |
| **50-69** | 🟡 Hot (MQL) | Stage 1-2 (Prospect/Qualified) | Email sequence + retargeting ads |
| **30-49** | 🟠 Warm | Stage 1 (Prospect) | Newsletter + content drip |
| **10-29** | ⚪ Cold | Stage 1 (Prospect) or Disqualify | Monthly newsletter |
| **0-9** | ❌ Disqualified | Closed Lost | Remove from active pipeline |

### 3.2 Firmographic Scoring (40 points max)

| Attribute | Criteria | Points |
|-----------|----------|--------|
| **Company Size** | | |
| | 5-20 employees | +15 |
| | 21-100 employees | +20 |
| | 101-500 employees | +15 |
| | 500+ employees | +10 |
| **Industry** | | |
| | Video Production Agency | +20 |
| | Marketing/Advertising Agency | +18 |
| | E-commerce/D2C Brand | +15 |
| | SaaS/Tech Company | +12 |
| | Media/Entertainment | +10 |
| **Role/Title** | | |
| | Founder/CEO/Owner | +20 |
| | CMO/VP/Director | +18 |
| | Marketing Manager | +12 |
| | Content Manager/Producer | +10 |
| **Location** | | |
| | Singapore | +15 |
| | Vietnam (HCMC/Hanoi) | +12 |
| | Thailand/Indonesia/Philippines | +10 |
| | US/UK/AU | +15 |
| | Other | +5 |

### 3.3 Behavioral Scoring (40 points max)

| Action | Points | Decay |
|--------|--------|-------|
| **Website Activity** | | |
| | Visited pricing page | +15 | -5 after 30 days |
| | Visited integrations page | +10 | -5 after 30 days |
| | Downloaded case study | +12 | -5 after 45 days |
| | Used ROI calculator | +15 | -5 after 30 days |
| | Watched demo video (>50%) | +12 | -5 after 45 days |
| **Product Engagement** | | |
| | Started free trial | +25 | -15 after 14 days inactive |
| | Created first video | +15 | No decay |
| | Connected Shopify/integration | +20 | No decay |
| | Used bulk upload | +15 | No decay |
| | Shared video on social | +10 | No decay |
| **Communication** | | |
| | Opened 3+ emails | +8 | -5 after 30 days |
| | Clicked email link | +10 | -5 after 30 days |
| | Replied to email | +15 | No decay |
| | Booked demo call | +25 | No decay |
| | Attended webinar | +20 | No decay |
| | Responded to LinkedIn | +12 | No decay |

### 3.4 Timing/Urgency Scoring (20 points max)

| Signal | Points |
|--------|--------|
| **Timeline Indicators** | |
| | "Ready to start this month" | +20 |
| | "Evaluating in 1-3 months" | +10 |
| | "Just researching" | +5 |
| **Trigger Events** | |
| | Recent funding (Crunchbase) | +15 |
| | Hiring for video roles | +12 |
| | New product launch announced | +10 |
| | Competitor using video heavily | +8 |
| | Recent agency switch (LinkedIn) | +10 |

### 3.5 Disqualification Criteria (Automatic Score = 0)

| Criteria | Detection Method |
|----------|------------------|
| ❌ Not ICP (student, hobbyist, competitor) | Company size < 5, free email domain |
| ❌ No budget (explicitly states $0) | Discovery call notes |
| ❌ No authority (can't make decisions) | BANT qualification |
| ❌ No need (no video content demand) | Discovery call notes |
| ❌ Timeline > 12 months | Discovery call notes |
| ❌ Spam/fake contact | Email bounce, phone invalid |

### 3.6 Lead Scoring Automation Rules

| Trigger | Score Change | Action |
|---------|--------------|--------|
| Form submit (pricing page) | +15 | Create task: SDR call within 24h |
| Form submit (demo request) | +25 | Create task: AE call within 1h |
| Trial signup | +25 | Enroll in onboarding sequence |
| Trial inactive 7 days | -10 | Send re-engagement email |
| Trial inactive 14 days | -15 | Send "last chance" email |
| Demo attended | +20 | Create task: Proposal within 48h |
| Demo no-show | -10 | Reschedule + send recording |
| Proposal opened | +10 | Create task: Follow-up within 24h |
| Proposal unopened 7 days | -15 | Send "did you see this?" email |
| Email replied | +15 | Create task: Response within 4h |
| Email unsubscribed | -50 | Remove from sequences |

---

## 4. Forecasting Methodology

### 4.1 Weighted Pipeline by Stage

| Stage | Probability | Weight | Example Pipeline | Weighted Value |
|-------|-------------|--------|------------------|----------------|
| Stage 1: Prospect | 5% | 0.05 | $100,000 | $5,000 |
| Stage 2: Qualified | 15% | 0.15 | $60,000 | $9,000 |
| Stage 3: Demo | 30% | 0.30 | $40,000 | $12,000 |
| Stage 4: Proposal | 50% | 0.50 | $25,000 | $12,500 |
| Stage 5: Negotiation | 75% | 0.75 | $15,000 | $11,250 |
| **Total Weighted Pipeline** | — | — | **$240,000** | **$49,750** |

**Formula:** `Weighted Value = Deal Value × Stage Probability`

### 4.2 Forecast Scenarios

| Scenario | Calculation | Example (from above) |
|----------|-------------|----------------------|
| **COMMIT** (Conservative) | Stage 5 only × 90% close rate | $15,000 × 0.75 × 0.90 = $10,125 |
| **MOST LIKELY** (Expected) | Weighted pipeline total | $49,750 |
| **BEST CASE** (Aggressive) | Stage 4-5 at 100%, Stage 3 at 50% | $25K + $15K + ($40K × 0.50) = $60,000 |

### 4.3 Forecast Accuracy Tracking

| Metric | Formula | Target |
|--------|---------|--------|
| **Forecast Accuracy** | 1 - \|Actual - Forecast\| / Forecast | 90%+ |
| **Commit Accuracy** | Commit deals closed / Total commit | 85%+ |
| **Pipeline Coverage** | Total pipeline / Quota | 3-4x |
| **Slippage Rate** | Deals pushed to next quarter / Total | < 20% |

### 4.4 Confidence Intervals

| Historical Data Points | Confidence Level | Accuracy Range |
|------------------------|------------------|----------------|
| < 10 deals | Low | ±50% |
| 10-30 deals | Medium | ±30% |
| 30-100 deals | High | ±15% |
| 100+ deals | Very High | ±10% |

**Sophia Forecast Confidence (Month 1-3):** Low-Medium (limited historical data)
**Sophia Forecast Confidence (Month 4-6):** Medium-High (30+ deals closed)
**Sophia Forecast Confidence (Month 7+):** High (100+ deals closed)

### 4.5 Forecast Cadence

| Meeting | Cadence | Attendees | Purpose |
|---------|---------|-----------|---------|
| **Pipeline Review** | Weekly (30 min) | Sales team | Stage-by-stage review, commit updates |
| **Forecast Call** | Monthly (1 hour) | Sales + Leadership | Commit/MOST/BEST scenarios |
| **Quarterly Business Review** | Quarterly (2 hours) | All stakeholders | Pipeline health, velocity trends |

---

## 5. Sales Activities per Stage

### 5.1 Stage 1→2: Discovery Call Framework (30 minutes)

```
┌─────────────────────────────────────────────────────────┐
│  DISCOVERY CALL SCRIPT                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  WARM-UP (2 min)                                        │
│  "Thanks for taking the time. I'm researching how       │
│   teams like yours handle video production. There are   │
│   no right or wrong answers — I just want to learn      │
│   from your experience."                                │
│                                                         │
│  CONTEXT (5 min)                                        │
│  1. "Walk me through how your team produces videos      │
│      today."                                            │
│  2. "What's the hardest part about meeting video        │
│      demands?"                                          │
│  3. "Why is that hard?"                                 │
│                                                         │
│  PAIN DEEP-DIVE (10 min)                                │
│  4. "Tell me about the last time you had to rush a      │
│      video project."                                    │
│  5. "What did you do to meet the deadline?"             │
│  6. "What didn't you like about that solution?"         │
│  7. "How much time/money does video production cost     │
│      you monthly?"                                      │
│  8. "How often do you hit capacity limits?"             │
│                                                         │
│  SOLUTION EXPLORATION (5 min)                           │
│  9. "If you could wave a magic wand, what would ideal   │
│      video production look like?"                       │
│  10. "What tools have you tried that didn't work out?"  │
│                                                         │
│  COMMITMENT (3 min)                                     │
│  11. "Would you be open to trying a new solution if it  │
│      solved [specific pain]?"                           │
│  12. "Who else should I talk to about this?"            │
│  13. "Can I follow up with you in a few weeks?"         │
│                                                         │
│  QUALIFICATION (5 min) - BANT                           │
│  Budget: "What's your budget range for video tools?"    │
│  Authority: "Who makes the final decision on tools?"    │
│  Need: "What happens if you don't solve this?"          │
│  Timeline: "When do you need this implemented by?"      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Stage 2→3: Demo Best Practices

#### Pre-Demo Checklist

| Task | Owner | Timing |
|------|-------|--------|
| Send calendar invite with Zoom link | SDR | 2 days before |
| Send confirmation email + agenda | SDR | 1 day before |
| Research prospect (LinkedIn, website) | AE | 1 hour before |
| Prepare custom demo (their use case) | AE | 1 hour before |
| Test screen share + audio | AE | 15 min before |

#### Demo Structure (30 minutes)

| Section | Time | Content |
|---------|------|---------|
| **Intro + Agenda** | 2 min | Set expectations, confirm attendees |
| **Recap Pain Points** | 3 min | "You mentioned X, Y, Z challenges..." |
| **Live Demo (Core)** | 15 min | Show THEIR use case, not generic |
| **Q&A** | 5 min | Address objections, technical questions |
| **Next Steps** | 5 min | Trial start, proposal timeline |

#### Demo Do's and Don'ts

| Do | Don't |
|----|-------|
| ✅ Use THEIR data/brand in demo | ❌ Use generic template |
| ✅ Ask "does this solve X?" throughout | ❌ Monologue for 20 minutes |
| ✅ Have champion share screen (if trial) | ❌ Hide pricing until end |
| ✅ Schedule next step BEFORE call ends | ❌ End with "let me know what you think" |
| ✅ Record and send replay | ❌ Forget to follow up within 24h |

### 5.3 Stage 3→4: Proposal Templates

#### Proposal Structure (All Segments)

```
┌─────────────────────────────────────────────────────────┐
│  PROPOSAL TEMPLATE STRUCTURE                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PAGE 1: Executive Summary                              │
│  - Customer pain (in their words)                       │
│  - Proposed solution (1 paragraph)                      │
│  - Expected ROI (quantified)                            │
│  - Investment summary                                   │
│                                                         │
│  PAGE 2: Current State Analysis                         │
│  - Video production volume (current vs. target)         │
│  - Cost breakdown (freelance, agency, tools)            │
│  - Bottleneck identification                            │
│                                                         │
│  PAGE 3: Proposed Solution                              │
│  - Tier selected + rationale                            │
│  - Features included                                    │
│  - Implementation timeline                              │
│                                                         │
│  PAGE 4: ROI Calculation                                │
│  - Cost savings (freelance/agency reduction)            │
│  - Revenue impact (more video = more conversion)        │
│  - Payback period                                       │
│                                                         │
│  PAGE 5: Pricing                                        │
│  - Monthly/Annual cost                                  │
│  - Payment terms                                        │
│  - What's included                                      │
│                                                         │
│  PAGE 6: Case Studies                                   │
│  - 2-3 similar customers (same industry/size)           │
│  - Before/after metrics                                 │
│                                                         │
│  PAGE 7: Next Steps                                     │
│  - Mutual action plan                                   │
│  - Timeline to launch                                   │
│  - Stakeholder sign-off                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Segment-Specific Proposal Customization

| Section | Agency | SME | Enterprise |
|---------|--------|-----|------------|
| **Executive Summary** | "Scale 5x without hiring" | "Professional videos from $49/mo" | "Enterprise-grade AI video platform" |
| **ROI Calculation** | Freelance cost savings | Agency retainer savings | Department efficiency gains |
| **Case Studies** | 2-3 agencies (similar size) | 2-3 ecommerce/SaaS brands | 2-3 enterprise (Fortune 1000) |
| **Pricing** | Premium/Master tier | Growth/Premium tier | Master + custom add-ons |
| **Contract** | 6-12 months | 12 months | 24-36 months |
| **Appendix** | White-label docs | Template library | Security pack (SOC2, SSO) |

### 5.4 Stage 4→5: Negotiation Tactics

#### Negotiation Principles

| Principle | Application |
|-----------|-------------|
| **Never negotiate against yourself** | After making offer, WAIT for response |
| **Trade, don't concede** | "If we do X, can you do Y?" |
| **Anchor high** | Start with Master tier, negotiate down |
| **Create urgency** | "This pricing valid until [date]" |
| **Know your walk-away** | Minimum discount: 10% (Agencies), 5% (SMEs) |

#### Common Objection Responses

| Objection | Response |
|-----------|----------|
| **"Too expensive"** | "I understand budget is a concern. Help me understand — compared to what? Your current freelance spend? Let's look at the ROI calculation again..." |
| **"Need to think about it"** | "Of course. Can I ask — what specifically do you need to think through? Is there something about the solution that doesn't fit your needs?" |
| **"Competitor is cheaper"** | "That's a valid concern. Can I ask — which competitor? Let's compare feature-by-feature. Also, have you considered [total cost of ownership]?" |
| **"Not the right time"** | "I understand timing is tight. What would need to change for this to become a priority? What's the cost of waiting another quarter?" |
| **"Need boss approval"** | "That makes sense. Would it help if I joined the conversation with your boss to answer any questions? I can also prepare a one-pager for them." |

#### Negotiation Levers by Segment

| Lever | Agency | SME | Enterprise |
|-------|--------|-----|------------|
| **Discount** | 10% max (annual prepay) | 5% max (annual only) | 15-20% (multi-year) |
| **Payment Terms** | Quarterly → Annual | Monthly → Annual | Net-30 → Net-60 |
| **Contract Length** | 12 → 24 months | 12 months (fixed) | 36 → 24 months |
| **Add-ons** | API access, custom templates | Brand kit, priority support | SSO, SLA, dedicated CSM |
| **Trial Extension** | 14 → 30 days | 7 → 14 days | POC (60 days) |

### 5.5 Stage 5→6: Closing Checklist

| Task | Owner | Timing |
|------|-------|--------|
| Send contract for signature | AE | Day 0 |
| Follow up on contract status | AE | Day 2, Day 5 |
| Address legal/procurement questions | Legal | As needed |
| Receive signed contract | AE | Day 7-14 |
| Process first payment | Ops | Day 14 |
| Send welcome email (automated) | System | Day 14 |
| Schedule onboarding call | CSM | Day 14-16 |
| Complete onboarding | CSM | Day 21-30 |

---

## 6. CRM Field Requirements

### 6.1 Required Fields per Stage

| Field | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 | Stage 6 |
|-------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|
| **Company Name** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Contact Name** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Email** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Phone** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Company Size** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Industry** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Lead Score** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Lead Source** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **BANT Confirmed** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Use Case** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pain Points** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Budget Range** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Decision Makers** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Timeline** | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Demo Date** | — | — | ✅ | ✅ | ✅ | ✅ |
| **Demo Notes** | — | — | ✅ | ✅ | ✅ | ✅ |
| **Proposal Sent** | — | — | — | ✅ | ✅ | ✅ |
| **Proposal Value** | — | — | — | ✅ | ✅ | ✅ |
| **Tier Selected** | — | — | — | ✅ | ✅ | ✅ |
| **Objections** | — | — | — | ✅ | ✅ | ✅ |
| **Negotiation Notes** | — | — | — | — | ✅ | ✅ |
| **Contract Status** | — | — | — | — | ✅ | ✅ |
| **Close Date** | — | — | — | — | ✅ | ✅ |
| **Close Reason** | — | — | — | — | — | ✅ |

### 6.2 Custom Properties

| Property | Type | Description | Used By |
|----------|------|-------------|---------|
| `lead_score_total` | Number | Total lead score (0-100) | All |
| `lead_score_firmographic` | Number | Firmographic component (0-40) | SDR |
| `lead_score_behavioral` | Number | Behavioral component (0-40) | Marketing |
| `lead_score_timing` | Number | Timing component (0-20) | AE |
| `segment` | Dropdown | Agency / SME / Enterprise | All |
| `pricing_tier_interest` | Dropdown | Starter / Growth / Premium / Master | AE |
| `current_video_spend` | Currency | Monthly spend on video production | AE |
| `current_video_volume` | Number | Videos produced per month | AE |
| `target_video_volume` | Number | Target videos per month | AE |
| `competitor_name` | Text | Competitor being evaluated | AE |
| `champion_name` | Text | Internal champion | AE |
| `technical_requirements` | Multi-line | Technical needs (SSO, API, etc.) | AE |
| `roc_calculated` | Currency | ROI calculation result | AE |
| `payback_period_months` | Number | Months to positive ROI | AE |
| `next_step` | Text | Next action item | All |
| `next_step_date` | Date | Due date for next step | All |

### 6.3 Automation Triggers

| Trigger | Condition | Action |
|---------|-----------|--------|
| **New Lead Created** | Form submit | • Create task: SDR call within 24h <br> • Enroll in nurture sequence <br> • Assign lead score |
| **Lead Score ≥ 70** | Auto-calculated | • Create task: AE call within 1h <br> • Notify Slack #sales-alerts <br> • Update stage to "Qualified" |
| **Demo Booked** | Calendly webhook | • Update stage to "Demo" <br> • Create task: AE prep demo <br> • Send confirmation email |
| **Demo Completed** | Zoom webhook | • Create task: Send proposal within 48h <br> • Send demo recording <br> • Schedule follow-up |
| **Proposal Opened** | DocuSign/PandaDoc | • Notify AE <br> • Create task: Follow-up within 24h |
| **Proposal Unopened (7 days)** | No open event | • Send "did you see this?" email <br> • Create task: AE call |
| **Deal Stuck (>14 days)** | No stage change | • Notify sales manager <br> • Create task: Review deal |
| **Deal Closed Won** | Stage = Closed Won | • Create Polar.sh subscription <br> • Send welcome email <br> • Create onboarding task <br> • Notify Slack #wins |
| **Deal Closed Lost** | Stage = Closed Lost | • Enroll in nurture sequence <br> • Create task: Re-engage in 90 days <br> • Send feedback survey |

### 6.4 CRM Pipeline Views

| View | Filter | Purpose |
|------|--------|---------|
| **My Pipeline** | Owner = Me | Individual AE pipeline |
| **Team Pipeline** | All owners | Manager overview |
| **At Risk** | Stage = Negotiation, Close Date < 30 days | Deals needing attention |
| **Stuck Deals** | No activity > 14 days | Deals to review |
| **Closing This Month** | Close Date = Current Month | Forecast accuracy |
| **High-Value Deals** | Deal Value > $10K | Priority focus |
| **Enterprise Pipeline** | Segment = Enterprise | Strategic deals |

---

## 7. Reporting Dashboard

### 7.1 Daily Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **New Leads** | Count of Stage 1 created today | 10-20/day |
| **Demos Booked** | Count of Stage 3 created today | 2-5/day |
| **Proposals Sent** | Count of Stage 4 created today | 1-3/day |
| **Deals Closed** | Count of Stage 6 (Won) today | 1-2/day |
| **Pipeline Added** | Sum of new deal values today | $10K-20K/day |

### 7.2 Weekly Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **Pipeline Velocity** | (Opps × Win Rate × ACV) / Cycle | $2K-4K/day |
| **Stage Conversion Rates** | Deals moved / Deals in stage | See Section 1.3 |
| **Lead Response Time** | Avg time to first contact | < 1 hour (SQL), < 24h (MQL) |
| **Demo Show Rate** | Demos attended / Demos booked | 70%+ |
| **Proposal Win Rate** | Proposals won / Proposals sent | 30%+ |

### 7.3 Monthly Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **New MRR** | Sum of closed won MRR | $2K-5K/month |
| **CAC** | Sales + Marketing spend / New customers | $100-500 (Agencies/SMEs), $2K-5K (Enterprise) |
| **LTV:CAC Ratio** | LTV / CAC | 3:1+ |
| **Payback Period** | CAC / Monthly MRR | < 6 months |
| **Pipeline Coverage** | Total pipeline / Quota | 3-4x |

---

## 8. Tech Stack Integration

### 8.1 Required Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| **HubSpot CRM** | Pipeline management | Central system of record |
| **Polar.sh** | Payment processing | Webhook → CRM (Closed Won) |
| **Calendly** | Demo scheduling | Webhook → CRM (Demo stage) |
| **Zoom** | Demo delivery | Webhook → CRM (Demo completed) |
| **DocuSign/PandaDoc** | Proposal + contract | Webhook → CRM (Proposal status) |
| **Clearbit** | Lead enrichment | Auto-fill firmographics |
| **Slack** | Sales notifications | CRM webhook → #sales-alerts |

### 8.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SALES PIPELINE DATA FLOW                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Lead Gen Channels → HubSpot CRM → Polar.sh → Slack                     │
│       │                │              │           │                      │
│       │                │              │           │                      │
│       ▼                ▼              ▼           ▼                      │
│  • Website         • Pipeline      • Payment   • New deal               │
│  • LinkedIn        • Lead score    • Invoice   • Closed won             │
│  • Cold email      • Tasks         • Receipt   • Celebration              │
│  • Paid ads        • Reports                                              │
│  • Webinars                                                               │
│  • Referrals                                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Checklist

### Phase 1: Setup (Week 1)

| Task | Owner | Due |
|------|-------|-----|
| Create HubSpot CRM account | Ops | Day 1 |
| Configure pipeline stages | Sales Lead | Day 2 |
| Create custom properties | Ops | Day 2 |
| Setup lead scoring automation | Ops + Marketing | Day 3 |
| Create email templates | Marketing | Day 4 |
| Create proposal templates | Sales Lead | Day 4 |
| Setup Calendly integration | Ops | Day 5 |
| Setup Zoom integration | Ops | Day 5 |
| Train team on CRM usage | Sales Lead | Day 7 |

### Phase 2: Go-Live (Week 2)

| Task | Owner | Due |
|------|-------|-----|
| Import existing leads | SDR | Day 8 |
| Start lead capture from website | Marketing | Day 8 |
| Launch LinkedIn outreach | SDR | Day 9 |
| Launch cold email sequence | SDR | Day 9 |
| First demos scheduled | AE | Day 10-14 |
| First proposals sent | AE | Day 12-14 |
| Weekly pipeline review | Sales Lead | Day 14 |

### Phase 3: Optimization (Week 3-4)

| Task | Owner | Due |
|------|-------|-----|
| Review conversion rates | Sales Lead | Day 21 |
| A/B test email subject lines | SDR | Day 21 |
| Optimize demo script | AE | Day 21 |
| Refine proposal template | Sales Lead | Day 21 |
| Setup Slack notifications | Ops | Day 21 |
| Create reporting dashboard | Ops | Day 28 |
| Monthly pipeline review | All | Day 28 |

---

## 10. Success Criteria

### 30-Day Success

| Metric | Target |
|--------|--------|
| CRM fully configured | ✅ |
| 50+ leads in pipeline | ✅ |
| 10+ demos completed | ✅ |
| 5+ proposals sent | ✅ |
| 3+ deals closed | ✅ |
| $1K+ MRR generated | ✅ |

### 90-Day Success

| Metric | Target |
|--------|--------|
| 200+ leads in pipeline | ✅ |
| 40+ demos completed | ✅ |
| 25+ proposals sent | ✅ |
| 15+ deals closed | ✅ |
| $5K+ MRR generated | ✅ |
| Pipeline velocity $2K+/day | ✅ |
| Forecast accuracy 80%+ | ✅ |

### 180-Day Success

| Metric | Target |
|--------|--------|
| 500+ leads in pipeline | ✅ |
| 100+ demos completed | ✅ |
| 60+ proposals sent | ✅ |
| 40+ deals closed | ✅ |
| $15K+ MRR generated | ✅ |
| Pipeline velocity $4K+/day | ✅ |
| Forecast accuracy 90%+ | ✅ |
| LTV:CAC 3:1+ | ✅ |

---

## Unresolved Questions

1. **Current CRM selection** — HubSpot vs Pipedrive vs Close.com — need final decision
2. **Polar.sh integration status** — Confirm webhook capabilities for closed-won automation
3. **Historical data availability** — Any existing pipeline data to import?
4. **Sales team capacity** — How many SDRs/AEs available for outreach volume targets?
5. **Budget for tools** — Confirm $500-800/mo for CRM + outreach + enrichment tools
6. **Legal review process** — Who reviews contracts for Enterprise deals?
7. **Pricing authority** — What discount can AEs offer without manager approval?
8. **Demo environment** — Do we have demo account with sample data/templates ready?

---

**Document Version:** 1.0
**Created:** 2026-03-17
**Owner:** Sales/Revenue Team
**Review Cadence:** Monthly (first review: 2026-04-17)
**Next Actions:** Setup CRM (Week 1), Go-Live (Week 2), First Pipeline Review (Day 14)

---

## Appendix: Templates

### A. Discovery Call Script (One-Pager)

```
DISCOVERY CALL SCRIPT — 30 MINUTES

WARM-UP (2 min)
"Thanks for taking the time. I'm researching how teams like yours
handle video production. No right or wrong answers — just want to
learn from your experience."

CONTEXT (5 min)
1. "Walk me through how your team produces videos today."
2. "What's the hardest part about meeting video demands?"
3. "Why is that hard?"

PAIN DEEP-DIVE (10 min)
4. "Tell me about the last time you had to rush a video project."
5. "What did you do to meet the deadline?"
6. "What didn't you like about that solution?"
7. "How much time/money does video production cost you monthly?"
8. "How often do you hit capacity limits?"

SOLUTION EXPLORATION (5 min)
9. "If you could wave a magic wand, what would ideal video
    production look like?"
10. "What tools have you tried that didn't work out?"

COMMITMENT (3 min)
11. "Would you be open to trying a new solution if it solved
     [specific pain]?"
12. "Who else should I talk to about this?"
13. "Can I follow up with you in a few weeks?"

QUALIFICATION - BANT (5 min)
Budget: "What's your budget range for video tools?"
Authority: "Who makes the final decision on tools?"
Need: "What happens if you don't solve this?"
Timeline: "When do you need this implemented by?"
```

### B. Demo Agenda Template

```
DEMO AGENDA — SOPHIA AI FACTORY

Attendees: [Names]
Date: [Date]
Duration: 30 minutes

AGENDA:
1. Intro + Agenda (2 min)
2. Recap Your Pain Points (3 min)
   - [Pain 1 from discovery]
   - [Pain 2 from discovery]
   - [Pain 3 from discovery]

3. Live Demo (15 min)
   - Use case: [Specific use case]
   - Template: [Template name]
   - Output: [Expected result]

4. Q&A (5 min)
5. Next Steps (5 min)
   - Trial start date: [Date]
   - Proposal timeline: [Date]
   - Decision timeline: [Date]

PREP NOTES:
- Company: [Company name]
- Industry: [Industry]
- Use case: [Specific use case]
- Current tool: [Competitor/current solution]
- Decision makers: [Names]
```

### C. Proposal Email Template

```
Subject: Proposal for [Company] — [Solution Summary]

Hi [Name],

Great chatting earlier! As discussed, here's the proposal for
bringing Sophia AI Factory to [Company].

Key highlights:
• Reduce video production cost by [X]%
• Scale from [current] to [target] videos/month
• ROI: [Payback period] months

[Link to Proposal]

Next steps:
1. Review proposal (5 min)
2. Schedule walkthrough call — [Calendly link]
3. Start trial/onboarding

Any questions before we hop on a call?

Best,
[Your name]
```

### D. Negotiation Email Template

```
Subject: Re: [Company] + Sophia AI Factory

Hi [Name],

Thanks for the feedback on the proposal.

To make this work for [Company], here's what I can do:

[Option 1: Discount for annual prepay]
• 10% discount for annual prepayment
• Saves you $[amount] vs. monthly

[Option 2: Extended contract]
• Lock in current pricing for 24 months
• Protects against future price increases

[Option 3: Add-ons included]
• Include [add-on 1] + [add-on 2] at no extra cost
• Value: $[amount]/month

In exchange, I'd need:
• Signed contract by [date]
• [Annual payment / 24-month term]

Does this work for your team?

Best,
[Your name]
```

---

**Report Generated:** 2026-03-17
**Model:** Sonnet
**Time:** 2 hours
