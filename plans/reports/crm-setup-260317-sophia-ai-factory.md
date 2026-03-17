# CRM Integration & Setup Guide — Sophia AI Video Factory

**Generated:** 2026-03-17
**Version:** 1.0
**Owner:** Sales/Revenue Team
**Input:** Customer Research (3 personas) + Pipeline Strategy (7 stages) + Email Sequences (51 templates)

---

## Executive Summary

### CRM Setup Overview

| Component | Recommendation | Timeline | Owner |
|-----------|---------------|----------|-------|
| **CRM Platform** | HubSpot Sales Hub (Professional) | Week 1 | Ops Lead |
| **Pipeline Stages** | 7 stages (Prospect → Closed Won/Lost) | Week 1 | Sales Lead |
| **Lead Scoring** | 100-point scale (firmographic + behavioral) | Week 1 | Marketing + Ops |
| **Data Import** | CSV template + manual enrichment | Week 2 | SDR |
| **Integrations** | Polar.sh, Calendly, Zoom, Slack, Gmail | Week 2 | Ops |
| **Automation Rules** | 12 triggers + 8 workflows | Week 2-3 | Ops + Sales Lead |
| **Dashboards** | 5 views + 15 metrics | Week 3 | Ops |
| **Team Training** | Role-based onboarding | Week 3 | Sales Lead |
| **Full Launch** | All systems live | Week 4 | All |

### Investment Required

| Item | Cost | Billing |
|------|------|---------|
| **HubSpot Sales Hub Pro** | $800/month | Annual prepay ($9,600/yr) |
| **HubSpot Operations Starter** | $100/month | Monthly |
| **Clearbit (Enrichment)** | $200/month | Monthly |
| **PandaDoc (Proposals)** | $49/month × 5 seats = $245/month | Monthly |
| **Calendly Pro** | $15/month × 5 seats = $75/month | Monthly |
| **Total Monthly** | **$1,420/month** | — |
| **Total Annual** | **$12,660/year** (prepay discount: ~$11,400) | — |

**ROI Calculation:** At $116K/month target pipeline velocity, CRM pays for itself in **3.5 hours** of closed deals.

---

## 1. CRM Platform Selection

### 1.1 Platform Comparison Matrix

| Criteria | **HubSpot** | Pipedrive | Close.com | Salesforce |
|----------|-------------|-----------|-----------|------------|
| **Pricing (5 users)** | $800/mo (Pro) | $249/mo (Pro) | $495/mo (Pro) | $1,500+/mo (Pro) |
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Email Automation** | Built-in | Add-on ($20/mo) | Built-in | Add-on ($50+/mo) |
| **Lead Scoring** | Built-in (Pro) | Add-on | Built-in | Built-in |
| **Custom Objects** | ✅ (Pro) | ❌ | ❌ | ✅ (Enterprise) |
| **API Rate Limit** | 10,000/day | 10,000/day | 5,000/day | 25,000/day |
| **Polar.sh Integration** | Webhooks (easy) | Webhooks (easy) | Webhooks (medium) | Flow/Heroku (complex) |
| **Slack Integration** | Native | Native | Native | Native |
| **Calendly Integration** | Native | Native | Native | Native |
| **Reporting** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Mobile App** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Support Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Best For** | **SMB + Scale-up** | Small sales teams | Remote sales | Enterprise |

### 1.2 Pricing Tier Analysis

#### HubSpot Sales Hub Tiers

| Feature | Free | Starter ($20/user/mo) | Professional ($80/user/mo) | Enterprise ($120/user/mo) |
|---------|------|----------------------|---------------------------|--------------------------|
| **Users** | Unlimited | Min 2 | Min 5 | Min 10 |
| **Companies** | 1M | 1,000 | 10,000 | 10,000+ |
| **Email Sending** | 2,000/mo | 5,000/mo | 50,000/mo | 100,000/mo |
| **Lead Scoring** | ❌ | ❌ | ✅ | ✅ |
| **Custom Properties** | 25 | 25 | 300 | 1,000+ |
| **Automation Workflows** | ❌ | ✅ (single-step) | ✅ (multi-step) | ✅ (advanced) |
| **Forecasting** | ❌ | ❌ | ✅ | ✅ (AI-powered) |
| **Conversation Intelligence** | ❌ | ❌ | ✅ (calls) | ✅ (calls + coaching) |
| **Sandbox Environment** | ❌ | ❌ | ❌ | ✅ |
| **Our Recommendation** | ❌ | ❌ | ✅ **SELECTED** | ❌ (overkill) |

**Why HubSpot Professional:**
- Lead scoring built-in (critical for 100-point scoring model)
- Multi-step automation workflows (stage changes, task creation)
- Advanced reporting + forecasting
- 50,000 emails/month included (covers all sequences)
- Scales to 10,000 companies (enough for 18-month growth)

### 1.3 Integration Requirements Checklist

| Integration | Required For | HubSpot Support | Setup Complexity |
|-------------|--------------|-----------------|------------------|
| **Polar.sh Webhooks** | Closed-won → subscription | ✅ Webhooks + API | Medium (custom) |
| **Email Provider (Gmail)** | Sequence sending | ✅ Native | Easy |
| **Calendly** | Demo booking | ✅ Native (2-way sync) | Easy (15 min) |
| **Zoom** | Demo tracking | ✅ Native (2-way sync) | Easy (15 min) |
| **Slack Notifications** | Deal alerts | ✅ Native app | Easy (10 min) |
| **Clearbit** | Lead enrichment | ✅ Native app | Easy (30 min) |
| **PandaDoc** | Proposal tracking | ✅ Native app | Medium (1 hr) |

### 1.4 Final Recommendation: HubSpot Sales Hub Professional

**Justification:**

1. **Best-in-class automation** — Multi-step workflows for lead scoring, stage changes, task creation
2. **Native integrations** — All required tools (Calendly, Zoom, Slack, Clearbit, PandaDoc) have native apps
3. **Scalable pricing** — $800/mo for 5 users, scales to 10 users at $1,200/mo (still < Salesforce)
4. **Email included** — 50,000 emails/month covers all 51 email sequences without ESP cost
5. **Free migration support** — HubSpot offers free onboarding + data migration for Pro tier
6. **Vietnam-friendly** — No geographic restrictions, supports Vietnamese timezone

**Alternative (Budget Option):** Pipedrive Pro at $249/mo if budget is critical constraint, but loses:
- Email automation (requires separate ESP: $200-500/mo)
- Advanced lead scoring
- Multi-step workflows

---

## 2. Pipeline Configuration

### 2.1 Map 7 Pipeline Stages to HubSpot

HubSpot Deal Pipeline Configuration:

```
SETTINGS → SALES → DEALS → PIPELINES → CREATE PIPELINE
Pipeline Name: "Sophia AI Factory Sales Pipeline"
Currency: USD
```

| Stage # | Stage Name | Probability | Expected Days | Exit Criteria |
|---------|------------|-------------|---------------|---------------|
| **1** | 01 - Prospect | 5% | 1-3 | Lead score ≥ 30, basic BANT |
| **2** | 02 - Qualified | 20% | 2-5 | Lead score ≥ 50, full BANT confirmed |
| **3** | 03 - Demo | 40% | 3-7 | Demo completed, next step scheduled |
| **4** | 04 - Proposal | 60% | 5-10 | Proposal sent, walkthrough scheduled |
| **5** | 05 - Negotiation | 80% | 7-14 | Terms agreed, legal review |
| **6** | 06 - Closed Won | 100% | N/A | Contract signed, payment received |
| **7** | 07 - Closed Lost | 0% | N/A | Lost reason documented |

**Closed Lost Reasons (Dropdown):**
- No Decision (Ghosted)
- Competitor (Specify in notes)
- Budget Cut/Frozen
- Timing Not Right
- Missing Features
- Pricing Objection

### 2.2 Custom Properties Setup

Navigate to: **SETTINGS → PROPERTIES → DEAL PROPERTIES → CREATE PROPERTY**

#### Core Deal Properties

