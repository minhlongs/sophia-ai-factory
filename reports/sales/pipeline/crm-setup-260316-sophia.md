# CRM Setup & Configuration — Sophia AI Video Factory

**Date**: 2026-03-16
**Project**: Sophia AI Video Factory
**Report Type**: CRM Implementation Guide
**Status**: Ready for Implementation

---

## Executive Summary

This report provides step-by-step CRM setup instructions for Sophia AI Video Factory sales operations, including HubSpot configuration, field mappings, integration workflows, automation rules, and dashboard setup.

**Tech Stack**: HubSpot CRM (Free) + Calendly ($15/mo) + Slack (Free) + PandaDoc ($50/mo) + Stripe
**Implementation Time**: 2-3 hours
**Owner**: Sales Operations

---

## 1. CRM Platform Selection

### Selected: HubSpot CRM (Free Tier)

| Criteria | HubSpot Free | alternatives Considered |
|----------|--------------|------------------------|
| Contacts | Unlimited | Pipedrive (10K limit) |
| Deal Pipeline | 100% customizable | Close.io (paid only) |
| Email Integration | Gmail/Outlook native | Salesforce (overkill) |
| Automation | Basic workflows free | ActiveCampaign (complex) |
| Reporting | Dashboard templates | Freshsales (limited free) |
| Integration | 1,000+ apps | All competitors |
| Cost | $0/mo (starter) | $15-50/mo alternatives |

### Why HubSpot Wins
- Free tier includes unlimited contacts + deals
- Visual pipeline editor (drag-drop)
- Native email tracking (open/click)
- Slack integration for real-time alerts
- Scales to paid tiers ($50/mo) when needed

---

## 2. Pipeline Configuration

### Step 2.1: Create Custom Pipeline

**Navigation**: HubSpot CRM → Deals → Pipelines → Create Pipeline

```
Pipeline Name: Sophia AI Video Factory Sales
Currency: USD
Default Stages: 10 (see below)
```

### Step 2.2: Configure 10 Pipeline Stages

| Stage # | Stage Name | Color | Probability |
|---------|------------|-------|-------------|
| 0 | Lead | Gray | 0% |
| 1 | MQL | Blue | 5% |
| 2 | SQL | Light Blue | 10% |
| 3 | Discovery | Yellow | 20% |
| 4 | Demo | Orange | 30% |
| 5 | Trial/Pilot | Yellow-Orange | 40% |
| 6 | Proposal | Red | 60% |
| 7 | Negotiation | Dark Red | 80% |
| 8 | Closed Won | Green | 100% |
| 9 | Closed Lost | Dark Gray | 0% |

**Configuration Steps**:
1. Click "Edit stages" in pipeline view
2. Drag to reorder (Lead → MQL → SQL → Discovery → Demo → Trial → Proposal → Negotiation → Won/Lost)
3. Set win probability % per stage
4. Save pipeline

### Step 2.3: Deal Rotation Rules

- Round-robin assignment for MQLs (equal distribution)
- SQL+ assigned to specific AE based on industry vertical
- Enterprise deals ($10K+) auto-assigned to senior AE

---

## 3. Field Configuration

### Step 3.1: Create Custom Deal Properties

**Navigation**: Settings → Properties → Deal Properties → Create Property

| Property Label | Internal Name | Type | Required | Options/Validation |
|----------------|---------------|------|----------|-------------------|
| Company Size | company_size | Dropdown | ✅ (MQL+) | 1-10, 11-50, 51-200, 201-500, 500+ |
| Industry | industry | Dropdown | ✅ (MQL+) | Video Production, Marketing Agency, E-commerce, SaaS, Media/Entertainment, Other |
| Location | location | Text | ✅ (MQL+) | Free text (city, country) |
| BANT Score | bant_score | Number | ✅ (SQL+) | 0-12 (integer) |
| Pain Points | pain_points | Multi-line Text | ✅ (SQL+) | Free text |
| Timeline | timeline | Dropdown | ✅ (SQL+) | Immediate (<30d), Q1, Q2, Q3+, No timeline |
| Budget | budget | Dropdown | ✅ (SQL+) | <$5K, $5-15K, $15-30K, $30K+ |
| Decision Makers | decision_makers | Multi-line Text | ✅ (Discovery+) | Names + titles |
| Competitors | competitors | Text | ✅ (Discovery+) | Free text |
| Trial Start Date | trial_start_date | Date | ✅ (Trial+) | Date picker |
| Trial End Date | trial_end_date | Date | ✅ (Trial+) | Date picker |
| Videos Created (Trial) | videos_created | Number | ✅ (Trial+) | Integer |
| Proposal Amount | proposal_amount | Number | ✅ (Proposal+) | Currency (USD) |
| Proposal Sent Date | proposal_sent_date | Date | ✅ (Proposal+) | Date picker |
| Lost Reason | lost_reason | Dropdown | ✅ (Closed Lost) | Price too high, Timing bad, Competitor, No decision, Ghosted, Other |

