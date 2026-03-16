# CRM Configuration — Sophia AI Video Factory

**Generated:** 2026-03-16
**Version:** 1.0
**Recommended CRM:** HubSpot (Startup), Salesforce (Scale)

---

## CRM Selection

| Criteria | HubSpot Starter | Salesforce Essentials | Pipedrive Professional |
|----------|-----------------|----------------------|------------------------|
| **Price** | $20/mo | $25/mo | $49/mo |
| **Best For** | < $5M revenue | $5M-50M revenue | Sales-focused teams |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Customization** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Integration** | Shopify, Slack | Shopify, Slack | Shopify, Slack |
| **Recommendation** | **START HERE** | Scale at $10M+ | Sales-first teams |

---

## HubSpot Starter Setup

### Step 1: Account Creation

```
1. Go to hubspot.com → Get Started Free
2. Select: "Sales Hub" → "Starter" ($20/mo)
3. Connect: company@agencyos.network
4. Skip onboarding tour (we'll configure manually)
```

### Step 2: Pipeline Configuration

**Navigate:** Settings → Objects → Deals → Pipelines → Create Pipeline

**Pipeline Name:** `Sophia AI Sales Pipeline`

**Deal Stages:**

| Stage ID | Name | Probability | Color |
|----------|------|-------------|-------|
| 1 | 01 - Prospecting | 10% | Gray |
| 2 | 02 - Qualified | 25% | Blue |
| 3 | 03 - Discovery Demo | 50% | Yellow |
| 4 | 04 - Proposal Sent | 70% | Orange |
| 5 | 05 - Negotiation | 85% | Red |
| 6 | 06 - Closed Won | 100% | Green |
| 7 | 07 - Closed Lost | 0% | Red |

**Export as JSON:**
```json
{
  "pipelineName": "Sophia AI Sales Pipeline",
  "stages": [
    {"label": "01 - Prospecting", "probability": 0.10, "color": "#808080"},
    {"label": "02 - Qualified", "probability": 0.25, "color": "#0000FF"},
    {"label": "03 - Discovery Demo", "probability": 0.50, "color": "#FFFF00"},
    {"label": "04 - Proposal Sent", "probability": 0.70, "color": "#FFA500"},
    {"label": "05 - Negotiation", "probability": 0.85, "color": "#FF0000"},
    {"label": "06 - Closed Won", "probability": 1.00, "color": "#008000"},
    {"label": "07 - Closed Lost", "probability": 0.00, "color": "#FF0000"}
  ]
}
```

### Step 3: Custom Properties

**Navigate:** Settings → Properties → Create Property

#### Company Properties

| Name | Internal Name | Type | Options |
|------|---------------|------|---------|
| Revenue | `revenue` | Number | Format: Currency |
| Employee Count | `employee_count` | Number | — |
| Platform | `ecommerce_platform` | Dropdown | Shopify, WooCommerce, Custom |
| Monthly Ad Spend | `monthly_ad_spend` | Number | Format: Currency |
| Current Creative Process | `creative_process` | Text Area | — |
| Lead Score | `lead_score` | Number | 0-100 |
| Tier | `lead_tier` | Dropdown | Tier 1, Tier 2, Tier 3 |

#### Contact Properties

| Name | Internal Name | Type | Options |
|------|---------------|------|---------|
| Decision Maker | `decision_maker` | Boolean | Yes/No |
| LinkedIn URL | `linkedin_url` | URL | — |
| Pain Point | `primary_pain_point` | Dropdown | See below |
| Trigger Event | `trigger_event` | Dropdown | See below |

**Pain Point Options:**
```
- Creative fatigue (running out of variations)
- Agency bottleneck (slow turnaround)
- ROAS declining (ads not performing)
- Budget constraints (agency too expensive)
- Production volume (need more videos)
- Quality concerns (current videos generic)
```

**Trigger Event Options:**
```
- Q2/Q3 campaign planning
- New product launch
- Agency relationship ended
- Hiring freeze (can't add headcount)
- ROAS dropped below target
- Competitor using AI video
```

#### Deal Properties

| Name | Internal Name | Type | Options |
|------|---------------|------|---------|
| BANT Score | `bant_score` | Number | 0-10 |
| Demo Date | `demo_date` | Date | — |
| Proposal Tier | `proposal_tier` | Dropdown | Starter, Growth, Premium, Master |
| Competitor | `competitor` | Text | — |
| Loss Reason | `loss_reason` | Dropdown | See below |
| Expected ROAS | `expected_roas` | Number | — |
| Current Video Cost | `current_video_cost` | Number | Format: Currency |
| Videos Needed/Mo | `videos_needed_monthly` | Number | — |

**Loss Reason Options:**
```
- Budget (no budget, budget cut)
- Authority (couldn't reach decision maker)
- Need (no pain, happy with current)
- Timing (not now, maybe later)
- Competition (chose competitor)
- Product (missing feature)
- Other (specify in notes)
```