| Property Label | Internal Name | Type | Options/Format | Required Stage |
|----------------|---------------|------|----------------|----------------|
| **Lead Score Total** | `lead_score_total` | Number | 0-100 | Stage 1 |
| **Lead Score Firmographic** | `lead_score_firmo` | Number | 0-40 | Stage 1 |
| **Lead Score Behavioral** | `lead_score_behavioral` | Number | 0-40 | Stage 2 |
| **Lead Score Timing** | `lead_score_timing` | Number | 0-20 | Stage 2 |
| **Segment** | `segment` | Dropdown | Agency, SME, Enterprise | Stage 1 |
| **Company Size** | `company_size` | Dropdown | 1-10, 11-50, 51-200, 201-500, 500+ | Stage 1 |
| **Industry** | `industry` | Dropdown | Marketing Agency, Ecommerce, SaaS, F&B, Finance, Tech, Manufacturing, Other | Stage 1 |
| **Lead Source** | `lead_source` | Dropdown | Website, LinkedIn, Cold Email, Referral, Paid Ads, Event, Content Download | Stage 1 |
| **BANT Confirmed** | `bant_confirmed` | Boolean | Yes/No | Stage 2 |
| **Current Video Spend (Monthly)** | `current_video_spend` | Currency | $ | Stage 2 |
| **Current Video Volume (Monthly)** | `current_video_volume` | Number | Videos | Stage 2 |
| **Target Video Volume (Monthly)** | `target_video_volume` | Number | Videos | Stage 2 |
| **Budget Range** | `budget_range` | Dropdown | <$100/mo, $100-500/mo, $500-2K/mo, $2K-10K/mo, $10K+/mo | Stage 2 |
| **Decision Makers** | `decision_makers` | Text Area | Names + titles | Stage 2 |
| **Use Case** | `use_case` | Dropdown | Social Content, Product Videos, Training, Internal Comms, Ads, Other | Stage 2 |
| **Pain Points** | `pain_points` | Text Area | Description | Stage 2 |
| **Timeline** | `timeline` | Dropdown | Immediately, This Month, Next Quarter, 6+ Months | Stage 2 |
| **Demo Date** | `demo_date` | Date | YYYY-MM-DD | Stage 3 |
| **Demo Notes** | `demo_notes` | Text Area | Feedback, objections, questions | Stage 3 |
| **Proposal Sent Date** | `proposal_sent_date` | Date | YYYY-MM-DD | Stage 4 |
| **Proposal Value (ACV)** | `proposal_value` | Currency | $ | Stage 4 |
| **Pricing Tier Selected** | `pricing_tier` | Dropdown | Starter ($19), Growth ($79), Premium ($199), Master ($499) | Stage 4 |
| **Competitor Name** | `competitor_name` | Text | Competitor being evaluated | Stage 4 |
| **Objections** | `objections` | Text Area | List of objections raised | Stage 4 |
| **Negotiation Notes** | `negotiation_notes` | Text Area | Terms discussion, concessions | Stage 5 |
| **Contract Status** | `contract_status` | Dropdown | Draft Sent, Under Review, Redlined, Approved, Signed | Stage 5 |
| **Close Date** | `close_date` | Date | YYYY-MM-DD | Stage 5 |
| **Close Reason (Lost)** | `close_reason` | Dropdown | See Closed Lost Reasons above | Stage 7 |
| **Champion Name** | `champion_name` | Text | Internal advocate | Stage 3 |
| **Technical Requirements** | `tech_requirements` | Multi-Checkbox | SSO/SAML, API Access, Custom Integration, SLA, Dedicated Support | Stage 3 |
| **ROI Calculated** | `roi_calculated` | Currency | $ savings | Stage 3 |
| **Payback Period (Months)** | `payback_period` | Number | Months | Stage 3 |
| **Next Step** | `next_step` | Text | Action item | All stages |
| **Next Step Date** | `next_step_date` | Date | YYYY-MM-DD | All stages |
| **Polar.sh Customer ID** | `polar_customer_id` | Text | Customer ID from Polar | Stage 6 |
| **Onboarding Status** | `onboarding_status` | Dropdown | Not Started, In Progress, Complete | Stage 6 |

#### Contact Properties (Auto-sync from Lead)

| Property | Type | Description |
|----------|------|-------------|
| **Job Title** | Text | From LinkedIn/form |
| **Department** | Dropdown | Marketing, IT, Operations, Executive, Other |
| **LinkedIn URL** | URL | Profile link |
| **Lead Owner** | User | Assigned SDR/AE |

### 2.3 Automation Triggers Configuration

Navigate to: **SETTINGS → AUTOMATION → WORKFLOWS → CREATE WORKFLOW**

#### Workflow 1: New Lead Creation

**Trigger:** Deal created OR Form submission (Website contact form)

**Actions:**
1. Set `lead_score_total` = 20 (baseline)
2. Set stage = "01 - Prospect"
3. Create task for SDR: "Call lead within 24 hours" (Due: Tomorrow 9 AM)
4. Enroll in email sequence: "Post-Download Nurture" (if form submit) OR "Cold Outreach - [Segment]" (if inbound)
5. Send Slack notification to #sales-alerts: "New lead: {{dealname}} from {{company}} (Segment: {{segment}})"

---

#### Workflow 2: Lead Score Update

**Trigger:** `lead_score_total` changes

**Conditions:**
- IF `lead_score_total` >= 70:
  - Update stage = "02 - Qualified"
  - Create task for AE: "Call high-intent lead within 1 hour" (Due: Today 5 PM)
  - Send Slack notification to #sales-alerts: "HOT LEAD: {{dealname}} (Score: {{lead_score_total}})"
  - Send email to lead: "Thanks for your interest — scheduling next steps"

- IF `lead_score_total` >= 50 AND < 70:
  - Update stage = "02 - Qualified"
  - Create task for SDR: "Qualify lead (BANT discovery)" (Due: 2 days)

- IF `lead_score_total` < 30:
  - No action (stay in nurture)

---

#### Workflow 3: Demo Booked (Calendly Webhook)

**Trigger:** Calendly event scheduled (Webhook)

**Actions:**
1. Update stage = "03 - Demo"
2. Set `demo_date` = {{calendly_event_time}}
3. Create task for AE: "Prep demo for {{dealname}}" (Due: Day before demo)
4. Send email to lead: "Demo confirmation + agenda" (Template: Demo Confirmation)
5. Add Zoom link to Calendly confirmation (via integration)

---

#### Workflow 4: Demo Completed (Zoom Webhook)

**Trigger:** Zoom meeting ended (Webhook)

**Actions:**
1. Create task for AE: "Send demo recording + next steps" (Due: Today 5 PM)
2. Create task for AE: "Send proposal within 48 hours" (Due: 2 days)
3. Enroll in email sequence: "Post-Demo Nurture" (5 emails)
4. Send Slack notification to #sales-alerts: "Demo completed: {{dealname}} → Proposal due {{proposal_due_date}}"

---

#### Workflow 5: Proposal Sent

**Trigger:** `proposal_sent_date` is set

**Actions:**
1. Update stage = "04 - Proposal"
2. Create task for AE: "Follow up on proposal" (Due: 3 days)
3. Enroll in email sequence: "Proposal Follow-Up" (3 emails)

---

#### Workflow 6: Proposal Opened (PandaDoc Webhook)

**Trigger:** PandaDoc document opened (Webhook)

**Actions:**
1. Send Slack notification to #sales-alerts: "{{contactname}} opened proposal for {{dealname}}"
2. Create task for AE: "Call to discuss proposal" (Due: Today 5 PM)

---

#### Workflow 7: Proposal Unopened (7 Days)

**Trigger:** `proposal_sent_date` = 7 days ago AND `proposal_opened` = false

**Actions:**
1. Send email: "Did you see this? + social proof"
2. Create task for AE: "Call to confirm receipt" (Due: Tomorrow 10 AM)

---

#### Workflow 8: Deal Stuck (>14 Days No Activity)

**Trigger:** Deal last modified > 14 days ago

**Actions:**
1. Send Slack notification to #sales-alerts: "STUCK DEAL: {{dealname}} ({{days_since_activity}} days)"
2. Create task for Sales Manager: "Review stuck deal: {{dealname}}"
3. Send email to lead: "Checking in + new case study"

---

#### Workflow 9: Deal Closed Won

**Trigger:** Stage = "06 - Closed Won"

**Actions:**
1. Send Slack notification to #wins: "WON DEAL: {{dealname}} - {{proposal_value}} ACV :tada:"
2. Create task for CSM: "Schedule onboarding call" (Due: 2 days)
3. Send email to customer: "Welcome to Sophia AI Factory + onboarding steps"
4. **Create Polar.sh subscription** (via webhook/API call)
   - Map `pricing_tier` to Polar product ID
   - Create customer in Polar.sh
   - Store `polar_customer_id` in HubSpot
5. Update `onboarding_status` = "Not Started"

---

#### Workflow 10: Deal Closed Lost

**Trigger:** Stage = "07 - Closed Lost"

**Actions:**
1. Enroll in email sequence: "Re-Engagement Nurture" (quarterly check-ins)
2. Create task for AE: "Send feedback survey" (Due: 3 days)
3. Create task for AE: "Re-engage in 90 days" (Due: 90 days)
4. Send Slack notification to #sales-alerts: "LOST DEAL: {{dealname}} - Reason: {{close_reason}}"

---

#### Workflow 11: Round-Robin Lead Assignment

**Trigger:** Deal created AND `lead_owner` is empty

**Actions:**
1. Rotate through SDR list: SDR-A → SDR-B → SDR-C → SDR-A...
2. Assign `lead_owner` = {{sdr}}
3. Send Slack DM to SDR: "New lead assigned: {{dealname}}"

---

#### Workflow 12: Segment-Based Assignment

**Trigger:** `segment` property is set

**Conditions:**
- IF `segment` = "Agency" OR "SME":
  - Assign to SDR team
- IF `segment` = "Enterprise":
  - Assign to AE team
  - Send Slack notification to #enterprise-sales

### 2.4 Dashboard Views per Role