### Step 3.2: Required Fields by Stage Enforcement

**Navigation**: Settings → Deals → Required Properties

| Stage | Required Properties |
|-------|---------------------|
| Lead | Company Name, Contact Email |
| MQL | Company Size, Industry, Location |
| SQL | BANT Score, Pain Points, Timeline, Budget |
| Discovery | Decision Makers, Competitors |
| Demo | (All SQL fields) |
| Trial | Trial Start Date, Trial End Date, Videos Created |
| Proposal | Proposal Amount, Proposal Sent Date |
| Negotiation | (All Proposal fields) |
| Closed Won | (All fields complete) |
| Closed Lost | Lost Reason |

**Enforcement**: Deals cannot advance to next stage without required fields.

---

## 4. Contact & Company Properties

### Step 4.1: Contact Properties

| Property | Internal Name | Type | Required |
|----------|---------------|------|----------|
| LinkedIn Profile | linkedin_profile | URL | - |
| Role | contact_role | Dropdown | ✅ (SQL+) |
| Phone | phone | Phone Number | ✅ (SQL+) |
| Preferred Contact Method | preferred_contact_method | Dropdown | Email, Phone, LinkedIn |

### Step 4.2: Company Properties

| Property | Internal Name | Type | Required |
|----------|---------------|------|----------|
| Website | company_website | URL | ✅ |
| Annual Revenue | annual_revenue | Number | - |
| Tech Stack | tech_stack | Multi-line Text | - |
| Current Video Spend | current_video_spend | Dropdown | <$1K, $1-5K, $5-15K, $15K+ |
| Video Output/Month | video_output_month | Number | - |

---

## 5. Automation Rules Setup

### Step 5.1: Lead → MQL Automation

**Navigation**: Automation → Workflows → Create Workflow → Deal-based

```yaml
Workflow Name: Lead to MQL Trigger
Enrollment Trigger: Deal stage is "Lead"

Conditions (ANY must be true):
  - Email marketing contact: email open count ≥ 3
  - Page view: /pricing page visited
  - Form submission: Content download (lead magnet)

Actions:
  - Set deal stage: "MQL"
  - Send internal email: SDR notification
  - Slack notification: #sales-leads channel
  - Add to nurture sequence: "MQL Welcome"
```

### Step 5.2: MQL → SQL Automation

```yaml
Workflow Name: MQL to SQL Trigger
Enrollment Trigger: Deal stage is "MQL"

Conditions:
  - BANT Score property ≥ 7

Actions:
  - Set deal stage: "SQL"
  - Assign deal owner: Account Executive
  - Create task: "Call within 24 hours"
  - Send email: AE introduction template
  - Slack notification: #sales-sqls
```

### Step 5.3: SQL → Discovery Automation

```yaml
Workflow Name: Discovery Call Scheduled
Enrollment Trigger: Meeting booked (Calendly integration)

Conditions:
  - Meeting type = "Discovery Call"

Actions:
  - Set deal stage: "Discovery"
  - Create calendar event: Discovery call
  - Send email: "What to expect" prep email
  - Create task: Review discovery checklist
```

### Step 5.4: Demo → Trial Automation

```yaml
Workflow Name: Demo Completed → Trial Offer
Enrollment Trigger: Deal stage changed to "Demo" + Demo completed

Conditions:
  - Demo feedback score ≥ 7 (from meeting notes)

Actions:
  - Send email: Trial invitation
  - Create task: "Set up trial account within 24h"
  - Schedule task: Day 3 check-in
  - Schedule task: Day 7 usage review
```

### Step 5.5: Trial → Proposal Automation

```yaml
Workflow Name: Trial Usage → Proposal Trigger
Enrollment Trigger: Trial usage threshold

Conditions (ANY):
  - Videos created ≥ 3
  - Days active ≥ 7

Actions:
  - Send internal email: AE notification
  - Create task: "Generate proposal draft"
  - Send email: "Upgrade offer" with pricing
  - Schedule task: Follow up in 2 days
```

---

## 6. Integration Setup

### 6.1: Website Form → HubSpot

**Goal**: Capture leads from sophia.agencyos.network

**Steps**:
1. HubSpot → Marketing → Forms → Create Form
2. Fields: Name, Email, Company, Company Size, Message
3. Options:
   - Create contact if not exists
   - Create deal in "Lead" stage
   - Send notification email to sales@agencyos.network