### Step 4: Import Lead List

**Navigate:** Contacts → Contacts → Import

**CSV Format:**
```csv
company_name,website,revenue,employee_count,platform,monthly_ad_spend,contact_firstname,contact_lastname,contact_email,contact_linkedin,lead_tier,pain_point
GlowRecipe,glowrecipe.com,25000000,50,Shopify,50000,Sarah,Lee,sarah@glowrecipe.com,https://linkedin.com/in/sarahlee,Tier 1,Creative fatigue
Allbirds,allbirds.com,50000000,200,Shopify,100000,Emily,Chen,emily@allbirds.com,https://linkedin.com/in/emilychen,Tier 1,ROAS declining
```

**Mapping:**
- `company_name` → Company Name
- `contact_email` → Email
- `lead_tier` → Lead Tier
- Custom fields → Custom properties created above

### Step 5: Email Sequences

**Navigate:** Sales → Email → Templates → Create Template

#### Template 1: Initial Outreach

```
Subject: {{contact.company}} video ad creative at scale

Hi {{contact.firstname}},

Noticed {{contact.company}} is running {{custom.ad_campaign}} — great work on {{custom.ad_element}}.

We help D2C brands like {{custom.similar_brand}} produce 20-50 AI video ads/month
at $0.49/video (vs. $500-5K agency cost) with 4.8x average ROAS.

Worth a 15-min chat to see if our URL-to-video formula fits your creative strategy?

Best,
{{owner.firstname}}
```

#### Template 2: Follow-up

```
Subject: Re: {{email.subject}}

Hi {{contact.firstname}},

Following up with something useful — I analyzed {{contact.company}}'s current
Facebook ad creative and noticed:

✅ Strong: {{custom.ad_strength}}
⚠️ Opportunity: {{custom.ad_weakness}}

We helped {{custom.similar_brand}} fix this exact issue — their ROAS went
from 2.1x to 4.8x in 30 days.

Here's the case study: {{custom.case_study_link}}

Still worth that 15-min chat?

Best,
{{owner.firstname}}
```

**Navigate:** Sales → Sequences → Create Sequence

**Sequence Settings:**
- Name: `Cold Email - Tier 1 (Hot Leads)`
- Enrollment: Manual (for now)
- Steps: 5 touches over 14 days (see outreach-sequences.md)

### Step 6: Automation Rules

**Navigate:** Automation → Create Workflow

#### Rule 1: Lead Score Auto-Update

```
Trigger: Company property changed
Condition: revenue >= 5000000 AND employee_count >= 20
Action: Set lead_score = lead_score + 20
```

#### Rule 2: Stage Change Notification

```
Trigger: Deal stage changed to "04 - Proposal Sent"
Action: Send email to deal owner
Template: "Proposal sent — follow up in 3 days"
```

#### Rule 3: Stale Deal Alert

```
Trigger: Deal in same stage for 14+ days
Action: Create task for deal owner
Task: "Follow up on stale deal: {{deal.dealname}}"
```

#### Rule 4: Closed Lost Nurture

```
Trigger: Deal stage changed to "07 - Closed Lost"
Condition: loss_reason = "Timing" OR "Budget"
Action: Enroll in "30-Day Nurture Campaign" sequence
```

### Step 7: Dashboard Setup

**Navigate:** Reports → Dashboards → Create Dashboard

#### Dashboard Name: `Sales Pipeline Health`

**Reports to Add:**

1. **Pipeline Overview**
   - Type: Funnel
   - Data: Deals by stage
   - Filter: Current quarter

2. **Pipeline Velocity**
   - Type: Metric
   - Formula: (Leads × Conv. Rate × ACV) / Sales Cycle
   - Target: $630/day

3. **Conversion Rate by Stage**
   - Type: Bar chart
   - Data: Stage-to-stage conversion
   - Compare: This month vs. last month

4. **Sales Activity**
   - Type: Table
   - Columns: Rep, Emails sent, Calls, Demos booked, Deals closed
   - Sort: Deals closed (desc)

5. **Revenue Forecast**
   - Type: Metric
   - Formula: SUM(deal_amount × probability) for open deals
   - Compare: vs. quota

6. **Lead Source Performance**
   - Type: Pie chart
   - Data: Deals won by lead source
   - Metric: Win rate %

### Step 8: Integration Setup

#### Shopify Integration

**Navigate:** Settings → Integrations → Search "Shopify"

```
1. Click Connect
2. Login with Shopify admin account
3. Select store: agencyos-network.myshopify.com
4. Map fields:
   - Customer email → Contact email
   - Order value → Deal amount
5. Save
```

#### Slack Integration

**Navigate:** Settings → Integrations → Search "Slack"