Navigate to: **REPORTS → DASHBOARDS → CREATE DASHBOARD**

#### SDR Dashboard (Individual Contributor)

**Dashboard Name:** "SDR Pipeline — {{user_name}}"

| Report | Type | Filter | Refresh |
|--------|------|--------|---------|
| **My Tasks Due Today** | Task List | Owner = Me, Due = Today | Real-time |
| **My Pipeline by Stage** | Funnel | Owner = Me | Real-time |
| **Leads to Contact (<24h)** | List | Owner = Me, Created < 24h, Stage = 01 | Real-time |
| **High-Score Leads (≥70)** | List | Owner = Me, Lead Score ≥ 70 | Real-time |
| **Demos Booked (This Week)** | Metric | Owner = Me, Demo Date = This Week | Daily |
| **Conversion Rate (Prospect→Qualified)** | Metric | Owner = Me | Weekly |

---

#### AE Dashboard (Account Executive)

**Dashboard Name:** "AE Pipeline — {{user_name}}"

| Report | Type | Filter | Refresh |
|--------|------|--------|---------|
| **My Pipeline by Stage** | Funnel | Owner = Me | Real-time |
| **Proposals Sent (Awaiting Response)** | List | Owner = Me, Stage = 04, Proposal Sent > 3 days | Daily |
| **Deals in Negotiation** | List | Owner = Me, Stage = 05 | Real-time |
| **Closing This Month** | List | Owner = Me, Close Date = This Month | Daily |
| **Demo Show Rate** | Metric | Owner = Me, Demo Date = Last 30 days | Weekly |
| **Proposal Win Rate** | Metric | Owner = Me, Stage = 04-06 | Weekly |
| **Pipeline Velocity** | Metric | Owner = Me | Weekly |

---

#### Sales Manager Dashboard

**Dashboard Name:** "Sales Team Overview"

| Report | Type | Filter | Refresh |
|--------|------|--------|---------|
| **Team Pipeline by Stage** | Funnel | All Owners | Real-time |
| **Pipeline by Segment** | Pie Chart | All Deals | Weekly |
| **Pipeline by Lead Source** | Bar Chart | All Deals | Weekly |
| **Deals At Risk** | List | Stage = 05, Close Date < 30 days | Daily |
| **Stuck Deals (>14 days)** | List | Last Activity > 14 days | Daily |
| **High-Value Deals (>$10K ACV)** | List | Proposal Value > $10,000 | Real-time |
| **SDR Performance** | Table | All SDRs, Metrics: Leads contacted, Qualified rate, Demos booked | Daily |
| **AE Performance** | Table | All AEs, Metrics: Demos→Proposal, Proposal→Won, Avg cycle length | Weekly |
| **Forecast vs Actual (This Month)** | Gauge | Close Date = This Month | Daily |
| **Pipeline Coverage** | Metric | Total Pipeline / Monthly Quota | Weekly |

---

#### Executive Dashboard (CMO/CEO)

**Dashboard Name:** "Revenue Overview"

| Report | Type | Filter | Refresh |
|--------|------|--------|---------|
| **MRR Generated (This Month)** | Metric | Stage = 06, Close Date = This Month | Daily |
| **Pipeline Velocity** | Metric | All Deals | Weekly |
| **Win Rate by Segment** | Bar Chart | All Deals, Grouped by Segment | Weekly |
| **CAC by Segment** | Metric | Marketing Spend / New Customers | Monthly |
| **LTV:CAC Ratio** | Metric | LTV / CAC | Monthly |
| **Forecast Accuracy** | Metric | Forecast vs Actual | Monthly |
| **Revenue by Lead Source** | Pie Chart | Stage = 06 | Monthly |

---

## 3. Data Import Strategy

### 3.1 Lead Data CSV Template

Download template from: **CONTACTS → IMPORT → CREATE TEMPLATE → DOWNLOAD CSV TEMPLATE**

#### Contacts CSV Headers

```csv
Email,First Name,Last Name,Job Title,Company,LinkedIn URL,Phone,Lead Source,Segment,Lead Owner
```

**Example Row:**
```csv
anh@agencyexample.com,Anh,Nguyen,Founder/Creative Director,Agency Example Co,https://linkedin.com/in/anhnguyen,+84-90-123-4567,LinkedIn Outreach,Agency,sdr1@sophia.ai
```

---

#### Companies CSV Headers

```csv
Company Name,Website,Industry,Company Size,Annual Revenue,Location,Description
```

**Example Row:**
```csv
Agency Example Co,https://agencyexample.com,Marketing Agency,15,$1.2M,"Ho Chi Minh City,Vietnam","Digital marketing agency specializing in social content for F&B brands"
```

---

#### Deals CSV Headers

```csv
Deal Name,Company Name,Contact Email,Stage,Lead Score Total,Segment,Proposal Value,Close Date,Lead Source,Lead Owner,Current Video Spend,Current Video Volume,Target Video Volume,Use Case,Timeline,BANT Confirmed
```

**Example Row:**
```csv
Agency Example Co - Premium,Agency Example Co,anh@agencyexample.com,01 - Prospect,45,Agency,5988,2026-04-15,LinkedIn Outreach,sdr1@sophia.ai,$8000,40,100,Social Content,This Month,Yes
```

### 3.2 Company/Account Structure

HubSpot uses a **Company-Contact-Deal** hierarchy:

```
┌─────────────────────────────────────────────────────────┐
│  HUBSPOT DATA MODEL                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  COMPANY (Account)                                      │
│  ├── Name: Agency Example Co                            │
│  ├── Industry: Marketing Agency                         │
│  ├── Size: 15 employees                                 │
│  └── Annual Revenue: $1.2M                              │
│                                                         │
│  CONTACTS (Associated with Company)                     │
│  ├── Anh Nguyen (Founder) — Primary Decision Maker      │
│  ├── Chi Tran (Marketing Manager) — Champion            │
│  └── David Le (Operations) — Influencer                 │
│                                                         │
│  DEALS (Associated with Company)                        │
│  ├── Deal 1: "Agency Example Co - Premium Tier"         │
│  │   ├── Stage: 03 - Demo                               │
│  │   ├── Value: $5,988 ACV ($499/mo × 12)               │
│  │   └── Close Date: 2026-04-15                         │
│  └── Deal 2: "Agency Example Co - Add-on API"           │
│      ├── Stage: 04 - Proposal                           │
│      ├── Value: $2,400 ACV                              │
│      └── Close Date: 2026-05-01                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Import Order:**
1. Companies first
2. Contacts (associate with companies via Email or Company Name)
3. Deals (associate with companies via Company Name)

### 3.3 Contact Properties Mapping

| Source Field | HubSpot Property | Transformation |
|--------------|------------------|----------------|
| `full_name` | `firstname` + `lastname` | Split on space |
| `email` | `email` | Lowercase, trim |
| `company` | `company` | Match to existing or create new |
| `job_title` | `jobtitle` | As-is |
| `linkedin_url` | `linkedinbio` | Validate URL format |
| `phone` | `phone` | Format: +[country]-[number] |
| `lead_source` | `hs_lead_source` | Map to dropdown options |
| `segment` | `segment` (custom) | Agency/SME/Enterprise |
| `lead_owner` | `hubspot_owner_id` | Map to HubSpot user ID |

### 3.4 Historical Data Migration

**If migrating from another CRM:**

1. **Export from source CRM** (Salesforce, Pipedrive, etc.)
   - Use native export or CSV export
   - Include all custom fields

2. **Map fields to HubSpot properties**
   - Use HubSpot's import mapping tool
   - Create missing custom properties before import

3. **Clean data before import**
   - Remove duplicates (use email as unique key)
   - Standardize date formats (YYYY-MM-DD)
   - Validate email addresses (use Clearbit enrichment)

4. **Import in batches**
   - Batch 1: Companies (1,000 records)
   - Batch 2: Contacts (5,000 records)
   - Batch 3: Deals (2,000 records)
   - Test with 50 records first

5. **Verify post-import**
   - Check record counts
   - Spot-check 10 random records
   - Verify associations (Company→Contact→Deal)

**If starting fresh (no historical data):**
- Skip historical import
- Start with current pipeline only
- Build organic growth

---

## 4. Integration Setup

### 4.1 Polar.sh Webhook → CRM Deal Creation

**Objective:** Automatically create/update HubSpot deal when subscription purchased via Polar.sh

#### Step 1: Configure Polar.sh Webhook

1. Login to Polar.sh Dashboard → Settings → Webhooks
2. Add webhook endpoint: `https://api.hubapi.com/webhooks/v1/{portal_id}/{endpoint_id}`
   - Note: Requires HubSpot webhook setup first (see Step 2)
3. Select events:
   - ✅ `subscription.created`
   - ✅ `subscription.updated`
   - ✅ `subscription.activated`
   - ✅ `subscription.canceled`
4. Secret: Generate and store securely (for webhook signature verification)

#### Step 2: Create HubSpot Webhook

1. Go to HubSpot Developer Portal → Apps → Create App
2. Configure webhook subscription:
   ```json
   {
     "subscriptionType": "DEAL",
     "eventType": "CREATION",
     "property": "*",
     "appId": YOUR_APP_ID
   }
   ```
