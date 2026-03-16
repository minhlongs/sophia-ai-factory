# Sales Pipeline Design — Sophia AI Video Factory

**Date**: 2026-03-16
**Project**: Sophia AI Video Factory
**Report Type**: Pipeline Architecture + Workflow Design

---

## Executive Summary

This report defines the sales pipeline structure for Sophia AI Video Factory, including stage definitions, conversion targets, automation rules, and reporting dashboards.

---

## 1. Pipeline Stages Definition

### Stage Overview

| Stage # | Stage Name | Definition | Exit Criteria |
|---------|------------|------------|---------------|
| 0 | Lead | New contact in system | Validated email/company |
| 1 | MQL | Marketing Qualified Lead | Engaged with content (opened 3+ emails, visited pricing) |
| 2 | SQL | Sales Qualified Lead | BANT score ≥ 7/12 |
| 3 | Discovery | First call completed | Pain points confirmed, timeline identified |
| 4 | Demo | Product demo delivered | Key stakeholders present, questions answered |
| 5 | Trial/Pilot | Started free trial or pilot | Active usage (3+ videos created) |
| 6 | Proposal | Quote/pricing sent | Custom proposal delivered |
| 7 | Negotiation | Terms discussion | Legal/finance review in progress |
| 8 | Closed Won | Contract signed, paid | First payment received |
| 9 | Closed Lost | Deal lost | Reason documented |

---

## 2. Conversion Targets by Stage

### Baseline Metrics (SaaS Benchmark)

| Stage Transition | Target Rate | Industry Benchmark |
|------------------|-------------|-------------------|
| Lead → MQL | 40% | 30-50% |
| MQL → SQL | 50% | 40-60% |
| SQL → Discovery | 80% | 70-90% |
| Discovery → Demo | 60% | 50-70% |
| Demo → Trial | 50% | 40-60% |
| Trial → Proposal | 70% | 60-80% |
| Proposal → Negotiation | 80% | 70-90% |
| Negotiation → Won | 50% | 40-60% |
| **Overall (Lead → Won)** | **3.4%** | 2-5% |

### Sophia AI Factory Targets (Optimized)

| Stage Transition | Q1 Target | Q2 Target | Q3 Target |
|------------------|-----------|-----------|-----------|
| Lead → MQL | 35% | 40% | 45% |
| MQL → SQL | 45% | 50% | 55% |
| SQL → Discovery | 75% | 80% | 85% |
| Discovery → Demo | 55% | 60% | 65% |
| Demo → Trial | 45% | 50% | 55% |
| Trial → Proposal | 65% | 70% | 75% |
| Proposal → Won | 45% | 50% | 55% |
| **Overall** | **2.5%** | **4.2%** | **6.5%** |

---

## 3. Pipeline Velocity Model

### Velocity Formula

```
Pipeline Velocity = (Leads × Conv Rate × ACV) / Sales Cycle Length

Where:
- Leads = New leads per month
- Conv Rate = Overall conversion rate (Lead → Won)
- ACV = Average Contract Value ($2,400/year = $200/mo × 12)
- Sales Cycle = Days from lead to close
```

### Current State (Q1 2026)

| Metric | Value |
|--------|-------|
| New Leads/Month | 200 |
| Conversion Rate | 2.5% |
| ACV | $2,400 |
| Sales Cycle | 45 days |

```
Velocity = (200 × 0.025 × 2400) / 45
         = 12,000 / 45
         = $267/day = $8,000/month new MRR
```

### Target State (Q3 2026)

| Metric | Value |
|--------|-------|
| New Leads/Month | 300 |
| Conversion Rate | 6.5% |
| ACV | $3,600 (upsell to higher tiers) |
| Sales Cycle | 30 days |

```
Velocity = (300 × 0.065 × 3600) / 30
         = 70,200 / 30
         = $2,340/day = $70,200/month new MRR
```

---

## 4. Stage Automation Rules

### Lead → MQL Automation

```yaml
trigger: lead.created
conditions:
  - email.opened_count >= 3 OR
  - page_visit.pricing_page == true OR
  - content.downloaded == true
actions:
  - assign_to_sdr: true
  - send_nurture_sequence: "mql_welcome"
  - slack_notification: "#sales-leads"
```