```
1. Click Connect
2. Authorize HubSpot in Slack
3. Configure notifications:
   - Channel: #sales-alerts
   - Events: New deal created, Deal stage changed, Task due
4. Save
```

#### Calendar Integration

**Navigate:** Settings → General → Calendar & Email

```
1. Connect Google Calendar (or Outlook)
2. Connect email (Gmail or Outlook)
3. Configure meeting link:
   - Meeting type: "15-min Discovery Call"
   - Duration: 15 minutes
   - Buffer: 5 minutes
   - Hours: 9am-5pm PT, Mon-Fri
4. Copy Calendly link for email templates
```

---

## Salesforce Essentials Setup

### Step 1: Org Creation

```
1. Go: salesforce.com/form/signup/freetrial
2. Select: "Sales Cloud" → "Essentials" ($25/user/mo)
3. Org Name: Sophia AI Sales
4. Username: admin@agencyos.network
```

### Step 2: Opportunity Pipeline

**Navigate:** Setup → Object Manager → Opportunity → Fields & Relationships

**Stage Values:**
```
01 - Prospecting (10%)
02 - Qualified (25%)
03 - Discovery Demo (50%)
04 - Proposal Sent (70%)
05 - Negotiation (85%)
06 - Closed Won (100%)
07 - Closed Lost (0%)
```

### Step 3: Custom Fields

**Navigate:** Setup → Object Manager → Opportunity → Fields & Relationships → New

| Field Label | Type | Length |
|-------------|------|--------|
| BANT Score | Number | 2 |
| Demo Date | Date | — |
| Proposal Tier | Picklist | Starter, Growth, Premium, Master |
| Competitor | Text | 100 |
| Loss Reason | Picklist | See HubSpot options |
| Expected ROAS | Number | 3,2 |
| Current Video Cost | Currency | — |
| Videos Needed/Mo | Number | — |

### Step 4: Lead Scoring Formula

**Navigate:** Setup → Formula Fields → New

```
Formula:
CASE(Revenue__c,
  WHEN >= 5000000 THEN 30,
  WHEN >= 2000000 THEN 20,
  10
) +
CASE(Platform__c,
  "Shopify Plus", 15,
  "Shopify", 10,
  5
) +
CASE(Products_Count__c,
  WHEN >= 50 THEN 15,
  WHEN >= 20 THEN 10,
  5
)
```

### Step 5: Validation Rules

**Rule: Require BANT Score at Qualification**
```
AND(
  ISCHANGED(StageName),
  CONTAINS(StageName, "Qualified"),
  BANT_Score__c < 7
)
Error: BANT Score must be 7+ to move to Qualified stage.
```

**Rule: Require Demo Date at Discovery**
```
AND(
  ISCHANGED(StageName),
  CONTAINS(StageName, "Discovery"),
  ISBLANK(Demo_Date__c)
)
Error: Demo date required for Discovery stage.
```

### Step 6: Process Builder

**Process: Auto-Create Task on Stage Change**

```
Object: Opportunity
Trigger: When record is created or edited

Criteria:
  StageName changed to "Proposal Sent"

Immediate Action:
  Create Task
  Subject: "Follow up on proposal: {!Opportunity.Name}"
  Due Date: 3 days from now
  Assigned To: Opportunity Owner
```

### Step 7: Report Types

**Navigate:** Reports → New Report

#### Report 1: Pipeline Funnel
```
Type: Opportunities
Group By: Stage
Metrics: Count, Amount, Weighted Amount
Filter: Close Date = Current Quarter
Chart: Funnel
```

#### Report 2: Conversion Rate
```
Type: Opportunities
Group By: Stage (converted from/to)
Metrics: Count
Formula: (Count Won / Count Total) * 100
```

#### Report 3: Sales Activity
```
Type: Tasks + Events
Group By: Owner
Metrics: Count Completed
Filter: Activity Date = This Month
```

---

## CRM Data Import Template

### CSV Template (HubSpot/Salesforce Compatible)

```csv
Company Name,Website,Revenue,Employees,Platform,Ad Spend/Mo,First Name,Last Name,Email,LinkedIn,Tier,Pain Point,Trigger Event
GlowRecipe,glowrecipe.com,25000000,50,Shopify,50000,Sarah,Lee,sarah@glowrecipe.com,https://linkedin.com/in/sarahlee,Tier 1,Creative fatigue,Q2 planning
Allbirds,allbirds.com,50000000,200,Shopify,100000,Emily,Chen,emily@allbirds.com,https://linkedin.com/in/emilychen,Tier 1,ROAS declining,New launch
Warby Parker,warbyparker.com,50000000,200,Shopify,80000,Alex,Chen,alex@warbyparker.com,https://linkedin.com/in/alexchen,Tier 1,Agency bottleneck,Agency change
```