3. Copy webhook URL and secret

#### Step 3: Create Middleware (Optional but Recommended)

Use Zapier or Make.com to bridge Polar.sh → HubSpot:

**Zapier Setup:**
1. Trigger: Polar.sh → "New Subscription"
2. Action: HubSpot → "Create Deal"
3. Field mapping:
   ```
   Polar.sh Field → HubSpot Deal Property
   ├── customer_email → Contact Email (lookup)
   ├── product_name → Pricing Tier (map: "Premium" → "$499")
   ├── mrr → Proposal Value (calculate: mrr × 12)
   ├── status → Stage (map: "active" → "06 - Closed Won")
   └── created_at → Close Date
   ```
4. Test Zap → Turn on

**Alternative (Custom API):**
```python
# middleware/polar_to_hubspot.py
from fastapi import FastAPI, Request
import httpx

app = FastAPI()

HUBSPOT_API_KEY = "pat-na1-..."
HUBSPOT_PORTAL_ID = "12345678"

@app.post("/webhook/polar")
async def polar_webhook(request: Request):
    payload = await request.json()

    # Extract Polar.sh data
    customer_email = payload["subscription"]["customer_email"]
    product_name = payload["subscription"]["product_name"]
    mrr = payload["subscription"]["mrr"]
    status = payload["subscription"]["status"]

    # Map to HubSpot deal properties
    deal_properties = {
        "dealname": f"{customer_email} - {product_name}",
        "amount": mrr * 12,  # ACV
        "dealstage": "06 - Closed Won" if status == "active" else "01 - Prospect",
        "pipeline": "sophia-sales-pipeline",
        "polar_customer_id": payload["subscription"]["id"],
        "pricing_tier": map_tier(product_name),
    }

    # Create/update HubSpot deal
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.hubapi.com/crm/v3/objects/deals",
            headers={"Authorization": f"Bearer {HUBSPOT_API_KEY}"},
            json={"properties": deal_properties}
        )

    return {"status": "success", "deal_id": response.json()["id"]}
```

---

### 4.2 Email Provider Sync (Gmail)

**Objective:** Sync Gmail for sequence sending + email tracking

#### Step 1: Connect Gmail to HubSpot

1. Go to **SETTINGS → INTEGRATIONS → CONNECTED ACCOUNTS**
2. Click "Connect Account" under Gmail
3. Authenticate with Google account
4. Select sync options:
   - ✅ Sync emails
   - ✅ Sync calendar events
   - ✅ Track email opens/clicks
   - ✅ Log sent emails automatically

#### Step 2: Configure Email Tracking

1. Go to **SETTINGS → SALES → EMAIL → TRACKING**
2. Enable:
   - ✅ Email open tracking
   - ✅ Link click tracking
   - ✅ Reply tracking
3. Add tracking domain (recommended for deliverability):
   - CNAME record: `track.sophia.ai` → HubSpot tracking domain

#### Step 3: Setup Email Templates

Import the 51 email templates from `email-outreach-260317-sophia-ai-factory.md`:

1. Go to **SALES → EMAIL → TEMPLATES → CREATE TEMPLATE**
2. Create folders:
   - Cold Outreach (Agency, SME, Enterprise)
   - Nurture Sequences (Post-Download, Post-Demo, Post-Trial, Re-Engagement)
   - Sales Sequences (Demo Confirmation, Proposal Follow-Up, Closing)
3. Copy templates from source document
4. Add personalization tokens:
   - `{{contact.firstname}}`
   - `{{company.name}}`
   - `{{deal.amount}}`
   - `{{owner.firstname}}` (sender name)

---

### 4.3 Calendly Integration for Demo Booking

**Objective:** 2-way sync between Calendly and HubSpot for demo scheduling

#### Step 1: Install Calendly App

1. Go to HubSpot Marketplace → Search "Calendly" → Install
2. Authenticate with Calendly account
3. Select Calendly event types to sync:
   - ✅ "Sophia AI Demo (30 min)"
   - ✅ "Sophia AI Enterprise POC (60 min)"

#### Step 2: Configure Webhook Events

In Calendly Dashboard → Settings → Integrations → HubSpot:

| Event | HubSpot Action |
|-------|----------------|
| **Invitee Created** | Create deal (if not exists) |
| **Invitee Shows** | Update `demo_date`, set stage = "03 - Demo" |
| **Invitee No-Shows** | Create task: "Reschedule demo" |
| **Event Completed** | Create task: "Send proposal within 48h" |

#### Step 3: Embed Calendly in HubSpot Meetings

1. Go to **SALES → MEETINGS → CREATE MEETING**
2. Select "Use external meeting link"
3. Paste Calendly booking URL
4. Add to email sequences:
   - Cold Outreach Email 3: "Book a demo" CTA
   - Post-Demo Email 1: "Schedule follow-up" CTA

---

### 4.4 Zoom Integration for Demo Delivery

**Objective:** Auto-log Zoom meetings + send recordings

#### Step 1: Install Zoom App

1. Go to HubSpot Marketplace → Search "Zoom" → Install
2. Authenticate with Zoom account
3. Configure meeting settings:
   - Auto-generate personal meeting room for each AE
   - Enable cloud recording

#### Step 2: Configure Webhook Events

In Zoom Marketplace → HubSpot Integration:

| Event | HubSpot Action |
|-------|----------------|
| **Meeting Started** | Log activity on deal |
| **Meeting Ended** | Create task: "Send recording" |
| **Recording Ready** | Attach recording URL to deal notes |

#### Step 3: Auto-Send Demo Recording

Create workflow (see Section 2.3, Workflow 4):
- Trigger: Zoom meeting ended
- Action: Send email with recording link + next steps template

---

### 4.5 Slack Notifications for Key Events

**Objective:** Real-time alerts for sales team

#### Step 1: Install HubSpot Slack App

1. Go to Slack App Directory → Search "HubSpot" → Add to Workspace
2. Authenticate with HubSpot account
3. Select channels:
   - #sales-alerts (all deal updates)
   - #wins (closed won only)
   - #enterprise-sales (enterprise deals only)

#### Step 2: Configure Notification Triggers

In HubSpot → Settings → Integrations → Slack:

| Trigger | Channel | Message Format |
|---------|---------|----------------|
| **New Lead Created** | #sales-alerts | "New lead: {{dealname}} ({{segment}})" |
| **Lead Score ≥ 70** | #sales-alerts | "HOT LEAD: {{dealname}} (Score: {{score}})" |
| **Demo Booked** | #sales-alerts | "Demo scheduled: {{dealname}} on {{demo_date}}" |
| **Proposal Sent** | #sales-alerts | "Proposal sent: {{dealname}} ({{amount}})" |
| **Deal Closed Won** | #wins | "WON DEAL: {{dealname}} - {{amount}} ACV :tada:" |
| **Deal Closed Lost** | #sales-alerts | "LOST: {{dealname}} - Reason: {{close_reason}}" |
| **Deal Stuck (>14d)** | #sales-alerts | "STUCK: {{dealname}} ({{days}} days)" |

---

## 5. CRM Automation Rules

### 5.1 Lead Assignment Rules

#### Round-Robin Assignment (Equal Distribution)

**Setup:** SETTINGS → USERS & TEAMS → TEAMS → CREATE TEAM

1. Create team: "SDR Team"
2. Add members: SDR-1, SDR-2, SDR-3
3. Enable round-robin: ✅
4. Set rotation: "When deal created"

**Workflow:**
```
New Lead → Round-Robin → Assign to SDR-N → Next = SDR-(N+1)
```

---

#### Territory-Based Assignment (Geographic)

**Setup:** SETTINGS → AUTOMATION → WORKFLOWS → CREATE WORKFLOW

**Trigger:** Deal created

**Conditions:**
```
IF Company.Location CONTAINS "Vietnam" OR "HCMC" OR "Hanoi"
  → Assign to SDR-Vietnam team

IF Company.Location CONTAINS "Singapore" OR "Thailand"
  → Assign to SDR-SEA team

IF Company.Location CONTAINS "US" OR "UK" OR "EU"
  → Assign to SDR-Global team
```

---

#### Segment-Based Assignment (Agency/SME/Enterprise)

**Setup:** SETTINGS → AUTOMATION → WORKFLOWS → CREATE WORKFLOW

**Trigger:** `segment` property is set

**Conditions:**
```
IF segment = "Agency" OR "SME"
  → Assign to SDR team
  → Enroll in "Self-Serve Nurture" sequence

IF segment = "Enterprise"
  → Assign to AE team
  → Enroll in "Enterprise POC" sequence
  → Notify Sales Manager via Slack
```

---

### 5.2 Task Creation Triggers