### MQL → SQL Automation

```yaml
trigger: lead.bant_score_updated
conditions:
  - bant_score >= 7
actions:
  - assign_to_ae: true
  - create_task: "Call within 24 hours"
  - send_email: "ae_introduction"
```

### SQL → Discovery Automation

```yaml
trigger: meeting.booked
conditions:
  - meeting_type == "discovery_call"
actions:
  - create_calendar_invite: true
  - send_prep_email: "what_to_expect"
  - create_call_agenda: true
```

### Demo → Trial Automation

```yaml
trigger: demo.completed
conditions:
  - demo.feedback_score >= 7
actions:
  - send_trial_invite: true
  - create_onboarding_task: true
  - schedule_checkin: "day_3"
```

### Trial → Proposal Automation

```yaml
trigger: trial.usage_threshold
conditions:
  - videos_created >= 3 OR
  - days_active >= 7
actions:
  - notify_ae: true
  - generate_proposal_draft: true
  - send_email: "upgrade_offer"
```

---

## 5. Pipeline Health Metrics

### Daily Dashboard

| Metric | Today | MTD | Target | Status |
|--------|-------|-----|--------|--------|
| New Leads | 8 | 120 | 200 | 🟡 |
| MQLs Created | 3 | 48 | 80 | 🟡 |
| SQLs Created | 2 | 24 | 40 | 🟢 |
| Discovery Calls | 1 | 18 | 30 | 🟡 |
| Demos Completed | 1 | 12 | 20 | 🟢 |
| Trials Started | 0 | 6 | 10 | 🟢 |
| Proposals Sent | 0 | 4 | 7 | 🟢 |
| Deals Closed | 0 | 2 | 5 | 🟡 |

### Weekly Pipeline Review

| Metric | Week 1 | Week 2 | Week 3 | Week 4 | Trend |
|--------|--------|--------|--------|--------|-------|
| Pipeline Created | $50K | $65K | $45K | $70K | 📈 |
| Pipeline Moved | $30K | $40K | $25K | $45K | 📈 |
| Pipeline Closed | $10K | $15K | $8K | $20K | 📈 |
| Avg Deal Size | $5K | $7.5K | $4K | $10K | 📈 |
| Sales Cycle | 42d | 38d | 45d | 35d | 📉 (good) |

---

## 6. Stage-Specific Playbooks

### Stage 0-1: Lead Nurturing

**Goal**: Move lead to MQL (engagement threshold)

| Touch # | Channel | Content | Timing |
|---------|---------|---------|--------|
| 1 | Email | Welcome + value prop | Day 0 |
| 2 | LinkedIn | Connection request | Day 1 |
| 3 | Email | Case study (relevant industry) | Day 3 |
| 4 | LinkedIn | Engage with their post | Day 5 |
| 5 | Email | Invitation to webinar/demo day | Day 7 |
| 6 | Email | Breakup / opt-down | Day 14 |

### Stage 2-3: Discovery Call

**Goal**: Confirm pain, quantify impact, identify timeline

```markdown
## Discovery Call Agenda (30 min)

### Intro (5 min)
- Build rapport
- Confirm agenda
- Ask: "What prompted you to take this call?"

### Current State (10 min)
- "Walk me through your current video workflow"
- "What's the biggest bottleneck?"
- "How much time/money is this costing?"

### Impact (10 min)
- "What would solving this mean for your business?"
- "What happens if you don't solve this?"
- "Who else is affected by this problem?"

### Next Steps (5 min)
- Confirm fit
- Schedule demo
- Identify decision makers
```

### Stage 4-5: Demo → Trial

**Goal**: Show value, overcome objections, start trial

```markdown
## Demo Agenda (45 min)

### Setup (5 min)
- Confirm attendees
- Review discovery notes
- Set expectations

### Live Demo (25 min)
- Show THEIR use case (not generic demo)
- Highlight 3 key workflows
- Address specific pain points from discovery

### Q&A (10 min)
- Handle objections
- Show integrations
- Discuss pricing (if asked)

### Close (5 min)
- Trial setup on call
- Schedule first check-in
- Confirm success criteria
```