4. Embed code → Copy → Paste into website (next step)

**Website Integration**:
```html
<!-- Add to sophia-ai-factory/src/components/ContactForm.tsx -->
<div id="hubspot-form-container"></div>
<script src="https://js.hsforms.net/forms/embed/v2.js"></script>
<script>
  hbspt.forms.create({
    region: "na1",
    portalId: "YOUR_PORTAL_ID",
    formId: "YOUR_FORM_ID"
  });
</script>
```

### 6.2: HubSpot → Slack Alerts

**Navigation**: HubSpot → Automation → Workflows → Create

```yaml
Workflow: Slack Alert for MQL
Trigger: Deal stage changed to "MQL"
Action: Send Slack message
Channel: #sales-leads
Message:
  ":new_lead: New MQL: {{deal.dealname}}
   Company: {{deal.company}}
   BANT Score: {{deal.bant_score}}
   Owner: {{deal.owner}}
   Link: {{deal.url}}"
```

**Repeat for**:
- SQL created → #sales-sqls
- Demo scheduled → #sales-demos
- Proposal sent → #sales-proposals
- Deal won → :tada: #sales-wins

### 6.3: Calendly → HubSpot

**Setup**:
1. Calendly → Integrations → HubSpot → Connect
2. Map fields:
   - Event invitee email → Contact email
   - Event type → Meeting type property
   - Scheduled time → Meeting date property
3. Enable auto-create contact if not exists

**Workflow**:
```
Calendly booking → HubSpot contact created/updated → Deal activity logged
```

### 6.4: HubSpot → Loom (Demo Recording)

**Manual Workflow** (no direct integration):
1. AE records demo in Loom
2. Loom share link → Paste in HubSpot deal notes
3. Tag: #demo-recording

**Optional Automation** (Zapier):
- Trigger: Deal stage = "Demo"
- Action: Create Loom recording request
- Result: Loom link → HubSpot notes

### 6.5: PandaDoc → HubSpot

**Setup**:
1. PandaDoc → Settings → Integrations → HubSpot → Connect
2. Map fields:
   - Deal name → Document title
   - Contact email → Recipient
   - Proposal amount → Pricing table
3. Enable status sync

**Workflow**:
```
HubSpot: Proposal sent → PandaDoc: Document created → Status updates sync back
PandaDoc: Signed → HubSpot: Deal stage → "Negotiation"
```

### 6.6: Stripe → HubSpot

**Setup** (via Zapier or native integration):
1. Zapier → Create Zap
2. Trigger: Stripe "New Payment" or "Invoice Paid"
3. Action: HubSpot "Update Deal Stage" to "Closed Won"
4. Filter: Deal exists + Contact email matches

**Workflow**:
```
Stripe: Payment received → HubSpot: Deal stage = "Closed Won"
                                      → Slack: #sales-wins alert
                                      → Email: Welcome sequence
```

---

## 7. Dashboard Configuration

### Step 7.1: Create Executive Dashboard

**Navigation**: Reports → Dashboards → Create Dashboard

**Dashboard Name**: Sophia AI Sales Executive

#### Widget 1: Pipeline Overview
- Type: Funnel chart
- Data: Deals by stage (count + value)
- Filter: Created date = This month

#### Widget 2: Lead Velocity
- Type: Line chart
- Data: New leads per day (7-day rolling)
- Target: 200 leads/month line

#### Widget 3: Conversion Rates
- Type: Table
- Metrics:
  - Lead → MQL: Target 40%, Actual [auto]
  - MQL → SQL: Target 50%, Actual [auto]
  - SQL → Discovery: Target 80%, Actual [auto]
  - Overall: Target 2.5%, Actual [auto]

#### Widget 4: Pipeline Velocity
- Type: Metric card
- Formula: `(Leads × Conv Rate × ACV) / Sales Cycle`
- Display: $/day new MRR

#### Widget 5: Activities This Week
- Type: Bar chart
- Metrics: Calls, Emails, Demos, Proposals
- Comparison: This week vs last week

#### Widget 6: Deals at Risk
- Type: Table
- Filter: Stage = Proposal/Negotiation + No activity 7+ days
- Columns: Deal name, Amount, Days stuck, Owner

### Step 7.2: Schedule Email Reports

**Daily Digest** (9 AM local):
- New leads (yesterday)
- MQLs created
- SQLs created
- Today's scheduled calls

**Weekly Review** (Monday 10 AM):
- Pipeline summary (created/moved/closed)
- Conversion rate trends
- Top 10 deals by value
- Forecast vs actual

**Recipients**:
- Daily: SDRs, AEs
- Weekly: + Sales Manager, Founder

---

## 8. Data Migration Plan