| Trigger | Task Type | Assigned To | Due Date | Priority |
|---------|-----------|-------------|----------|----------|
| **New Lead Created** | Call lead within 24h | SDR (round-robin) | Tomorrow 9 AM | High |
| **Lead Score ≥ 70** | Call high-intent lead | AE | Today 5 PM | Urgent |
| **Demo Booked** | Prep demo | AE | Day before demo | High |
| **Demo Completed** | Send proposal | AE | 2 days | High |
| **Proposal Opened** | Call to discuss | AE | Today 5 PM | High |
| **Proposal Unopened (7d)** | Call to confirm receipt | AE | Tomorrow 10 AM | Medium |
| **Deal Stuck (>14d)** | Review and re-engage | Sales Manager | 3 days | Medium |
| **Closed Won** | Schedule onboarding | CSM | 2 days | High |
| **Closed Lost** | Send feedback survey | AE | 3 days | Low |

---

### 5.3 Email Sequence Enrollment Triggers

| Sequence | Enrollment Trigger | Exit Condition |
|----------|-------------------|----------------|
| **Cold Outreach - Agency** | Lead source = "LinkedIn Outreach" AND segment = "Agency" | Demo booked OR Reply received |
| **Cold Outreach - SME** | Lead source = "Paid Ads" AND segment = "SME" | Demo booked OR Reply received |
| **Cold Outreach - Enterprise** | Lead source = "Event" AND segment = "Enterprise" | Demo booked OR Reply received |
| **Post-Download Nurture** | Form submit (website) | Demo booked OR 30 days elapsed |
| **Post-Demo Nurture** | Demo completed | Proposal sent OR deal closed |
| **Post-Trial Nurture** | Trial started | Upgrade OR trial expired |
| **Proposal Follow-Up** | Proposal sent | Deal closed OR 14 days elapsed |
| **Re-Engagement** | Deal closed lost | Reply received OR re-qualified |

---

### 5.4 Lead Score Update Automation

**Setup:** SETTINGS → AUTOMATION → WORKFLOWS → CREATE WORKFLOW

**Workflow:** "Lead Score Calculation"

**Trigger:** Contact property changed OR Deal property changed

**Actions:**

1. **Firmographic Score (0-40 points):**
   ```
   Company Size:
   - 500+ employees: +20
   - 201-500 employees: +15
   - 51-200 employees: +10
   - 11-50 employees: +5
   - 1-10 employees: +0

   Industry:
   - Marketing Agency: +10
   - Ecommerce/SaaS: +8
   - F&B/Retail: +5
   - Other: +0

   Location:
   - Vietnam/Singapore/Thailand: +5
   - SEA region: +3
   - Other: +0

   Annual Revenue:
   - $5M+: +5
   - $1M-5M: +3
   - <$1M: +0
   ```

2. **Behavioral Score (0-40 points):**
   ```
   Website Activity:
   - Visited pricing page: +5
   - Downloaded case study: +10
   - Attended webinar: +15
   - Started free trial: +20

   Email Engagement:
   - Opened 3+ emails: +5
   - Clicked link: +10
   - Replied to email: +15

   Product Usage (if trial):
   - Created 1+ videos: +10
   - Invited team members: +10
   - Used advanced features: +10
   ```

3. **Timing Score (0-20 points):**
   ```
   Timeline:
   - Immediately: +20
   - This Month: +15
   - Next Quarter: +10
   - 6+ Months: +0

   Budget Confirmed:
   - Budget allocated: +10
   - Budget exists: +5
   - No budget: +0

   Decision Makers Engaged:
   - C-level attending demo: +10
   - Manager level: +5
   - Individual contributor: +0
   ```

4. **Update Total Score:**
   ```
   lead_score_total = firmographic + behavioral + timing
   ```

---

## 6. Reporting & Dashboards

### 6.1 Pipeline Velocity Dashboard

**Dashboard:** REPORTS → DASHBOARDS → CREATE → "Pipeline Velocity"

#### Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **Pipeline Velocity** | (Opps × Win Rate × ACV) / Cycle Length | $2K-4K/day |
| **Opportunities** | Count of active deals | 300+ |
| **Win Rate** | Closed Won / (Closed Won + Closed Lost) | 8%+ |
| **ACV (Average Contract Value)** | Total ACV / Number of Deals | $3K-5K |
| **Sales Cycle Length** | Avg days from Stage 1 to Stage 6 | 14-45 days |

#### Visualization

```
┌─────────────────────────────────────────────────────────┐
│  PIPELINE VELOCITY TREND (Last 90 Days)                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  $5K/day ┤                                              │
│          │                                    ╭────╮   │
│  $4K/day ┤                          ╭─────────╯    ╰╮  │
│          │              ╭───────────╯              ╰╮ │
│  $3K/day ┤    ╭─────────╯                           ╰ │
│          │ ╭──╯                                       │
│  $2K/day ┤─╯                                          │
│          └──────────────────────────────────────────── │
│          Day 1   Day 30   Day 60   Day 90   Today      │
│                                                         │
│  Current Velocity: $3,895/day                          │
│  Trend: ↑ 12% vs. last 30 days                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6.2 Conversion Funnel by Stage

**Report:** REPORTS → CREATE REPORT → Funnel

#### Funnel Configuration

| Stage | Count | Conversion Rate | Target |
|-------|-------|-----------------|--------|
| **01 - Prospect** | 500 | 100% | — |
| **02 - Qualified** | 300 | 60% | 60%+ |
| **03 - Demo** | 120 | 40% (of original) | 40%+ |
| **04 - Proposal** | 75 | 25% (of original) | 25%+ |
| **05 - Negotiation** | 45 | 15% (of original) | 15%+ |
| **06 - Closed Won** | 40 | 8% (of original) | 8%+ |

#### Visualization

```
┌─────────────────────────────────────────────────────────┐
│  CONVERSION FUNNEL                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ████████████████████████████████████████  500 Prospect │
│  ██████████████████████████░░░░░░░░░░░░░░  300 Qualified│
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  120 Demo     │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  75 Proposal  │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  45 Negotiation
│  ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  40 Won       │
│                                                         │
│  Overall Win Rate: 8%                                   │
│  Avg Sales Cycle: 35 days                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6.3 SDR Performance Metrics

**Dashboard:** REPORTS → DASHBOARDS → CREATE → "SDR Performance"

#### Metrics per SDR

| SDR | Leads Assigned | Leads Contacted | Contact Rate | Qualified | Qual Rate | Demos Booked | Demo Rate |
|-----|----------------|-----------------|--------------|-----------|-----------|--------------|-----------|
| **SDR-1** | 150 | 135 | 90% | 65 | 43% | 25 | 17% |
| **SDR-2** | 150 | 120 | 80% | 55 | 37% | 20 | 13% |
| **SDR-3** | 150 | 142 | 95% | 72 | 48% | 30 | 20% |
| **Team Avg** | 150 | 132 | 88% | 64 | 43% | 25 | 17% |
| **Target** | 150 | 135 | 90% | 70 | 47% | 30 | 20% |

#### Activity Metrics

| SDR | Calls/Day | Emails/Day | LinkedIn Connects | Responses | Response Rate |
|-----|-----------|------------|-------------------|-----------|---------------|
| **SDR-1** | 40 | 60 | 30 | 12 | 8% |
| **SDR-2** | 35 | 55 | 25 | 9 | 6% |
| **SDR-3** | 45 | 65 | 35 | 15 | 10% |
| **Target** | 40 | 60 | 30 | 12 | 8% |

---

### 6.4 Forecast Accuracy Tracking

**Report:** REPORTS → CREATE REPORT → "Forecast vs Actual"

#### Monthly Forecast Accuracy

| Month | Forecast (Start of Month) | Actual (End of Month) | Accuracy | Variance |
|-------|---------------------------|----------------------|----------|----------|
| **Jan 2026** | $80,000 | $72,000 | 90% | -10% |
| **Feb 2026** | $85,000 | $88,000 | 97% | +4% |
| **Mar 2026** | $95,000 | $91,000 | 96% | -4% |
| **Q1 Average** | $86,667 | $83,667 | 94% | -3% |
| **Target** | — | — | 90%+ | ±10% |

#### Weighted Pipeline Forecast

| Scenario | Calculation | Forecast |
|----------|-------------|----------|
| **Commit (Conservative)** | Deals in Stage 5-6 × 90% probability | $45,000 |
| **Most Likely** | All deals × stage probability | $68,000 |
| **Upside (Aggressive)** | All deals × 1.2x probability | $82,000 |

---

### 6.5 Weekly/Monthly Report Templates

#### Weekly Sales Report (Sent Every Monday 9 AM)

**Template:**

```markdown
## WEEKLY SALES REPORT — Week of {DATE}

### PIPELINE SUMMARY
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Total Pipeline | ${amount} | ${amount} | +/-% |
| New Deals Added | ${amount} (${count}) | ${amount} | +/-% |
| Deals Closed Won | ${amount} (${count}) | ${amount} | +/-% |
| Deals Closed Lost | ${amount} (${count}) | ${amount} | +/-% |

### VELOCITY METRICS
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Pipeline Velocity | $/day | $2K-4K/day | 🟢/🟡/🔴 |
| Win Rate | % | 8%+ | 🟢/🟡/🔴 |
| Avg Sales Cycle | days | 14-45 days | 🟢/🟡/🔴 |

### TOP DEALS CLOSING THIS MONTH
| Deal Name | Value | Stage | Close Date | Confidence |
|-----------|-------|-------|------------|------------|
| {Deal 1} | ${amount} | 05 - Negotiation | {date} | High/Med/Low |
| {Deal 2} | ${amount} | 04 - Proposal | {date} | High/Med/Low |

### BLOCKERS & NEEDS
- {Blocker 1}
- {Blocker 2}

### WINS TO CELEBRATE 🎉
- {Win 1}
- {Win 2}
```