### Stage 6-8: Proposal → Close

**Goal**: Remove friction, create urgency, get signature

```markdown
## Proposal Follow-Up Sequence

Day 0: Send proposal + schedule review call
Day 1: "Did you have questions?" check-in
Day 3: Share relevant case study
Day 5: "What's blocking this?" direct ask
Day 7: Offer limited-time incentive
Day 10: Final follow-up / archive if no response
```

---

## 7. Objection Handling Matrix

| Objection | Response Framework | Proof Point |
|-----------|-------------------|-------------|
| "Too expensive" | ROI calculation | "Customer X saved $15K/mo" |
| "Need to think about it" | Uncover real objection | "What specifically needs clarification?" |
| "Happy with current solution" | Cost of status quo | "What does your current solution cost in time?" |
| "No bandwidth to implement" | Reduce friction | "We handle onboarding, you're live in 24h" |
| "Need to talk to [boss/partner]" | Enable champion | "Here's a one-pager to share with them" |

---

## 8. CRM Field Requirements

### Required Fields by Stage

| Field | Lead | MQL | SQL | Discovery | Demo | Trial | Proposal |
|-------|------|-----|-----|-----------|------|-------|----------|
| Company Name | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contact Email | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Company Size | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Industry | - | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BANT Score | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pain Points | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Timeline | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget | - | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Decision Makers | - | - | - | ✅ | ✅ | ✅ | ✅ |
| Competitors | - | - | - | ✅ | ✅ | ✅ | ✅ |
| Trial Start Date | - | - | - | - | - | ✅ | ✅ |
| Proposal Amount | - | - | - | - | - | - | ✅ |

---

## 9. Reporting Dashboard

### Executive Summary (Weekly)

```markdown
## Pipeline Report - Week [N]

### Top of Funnel
- New Leads: [N] (vs target [N], [%] vs last week)
- MQLs Created: [N] ([%] conversion)

### Middle of Funnel
- Discovery Calls: [N] (show rate [%])
- Demos Completed: [N] ([%] of discovery)

### Bottom of Funnel
- Trials Started: [N] ([%] activation)
- Proposals Sent: [N] (total value $[N])
- Deals Closed: [N] (total MRR $[N])

### Pipeline Health
- Total Pipeline Value: $[N]
- Weighted Pipeline: $[N]
- Coverage Ratio: [X]:1
```

### Forecast Accuracy

| Week | Forecast | Actual | Variance |
|------|----------|--------|----------|
| W1 | $25K | $22K | -12% |
| W2 | $30K | $35K | +17% |
| W3 | $28K | $26K | -7% |
| W4 | $35K | $38K | +9% |

**Target**: ±5% variance

---

## 10. Tools & Integrations

### Tech Stack

| Tool | Purpose | Cost |
|------|---------|------|
| HubSpot CRM | Pipeline management | Free-$50/mo |
| Calendly | Meeting scheduling | $15/mo |
| Loom | Async demos | $15/mo |
| PandaDoc | Proposals | $50/mo |
| Slack | Internal notifications | Free |
| Zapier | Automation | $30/mo |

### Key Integrations

```
Website Form → HubSpot (new lead)
HubSpot → Slack (new MQL/SQL alert)
Calendly → HubSpot (meeting booked)
HubSpot → Loom (demo recording)
PandaDoc → HubSpot (proposal status)
Stripe → HubSpot (payment received)
```

---

## Next Steps

### Week 1
- [ ] Configure CRM stages and fields
- [ ] Set up automation rules
- [ ] Build dashboard templates

### Week 2
- [ ] Train sales team on playbook
- [ ] Test automation end-to-end
- [ ] Launch with Tier 1 prospects

### Week 3-4
- [ ] Monitor conversion rates
- [ ] Optimize underperforming stages
- [ ] Document win/loss reasons

---

**Report Generated**: 2026-03-16
**Owner**: Sales Operations
**Review Cadence**: Weekly pipeline review