### If migrating from another CRM:

**Step 8.1: Export Source Data**
```bash
# From current CRM (example: Pipedrive)
Export: Contacts (CSV), Deals (CSV), Companies (CSV)
Date range: All historical
```

**Step 8.2: Map Fields**

| Source Field | HubSpot Field | Transformation |
|--------------|---------------|----------------|
| person_id | Contact ID | Direct |
| org_id | Company ID | Direct |
| deal_value | Amount | Multiply by 100 (cents) |
| stage_id | Deal stage | Map to 10-stage pipeline |
| status | Closed reason | Map lost reasons |

**Step 8.3: Import Order**
1. Companies first (parent records)
2. Contacts (linked to companies)
3. Deals (linked to contacts + companies)

**Step 8.4: Validation**
- Count check: Source vs destination record counts
- Spot check: 10 random deals → verify all fields
- Activity check: Last 30 days activities imported

**Note**: For Sophia AI Factory (new project), no migration needed — start fresh.

---

## 9. Team Training & Rollout Plan

### Week 1: Setup + Testing

| Day | Activity | Owner |
|-----|----------|-------|
| Mon | Pipeline + field configuration | Sales Ops |
| Tue | Automation workflows | Sales Ops |
| Wed | Integration testing (Calendly, Slack) | Sales Ops + Tech |
| Thu | Dashboard setup | Sales Ops |
| Fri | Internal testing + bug fixes | Sales Ops |

### Week 2: Training

| Day | Activity | Attendees |
|-----|----------|-----------|
| Mon | SDR training: Lead management | SDRs |
| Tue | AE training: SQL→Close workflow | AEs |
| Wed | Manager training: Reporting + forecasting | Sales Manager |
| Thu | Q&A session + practice deals | All |
| Fri | Go-live with Tier 1 prospects | All |

### Week 3-4: Monitoring + Optimization

| Metric | Target | Review Cadence |
|--------|--------|----------------|
| Data completeness | 100% required fields | Daily |
| Automation success | 95%+ trigger rate | Weekly |
| User adoption | 100% login rate | Weekly |
| Pipeline accuracy | ±5% forecast variance | Weekly |

---

## 10. Success Metrics

### 30-Day Checkpoints

| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| Leads captured | 0 | 200 | [Track] |
| MQLs created | 0 | 80 | [Track] |
| SQLs created | 0 | 40 | [Track] |
| Pipeline value | $0 | $100K | [Track] |
| Forecast accuracy | N/A | ±10% | [Track] |

### 90-Day Targets

| Metric | Target |
|--------|--------|
| Lead → Won conversion | 2.5% |
| Sales cycle length | <45 days |
| Pipeline velocity | $8K/mo new MRR |
| User adoption | 100% |

---

## 11. Troubleshooting Guide

### Common Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Automation not triggering | Workflow enrolled but no action | Check conditions, verify property values set |
| Slack alerts not sending | No messages in channel | Re-authenticate Slack app, check channel permissions |
| Calendly not syncing | Bookings not in HubSpot | Check integration status, re-connect |
| Required fields not enforced | Stage change without fields | Verify "Required Properties" settings |
| Dashboard data wrong | Metrics not updating | Check date filters, refresh data |

### Support Contacts

| Issue Type | Contact |
|------------|---------|
| HubSpot technical | support@hubspot.com |
| Integration issues | Zapier support / IT |
| Workflow logic | Sales Ops Manager |
| Data migration | Sales Ops + IT |

---

## Next Steps Checklist

### Immediate (This Week)
- [ ] Create HubSpot account (free tier)
- [ ] Configure 10-stage pipeline
- [ ] Create all custom properties
- [ ] Set up required fields by stage
- [ ] Build automation workflows (5 rules)

### Week 2
- [ ] Connect Calendly integration
- [ ] Set up Slack alerts
- [ ] Configure dashboard widgets
- [ ] Test end-to-end workflow
- [ ] Train SDR/AE team

### Week 3
- [ ] Go-live with Tier 1 prospects
- [ ] Monitor data completeness daily
- [ ] Review automation success rate
- [ ] Adjust workflows based on feedback

### Week 4
- [ ] First weekly pipeline review meeting
- [ ] Analyze conversion rates
- [ ] Optimize underperforming stages
- [ ] Document win/loss reasons

---

**Implementation Owner**: Sales Operations
**Tech Stack Cost**: $0-65/mo (HubSpot Free + Calendly $15 + PandaDoc $50)
**Estimated Setup Time**: 4-6 hours
**Go-Live Target**: Week 2, Day 5

---

**Report Generated**: 2026-03-16
**Version**: 1.0.0
**Review Cadence**: Monthly pipeline health check