---

#### Monthly Sales Report (Sent First Day of Month)

**Template:**

```markdown
## MONTHLY SALES REPORT — {MONTH} {YEAR}

### EXECUTIVE SUMMARY
- **MRR Generated:** ${amount} (+/-% vs. last month)
- **New Customers:** ${count}
- **Pipeline Velocity:** ${amount}/day
- **Forecast Accuracy:** ${percentage}%

### REVENUE BREAKDOWN
| Segment | MRR | New MRR | Customers | Avg ACV |
|---------|-----|---------|-----------|---------|
| Agencies | ${amount} | ${amount} | ${count} | ${amount} |
| SMEs | ${amount} | ${amount} | ${count} | ${amount} |
| Enterprise | ${amount} | ${amount} | ${count} | ${amount} |
| **Total** | **${amount}** | **${amount}** | **${count}** | **${amount}** |

### FUNNEL METRICS
| Stage | Count | Conversion Rate | Target |
|-------|-------|-----------------|--------|
| Prospect | ${count} | 100% | — |
| Qualified | ${count} | ${percentage}% | 60%+ |
| Demo | ${count} | ${percentage}% | 40%+ |
| Proposal | ${count} | ${percentage}% | 25%+ |
| Closed Won | ${count} | ${percentage}% | 8%+ |

### UNIT ECONOMICS
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| CAC (Customer Acquisition Cost) | ${amount} | $100-500 | 🟢/🟡/🔴 |
| LTV (Lifetime Value) | ${amount} | $10K-150K | 🟢/🟡/🔴 |
| LTV:CAC Ratio | ${ratio}:1 | 3:1+ | 🟢/🟡/🔴 |
| CAC Payback Period | ${months} months | <6 months | 🟢/🟡/🔴 |

### TEAM PERFORMANCE
| Team Member | Quota | Achieved | % of Quota | Rank |
|-------------|-------|----------|------------|------|
| {SDR-1} | ${quota} | ${amount} | ${percentage}% | #1 |
| {SDR-2} | ${quota} | ${amount} | ${percentage}% | #2 |
| {AE-1} | ${quota} | ${amount} | ${percentage}% | #3 |

### LOOKING AHEAD: {NEXT_MONTH}
- **Focus:** {Priority 1}
- **Goal:** {Revenue target}
- **Key Initiatives:** {Initiative 1}, {Initiative 2}
```

---

## 7. Team Onboarding

### 7.1 User Roles and Permissions

Navigate to: **SETTINGS → USERS & TEAMS → USERS → ADD USER**

#### Role Definitions

| Role | HubSpot License | Permissions | Seats |
|------|-----------------|-------------|-------|
| **Sales Admin** | Enterprise | Full access + settings + user management | 1 (Ops Lead) |
| **Sales Manager** | Professional | View all deals, edit team deals, reporting | 1 (Sales Lead) |
| **Account Executive (AE)** | Professional | Own deals, proposals, demos, contracts | 2-3 |
| **Sales Development Rep (SDR)** | Professional | Own leads, outreach, qualify, book demos | 2-3 |
| **Customer Success (CSM)** | Starter | View won deals, onboarding tasks, health monitoring | 1 |
| **Marketing** | Starter | View lead source data, campaign attribution | 1 |
| **Executive (Viewer)** | Free | Read-only dashboards | 2 (CMO, CEO) |

**Total Seats:** 10 users
**Total Cost:** $800/mo (Pro tier includes 5 users, +$160/user/mo for additional)

---

#### Permission Matrix

| Permission | Sales Admin | Sales Manager | AE | SDR | CSM | Marketing |
|------------|-------------|---------------|-----|-----|-----|-----------|
| **View All Deals** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Edit All Deals** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Own Deals** | ✅ | ✅ | ✅ | ✅ | ✅ (won only) | ❌ |
| **Edit Own Deals** | ✅ | ✅ | ✅ | ✅ | ✅ (onboarding only) | ❌ |
| **Create Deals** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Deals** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View Reports** | ✅ | ✅ | ✅ (own) | ✅ (own) | ✅ (own) | ✅ |
| **Create Reports** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Manage Users** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Settings** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Export Data** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Manage Integrations** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Send Emails** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Email Analytics** | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | ✅ |

---

### 7.2 Training Checklist

#### Week 1: Platform Setup + Admin Training

| Task | Owner | Due | Status |
|------|-------|-----|--------|
| HubSpot account created | Ops Lead | Day 1 | ☐ |
| Pipeline stages configured | Sales Lead | Day 2 | ☐ |
| Custom properties created | Ops Lead | Day 2 | ☐ |
| Integrations connected (Gmail, Calendly, Zoom, Slack) | Ops Lead | Day 3-5 | ☐ |
| Sales Admin trained on settings | Ops Lead | Day 5 | ☐ |

---

#### Week 2: SDR/AE Training

| Task | Owner | Due | Status |
|------|-------|-----|--------|
| SDR pipeline + task management training | Sales Lead | Day 6 | ☐ |
| AE demo + proposal workflow training | Sales Lead | Day 7 | ☐ |
| Email sequences setup + personalization | Marketing | Day 8 | ☐ |
| Lead scoring rules explained | Sales Lead | Day 8 | ☐ |
| Role-play: Discovery call using CRM notes | Sales Lead | Day 9 | ☐ |
| Practice: Create deals, log activities | All | Day 10 | ☐ |

---

#### Week 3: Soft Launch + CSM Training

| Task | Owner | Due | Status |
|------|-------|-----|--------|
| Import first 50 leads (test batch) | SDR | Day 11 | ☐ |
| SDRs start outreach (5-10 leads/day) | SDR | Day 12-14 | ☐ |
| CSM onboarding workflow training | Sales Lead | Day 13 | ☐ |
| Dashboard review + feedback session | All | Day 14 | ☐ |
| Troubleshoot issues + refine workflows | Ops Lead | Day 15 | ☐ |

---

#### Week 4: Full Launch + Optimization

| Task | Owner | Due | Status |
|------|-------|-----|--------|
| All leads imported + assigned | SDR | Day 16 | ☐ |
| Full outreach volume (20-30 leads/day/SDR) | SDR | Day 17-21 | ☐ |
| First demos scheduled + completed | AE | Day 18-21 | ☐ |
| Weekly pipeline review (first session) | Sales Lead | Day 21 | ☐ |
| Post-launch retrospective + optimization | All | Day 22 | ☐ |

---

### 7.3 CRM Hygiene Best Practices

#### Daily Habits

| Practice | Frequency | Owner | Why It Matters |
|----------|-----------|-------|----------------|
| **Log all call notes** | After every call | All | Context for follow-up, audit trail |
| **Update deal stage** | When criteria met | All | Accurate forecasting |
| **Complete tasks** | By due date | All | Pipeline momentum |
| **Check "My Pipeline"** | Morning + EOD | All | Priority focus |
| **Respond to Slack alerts** | Within 1 hour | All | Speed to lead |

---

#### Weekly Habits

| Practice | Frequency | Owner | Why It Matters |
|----------|-----------|-------|----------------|
| **Pipeline review with manager** | Weekly | AE/SDR | Coaching, stuck deal review |
| **Clean up stale tasks** | Friday 4 PM | All | Reduce noise |
| **Verify close dates** | Weekly | AE | Forecast accuracy |
| **Review lead score distribution** | Weekly | Sales Lead | Scoring accuracy |

---

#### Monthly Habits

| Practice | Frequency | Owner | Why It Matters |
|----------|-----------|-------|----------------|
| **Data quality audit** | Monthly | Ops Lead | Remove duplicates, fix errors |
| **Pipeline velocity review** | Monthly | All | Identify bottlenecks |
| **Lost deal analysis** | Monthly | Sales Lead | Pattern recognition |
| **CRM usage report** | Monthly | Sales Lead | Adoption tracking |

---

### 7.4 Adoption Tracking

#### CRM Usage Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Daily Active Users (DAU)** | 90%+ | Users who logged in today / Total users |
| **Weekly Active Users (WAU)** | 100% | Users who logged in this week / Total users |
| **Task Completion Rate** | 95%+ | Tasks completed on time / Total tasks |
| **Call Note Logging Rate** | 90%+ | Calls with notes / Total calls logged |
| **Stage Update Latency** | <24 hours | Avg time from criteria met to stage update |
| **Email Open Rate** | 25%+ | Emails opened / Emails sent |
| **Email Reply Rate** | 5%+ | Email replies / Emails sent |
| **Demo Show Rate** | 70%+ | Demos attended / Demos booked |

---

#### Adoption Dashboard