### Import Field Mapping

| CSV Column | HubSpot Property | Salesforce Field |
|------------|------------------|------------------|
| Company Name | Company Name | Account Name |
| Website | Website | Website |
| Revenue | Revenue | Annual Revenue |
| Employees | Employee Count | NumberOfEmployees |
| Platform | E-commerce Platform | Platform__c |
| Ad Spend/Mo | Monthly Ad Spend | Ad_Spend_Monthly__c |
| First Name | First Name | First Name |
| Last Name | Last Name | Last Name |
| Email | Email | Email |
| LinkedIn | LinkedIn URL | LinkedIn__c |
| Tier | Lead Tier | Lead_Tier__c |
| Pain Point | Primary Pain Point | Pain_Point__c |
| Trigger Event | Trigger Event | Trigger_Event__c |

---

## Automation Recipes

### Zapier: Lead Capture → CRM

**Trigger:** Typeform (Lead Form Submit)
**Action:** HubSpot (Create Contact + Company)

```
1. New Typeform entry → Trigger Zap
2. Find/Create Company in HubSpot
   - Match by: Company Name
   - Create if not found
3. Create Contact in HubSpot
   - Email: {{typeform.email}}
   - First Name: {{typeform.first_name}}
   - Last Name: {{typeform.last_name}}
   - LinkedIn: {{typeform.linkedin}}
4. Associate Contact with Company
5. Create Deal in "01 - Prospecting"
6. Send Slack notification: #sales-leads
```

### Zapier: Demo Booked → Calendar

**Trigger:** HubSpot (Meeting Booked)
**Action:** Google Calendar (Create Event) + Slack (Notify)

```
1. Meeting booked in HubSpot → Trigger Zap
2. Create Google Calendar Event
   - Title: "Discovery Demo: {{contact.company}}"
   - Attendees: {{contact.email}}, {{owner.email}}
   - Duration: 15 minutes
   - Description: {{contact.pain_point}}
3. Send Slack message to #sales-demos
   - "New demo booked: {{contact.company}} - {{demo_date}}"
```

### Zapier: Deal Won → Onboarding

**Trigger:** HubSpot (Deal Stage = Closed Won)
**Action:** Slack + Email + Task

```
1. Deal Closed Won → Trigger Zap
2. Send Slack to #onboarding
   - "🎉 New customer: {{deal.company}} - {{deal.amount}}/mo"
3. Create onboarding task in Asana/ClickUp
   - Title: "Onboard: {{deal.company}}"
   - Due: 2 business days
   - Assignee: Onboarding Manager
4. Send welcome email to customer
   - Template: "Welcome to Sophia AI!"
```

---

## CRM Best Practices

### Data Hygiene Rules

1. **No Duplicates**
   - Check before create: Search by email/domain
   - Use HubSpot duplicate management

2. **Required Fields**
   - Company: Revenue, Platform, Employees
   - Contact: Email, LinkedIn, Pain Point
   - Deal: Amount, Close Date, Stage

3. **Weekly Cleanup**
   - Monday 9am: Review stale deals (14+ days)
   - Friday 4pm: Update forecast for next week
   - Month-end: Archive lost deals >90 days

### Pipeline Management

1. **Daily**
   - Check tasks due today
   - Reply to email responses
   - Move deals through stages

2. **Weekly**
   - Pipeline review (Monday 10am)
   - Forecast update (Friday 3pm)
   - Activity metrics check

3. **Monthly**
   - Conversion rate analysis
   - Velocity calculation
   - Territory rebalancing

### Reporting Cadence

| Report | Frequency | Audience | Owner |
|--------|-----------|----------|-------|
| Pipeline Health | Daily | Sales team | Sales Lead |
| Activity Metrics | Weekly | Sales team | Sales Lead |
| Forecast | Weekly | Leadership | Sales Lead |
| Conversion Analysis | Monthly | All stakeholders | Sales Ops |
| Lead Source ROI | Monthly | Marketing + Sales | CMO |

---

## Next Actions

1. **Select CRM** — HubSpot Starter recommended for startup
2. **Create Account** — Start free trial
3. **Configure Pipeline** — Import stage definitions
4. **Create Properties** — Add custom fields
5. **Import Lead List** — CSV import (100 companies)
6. **Setup Sequences** — Load email templates
7. **Configure Automation** — Create workflows
8. **Build Dashboard** — Pipeline health reports
9. **Train Team** — CRM usage best practices
10. **Launch Outreach** — Start Tier 1 campaigns

---

**Related Documents:**
- [ICP Profile](./icp-profile.md)
- [Lead List](./lead-list.md)
- [Pipeline Stages](./pipeline-stages.md)
- [Outreach Sequences](./outreach-sequences.md)
- [PIPELINE-SUMMARY.md](./PIPELINE-SUMMARY.md)