**Dashboard:** REPORTS → DASHBOARDS → CREATE → "CRM Adoption"

| Metric | This Week | Last Week | Trend |
|--------|-----------|-----------|-------|
| DAU | 92% | 88% | ↑ 4pp |
| WAU | 100% | 100% | → |
| Task Completion | 97% | 94% | ↑ 3pp |
| Call Notes | 88% | 85% | ↑ 3pp |
| Stage Latency | 18 hours | 22 hours | ↓ 4 hours |
| Email Open Rate | 28% | 26% | ↑ 2pp |
| Email Reply Rate | 6% | 5% | ↑ 1pp |

**Red Flags (Trigger Intervention):**
- DAU < 80% → 1:1 coaching with laggard
- Task Completion < 85% → Manager review
- Call Notes < 75% → Refresher training
- Stage Latency > 48 hours → Process audit

---

## 8. Implementation Timeline

### Week 1: Platform Setup + Configuration

**Goal:** HubSpot fully configured and ready for data import

| Day | Task | Owner | Duration | Deliverable |
|-----|------|-------|----------|-------------|
| **Day 1** | Create HubSpot account (Professional tier) | Ops Lead | 2 hours | Account active |
| **Day 1** | Add users (10 seats) | Ops Lead | 1 hour | All users invited |
| **Day 2** | Configure pipeline stages (7 stages) | Sales Lead | 2 hours | Pipeline created |
| **Day 2** | Create custom properties (35 deal, 15 contact) | Ops Lead | 4 hours | All properties live |
| **Day 3** | Setup lead scoring workflows | Ops + Marketing | 4 hours | Scoring automation live |
| **Day 3** | Configure email templates (51 templates) | Marketing | 3 hours | All templates imported |
| **Day 4** | Connect Gmail integration | Ops Lead | 1 hour | Email sync active |
| **Day 4** | Connect Calendly integration | Ops Lead | 1 hour | 2-way sync active |
| **Day 5** | Connect Zoom integration | Ops Lead | 1 hour | Meeting logging active |
| **Day 5** | Connect Slack integration | Ops Lead | 1 hour | Alerts flowing to Slack |
| **Day 5** | Create dashboards (5 role-based) | Ops Lead | 3 hours | All dashboards live |

**Week 1 Success Criteria:**
- ✅ All users can login
- ✅ Pipeline stages configured
- ✅ All custom properties created
- ✅ Lead scoring automation working
- ✅ Email templates imported
- ✅ All integrations connected
- ✅ Dashboards visible to all users

---

### Week 2: Data Import + Integrations

**Goal:** All leads imported, integrations tested, automation verified

| Day | Task | Owner | Duration | Deliverable |
|-----|------|-------|----------|-------------|
| **Day 6** | Prepare lead data CSV (clean, dedupe) | SDR | 4 hours | Clean CSV ready |
| **Day 7** | Import companies (first 100) | SDR | 2 hours | Companies imported |
| **Day 7** | Import contacts (first 500) | SDR | 2 hours | Contacts imported |
| **Day 8** | Import deals (first 200) | SDR | 2 hours | Deals imported |
| **Day 8** | Verify data integrity (spot check) | Ops Lead | 2 hours | Data verified |
| **Day 9** | Test Polar.sh webhook (sandbox) | Ops Lead | 2 hours | Webhook tested |
| **Day 9** | Test full workflow (lead → closed won) | Sales Lead | 2 hours | End-to-end verified |
| **Day 10** | Assign leads (round-robin + segment-based) | Sales Lead | 2 hours | All leads assigned |
| **Day 10** | SDRs start outreach (5-10 leads/day) | SDR | Ongoing | First calls made |

**Week 2 Success Criteria:**
- ✅ 100+ companies imported
- ✅ 500+ contacts imported
- ✅ 200+ deals in pipeline
- ✅ Polar.sh webhook tested
- ✅ Full workflow tested (create → close)
- ✅ All leads assigned to SDRs/AEs
- ✅ First outreach emails sent

---

### Week 3: Team Training + Soft Launch

**Goal:** Team trained, soft launch with real leads, feedback collected

| Day | Task | Owner | Duration | Deliverable |
|-----|------|-------|----------|-------------|
| **Day 11** | SDR training: Pipeline + task management | Sales Lead | 2 hours | SDRs certified |
| **Day 11** | AE training: Demo + proposal workflow | Sales Lead | 2 hours | AEs certified |
| **Day 12** | Role-play: Discovery calls using CRM | Sales Lead | 2 hours | Call scripts refined |
| **Day 12** | Practice: Log activities, update stages | All | 2 hours | Muscle memory built |
| **Day 13** | CSM training: Onboarding workflow | Sales Lead | 2 hours | CSMs certified |
| **Day 13** | SDRs scale outreach (10-20 leads/day) | SDR | Ongoing | Volume increasing |
| **Day 14** | First demos scheduled | AE | Ongoing | 2-5 demos booked |
| **Day 14** | Weekly pipeline review (first session) | Sales Lead | 1 hour | Review cadence started |
| **Day 15** | Feedback session: What's working/broken | All | 1 hour | Improvement list |

**Week 3 Success Criteria:**
- ✅ All users certified on their workflows
- ✅ 50+ leads contacted
- ✅ 5+ demos booked
- ✅ First proposals sent
- ✅ Weekly review cadence established
- ✅ Feedback collected + prioritized

---

### Week 4: Full Launch + Optimization

**Goal:** Full production launch, optimization based on learnings

| Day | Task | Owner | Duration | Deliverable |
|-----|------|-------|----------|-------------|
| **Day 16** | All remaining leads imported | SDR | 2 hours | 100% of leads in CRM |
| **Day 16** | SDRs at full volume (30 leads/day) | SDR | Ongoing | Full outreach |
| **Day 17** | First proposals sent | AE | Ongoing | 3-5 proposals |
| **Day 17** | First negotiations started | AE | Ongoing | 1-2 negotiations |
| **Day 18** | First deals closed won | AE | Ongoing | 1-3 deals closed |
| **Day 18** | Onboarding calls scheduled | CSM | Ongoing | 100% of won deals |
| **Day 19** | Dashboard review + metric analysis | Ops Lead | 2 hours | Baseline metrics |
| **Day 19** | Optimize workflows based on feedback | Ops Lead | 2 hours | Workflows refined |
| **Day 20** | Retrospective: Week 1-4 learnings | All | 2 hours | Optimization plan |
| **Day 21** | Monthly report (first edition) | Sales Lead | 2 hours | Report sent |

**Week 4 Success Criteria:**
- ✅ Full pipeline populated (300+ deals)
- ✅ Full outreach volume (30 leads/day/SDR)
- ✅ 10+ demos completed
- ✅ 5+ proposals sent
- ✅ 3+ deals closed won
- ✅ $1K+ MRR generated
- ✅ All workflows optimized
- ✅ First monthly report sent

---

## 9. 30-60-90 Day Success Metrics

### 30-Day Metrics (End of Week 4)

| Category | Metric | Target | Actual | Status |
|----------|--------|--------|--------|--------|
| **Setup** | CRM fully configured | ✅ | ☐ | ☐ |
| **Setup** | All integrations live | ✅ | ☐ | ☐ |
| **Setup** | Team trained + certified | ✅ | ☐ | ☐ |
| **Pipeline** | 50+ leads in pipeline | 50+ | ☐ | ☐ |
| **Pipeline** | 10+ demos completed | 10+ | ☐ | ☐ |
| **Pipeline** | 5+ proposals sent | 5+ | ☐ | ☐ |
| **Pipeline** | 3+ deals closed | 3+ | ☐ | ☐ |
| **Revenue** | $1K+ MRR generated | $1K+ | ☐ | ☐ |
| **Adoption** | DAU > 85% | 85%+ | ☐ | ☐ |
| **Adoption** | Task completion > 90% | 90%+ | ☐ | ☐ |

---

### 60-Day Metrics (End of Week 8)

| Category | Metric | Target | Actual | Status |
|----------|--------|--------|--------|--------|
| **Pipeline** | 100+ leads in pipeline | 100+ | ☐ | ☐ |
| **Pipeline** | 25+ demos completed | 25+ | ☐ | ☐ |
| **Pipeline** | 15+ proposals sent | 15+ | ☐ | ☐ |
| **Pipeline** | 8+ deals closed | 8+ | ☐ | ☐ |
| **Revenue** | $3K+ MRR generated | $3K+ | ☐ | ☐ |
| **Velocity** | $1.5K+/day pipeline velocity | $1.5K+ | ☐ | ☐ |
| **Efficiency** | Win rate > 6% | 6%+ | ☐ | ☐ |
| **Efficiency** | Avg sales cycle < 30 days | <30 days | ☐ | ☐ |
| **Adoption** | DAU > 90% | 90%+ | ☐ | ☐ |
| **Forecast** | Forecast accuracy > 85% | 85%+ | ☐ | ☐ |

---

### 90-Day Metrics (End of Week 12)

| Category | Metric | Target | Actual | Status |
|----------|--------|--------|--------|--------|
| **Pipeline** | 200+ leads in pipeline | 200+ | ☐ | ☐ |
| **Pipeline** | 40+ demos completed | 40+ | ☐ | ☐ |
| **Pipeline** | 25+ proposals sent | 25+ | ☐ | ☐ |
| **Pipeline** | 15+ deals closed | 15+ | ☐ | ☐ |
| **Revenue** | $5K+ MRR generated | $5K+ | ☐ | ☐ |
| **Velocity** | $2K+/day pipeline velocity | $2K+ | ☐ | ☐ |
| **Efficiency** | Win rate > 8% | 8%+ | ☐ | ☐ |
| **Efficiency** | Avg sales cycle < 25 days | <25 days | ☐ | ☐ |
| **Unit Economics** | CAC < $500 (Agencies/SMEs) | <$500 | ☐ | ☐ |
| **Unit Economics** | LTV:CAC > 3:1 | 3:1+ | ☐ | ☐ |
| **Adoption** | DAU > 95% | 95%+ | ☐ | ☐ |
| **Forecast** | Forecast accuracy > 90% | 90%+ | ☐ | ☐ |

---

## Appendix A: Configuration Checklists

### Pre-Launch Checklist

```
☐ HubSpot account created (Professional tier)
☐ 10 users added + invited
☐ Pipeline stages configured (7 stages)
☐ 35+ custom deal properties created
☐ 15+ custom contact properties created
☐ Lead scoring workflows created (3 workflows)
☐ Email templates imported (51 templates)
☐ Gmail integration connected
☐ Calendly integration connected (2-way sync)
☐ Zoom integration connected
☐ Slack integration connected (3 channels)
☐ Polar.sh webhook configured
☐ PandaDoc integration connected
☐ Clearbit integration connected (enrichment)
☐ 5 dashboards created (SDR, AE, Manager, Executive, Adoption)
☐ Round-robin lead assignment configured
☐ Segment-based assignment configured
☐ Task automation workflows created (9 triggers)
☐ Email sequence enrollment workflows created (8 sequences)
☐ Closed won → Polar.sh workflow created
☐ Closed lost nurture workflow created
☐ Data import CSV prepared (companies, contacts, deals)
☐ Test batch imported (50 records)
☐ Data integrity verified
☐ Full pipeline tested (create → close)
☐ Team trained + certified (SDR, AE, CSM)
☐ Weekly pipeline review scheduled
☐ Slack alerts tested
☐ Email tracking verified
☐ Dashboards shared with all users
```

---

### Post-Launch Checklist (Daily/Weekly)

```
DAILY:
☐ Check "My Pipeline" dashboard (morning + EOD)
☐ Complete all due tasks
☐ Log call notes after every call
☐ Update deal stages when criteria met
☐ Respond to Slack alerts within 1 hour
☐ Send scheduled email sequences

WEEKLY:
☐ Pipeline review with manager (60 min)
☐ Verify close dates for accuracy
☐ Clean up stale tasks (Friday 4 PM)
☐ Review lead score distribution
☐ Check adoption metrics (DAU, task completion)
☐ Send weekly sales report (Monday 9 AM)

MONTHLY:
☐ Data quality audit (remove duplicates, fix errors)
☐ Pipeline velocity analysis
☐ Lost deal analysis (pattern recognition)
☐ CRM usage report (identify laggards)
☐ Forecast accuracy review
☐ Monthly sales report (first day of month)
☐ Workflow optimization (based on feedback)
```

---

## Appendix B: Vendor Comparison Tables

### Full Feature Comparison

| Feature | HubSpot Pro | Pipedrive Pro | Close.com Pro | Salesforce Pro |
|---------|-------------|---------------|---------------|----------------|
| **Base Price (5 users)** | $800/mo | $249/mo | $495/mo | $1,500/mo |
| **Email Sending Limit** | 50,000/mo | 10,000/mo | Unlimited | 5,000/mo |
| **Lead Scoring** | ✅ Built-in | ❌ Add-on | ✅ Built-in | ✅ Built-in |
| **Multi-Step Workflows** | ✅ Unlimited | ⚠️ Single-step | ⚠️ Limited | ✅ Unlimited |
| **Custom Objects** | ✅ | ❌ | ❌ | ✅ |
| **Forecasting** | ✅ Advanced | ⚠️ Basic | ⚠️ Basic | ✅ AI-Powered |
| **Conversation Intelligence** | ✅ Calls | ❌ | ✅ Calls | ✅ Calls + Coaching |
| **Sandbox Environment** | ❌ | ❌ | ❌ | ✅ |
| **Native Integrations** | 1,400+ | 100+ | 50+ | 5,000+ |
| **API Rate Limit** | 10,000/day | 10,000/day | 5,000/day | 25,000/day |
| **Support Response Time** | <4 hours | <24 hours | <24 hours | <24 hours |
| **Onboarding Included** | ✅ Dedicated | ⚠️ Self-serve | ⚠️ Self-serve | ✅ Dedicated |
| **Best For** | SMB + Scale-up | Small teams | Remote sales | Enterprise |

---

### Integration Ecosystem

| Integration | HubSpot | Pipedrive | Close | Salesforce |
|-------------|---------|-----------|-------|------------|
| **Polar.sh** | Webhook + Zapier | Webhook + Zapier | API + Zapier | Flow + Heroku |
| **Calendly** | ✅ Native (2-way) | ✅ Native | ✅ Native | ✅ Native |
| **Zoom** | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **Slack** | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **Gmail/Google** | ✅ Native (2-way) | ✅ Native | ✅ Native | ✅ Native |
| **Clearbit** | ✅ Native | ⚠️ Limited | ❌ | ✅ Native |
| **PandaDoc** | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **Outlook/Microsoft** | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **LinkedIn Sales Nav** | ✅ Native | ⚠️ Limited | ❌ | ✅ Native |
| **Zapier** | ✅ | ✅ | ✅ | ✅ |
| **Make.com** | ✅ | ✅ | ⚠️ Limited | ✅ |

---

## Appendix C: Troubleshooting Guide

### Common Issues

| Issue | Symptom | Root Cause | Fix |
|-------|---------|------------|-----|
| **Emails not sending** | Emails stuck in queue | Gmail sync disconnected | Re-authenticate Gmail account |
| **Lead score not updating** | Score stale after activity | Workflow not triggered | Check workflow enrollment criteria |
| **Slack alerts not firing** | No alerts in #sales-alerts | Slack app permissions revoked | Reinstall Slack app, re-grant permissions |
| **Calendly not creating deals** | No deal created on booking | Webhook not configured | Enable Calendly → HubSpot webhook |
| **Polar.sh subscription not syncing** | No `polar_customer_id` in HubSpot | Webhook endpoint incorrect | Verify Polar.sh webhook URL |
| **Round-robin not rotating** | Same SDR getting all leads | Rotation stuck | Reset round-robin in team settings |
| **Duplicate leads created** | Same contact appears twice | Email not matching | Enable duplicate management in settings |
| **Tasks not auto-creating** | Missing tasks after stage change | Workflow condition too strict | Review workflow trigger conditions |
| **Dashboards not loading** | Blank dashboard | Filter too restrictive | Check dashboard date range + filters |
| **Export failing** | Export timeout | Dataset too large | Filter by date range, export in batches |

---

## Appendix D: Security & Compliance

### Data Protection

| Requirement | Implementation |
|-------------|----------------|
| **GDPR Compliance** | HubSpot is GDPR-certified; enable data processing addendum |
| **Data Residency** | Data stored in US region (upgrade to EU region if needed) |
| **Access Control** | Role-based permissions (Section 7.1) |
| **Audit Logs** | Enabled for all user actions (Enterprise feature) |
| **2FA Required** | Enforce two-factor authentication for all users |
| **Data Retention** | Auto-delete inactive leads after 24 months |
| **Export Capability** | Full data export available via API or CSV |

---

## Unresolved Questions

1. **Current lead volume** — How many existing leads need to be imported? (Estimate: 500-2,000?)
2. **Sales team headcount** — How many SDRs/AEs will be using the CRM initially?
3. **Budget approval status** — Is $1,420/mo CRM budget approved, or need to optimize for lower tier?
4. **Polar.sh webhook capability** — Does Polar.sh support custom webhooks, or need Zapier middleware?
5. **Historical data availability** — Any existing pipeline data from previous tools to migrate?
6. **Legal review requirement** — Do Enterprise contracts require legal review before sending?
7. **Discount authority** — What discount can AEs offer without manager approval? (Recommend: 10% max)
8. **Demo environment readiness** — Do we have a demo account with sample templates/videos for demos?
9. **Vietnamese language support** — Need Vietnamese email templates, or English only for now?
10. **Timezone configuration** — Should HubSpot timezone be set to Asia/Ho_Chi_Minh or UTC?

---

**Document Version:** 1.0
**Created:** 2026-03-17
**Owner:** Sales/Revenue Team
**Next Review:** 2026-04-17 (after 30-day launch retrospective)
**Implementation Start:** Week 1 of 2026-03-24
**Full Launch Target:** 2026-04-21
