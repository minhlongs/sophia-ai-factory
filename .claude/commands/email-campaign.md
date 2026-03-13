---
description: 📧 Email Campaign — Newsletters, Drip Sequences, Automation
argument-hint: [type: newsletter|drip|promo|transactional] [audience]
---

**Think harder** để tạo email campaign: <type>$ARGUMENTS</type>

**IMPORTANT:** Personalization + value-first approach = higher engagement.

## Email Types

| Type | Purpose | Frequency | Open Rate | CTR |
|------|---------|-----------|-----------|-----|
| Newsletter | Engagement | Weekly/Bi-weekly | 20-30% | 2-5% |
| Drip Sequence | Nurture | Daily/Weekly | 30-50% | 5-15% |
| Promo | Sales | Monthly | 15-25% | 3-8% |
| Transactional | Info | Trigger-based | 40-60% | 10-20% |

## Email Templates

### Newsletter Template
```html
<!DOCTYPE html>
<html>
<head>
  <title>[Subject Line]</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

<!-- Header -->
<table width="100%" style="background: #1a1a2e; padding: 20px;">
  <tr>
    <td align="center">
      <img src="[LOGO_URL]" alt="AgencyOS" width="120">
    </td>
  </tr>
</table>

<!-- Hero -->
<table width="100%" style="padding: 30px 20px;">
  <tr>
    <td>
      <h1 style="color: #333; font-size: 24px;">[Headline]</h1>
      <p style="color: #666; line-height: 1.6;">[Opening paragraph]</p>
    </td>
  </tr>
</table>

<!-- Main Content -->
<table width="100%" style="padding: 0 20px;">
  <tr>
    <td>
      <h2 style="color: #4a4a68;">[Section 1]</h2>
      <p>[Content]</p>
      <a href="[LINK]" style="background: #4f46e5; color: white;
         padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        [CTA Button]
      </a>
    </td>
  </tr>
</table>

<!-- Footer -->
<table width="100%" style="background: #f5f5f5; padding: 20px; margin-top: 30px;">
  <tr>
    <td align="center" style="color: #999; font-size: 12px;">
      <p>[Company Name] | [Address]</p>
      <p><a href="[UNSUBSCRIBE]">Unsubscribe</a> | <a href="[PREFERENCES]">Preferences</a></p>
    </td>
  </tr>
</table>

</body>
</html>
```

### Drip Sequence (5 Emails)
```yaml
# Welcome Sequence
email_1:
  day: 0
  subject: "Welcome to AgencyOS! 🎉"
  goal: "Onboard + first value"
  content: |
    - Welcome message
    - Quick win (5-min setup)
    - CTA: Complete setup

email_2:
  day: 2
  subject: "Here's what you can do with AgencyOS"
  goal: "Feature education"
  content: |
    - Highlight 3 key features
    - Use case examples
    - CTA: Try a feature

email_3:
  day: 5
  subject: "How [Customer] 10x'd their efficiency"
  goal: "Social proof"
  content: |
    - Case study
    - Before/after metrics
    - CTA: Book demo

email_4:
  day: 8
  subject: "Quick question..."
  goal: "Engagement"
  content: |
    - Personal check-in
    - Offer help
    - CTA: Reply to email

email_5:
  day: 12
  subject: "Last chance for [offer]"
  goal: "Conversion"
  content: |
    - Special offer
    - Urgency (48 hours)
    - CTA: Upgrade now
```

### Promo Email
```html
Subject: 🚀 [Urgent] 50% off AgencyOS Pro — 48 hours only!

Hi [First Name],

For the next 48 hours, upgrade to AgencyOS Pro at 50% off!

🎁 What you get:
✓ Unlimited automations
✓ Priority support
✓ Advanced analytics
✓ Custom integrations

💰 Save $50/month
Regular: $99/mo → Today: $49.50/mo

[UPGRADE NOW - BIG BUTTON]

This offer expires [Date] at midnight PST.

Questions? Just reply to this email.

— The AgencyOS Team

P.S. Already on Pro? Share this offer with your network!
```

## Subject Line Formulas

```bash
# Curiosity Gap
"Here's what 90% of agencies get wrong..."
"The one automation that changed everything"

# Numbers + Specificity
"7 automations saving agencies 20hrs/week"
"How we cut ops costs by 73% in 30 days"

# Urgency/Scarcity
"Last chance: 50% off ends tonight"
"Only 3 spots left for onboarding"

# Personalization
"[Name], your agency report is ready"
"Question about your workflow, [Name]?"

# Social Proof
"Join 1,000+ agencies using AgencyOS"
"Why top agencies switched to us"
```

## SendGrid Integration

```bash
# Create campaign
curl -X POST https://api.sendgrid.com/v3/marketing/campaigns \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "March 2026 Newsletter",
    "subject": "[Subject line]",
    "html_content": "<html>...</html>",
    "plain_content": "Plain text version",
    "list_ids": ["list_xxx"]
  }'

# Schedule send
curl -X PATCH https://api.sendgrid.com/v3/marketing/campaigns/[ID] \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -d '{
    "sends_at": 1709539200
  }'

# Track performance
curl -s "https://api.sendgrid.com/v3/marketing/campaigns/[ID]/stats" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  | jq '.stats[0] | {sends, opens, clicks, bounces}'
```

## Email Metrics Dashboard

```yaml
# Key metrics to track
metrics:
  - name: "Open Rate"
    formula: "opens / sends"
    benchmark: "20-30%"

  - name: "Click-Through Rate"
    formula: "clicks / opens"
    benchmark: "2-5%"

  - name: "Conversion Rate"
    formula: "conversions / clicks"
    benchmark: "5-15%"

  - name: "Unsubscribe Rate"
    formula: "unsubscribes / sends"
    benchmark: "<0.5%"

  - name: "Bounce Rate"
    formula: "bounces / sends"
    benchmark: "<2%"
```

## Segmentation Strategy

```sql
-- Segment by engagement
SELECT email,
       CASE
         WHEN opens_30d > 5 THEN 'highly_engaged'
         WHEN opens_30d > 0 THEN 'moderately_engaged'
         ELSE 'cold'
       END as segment
FROM users
WHERE last_open > NOW() - INTERVAL '30 days';

-- Segment by plan
SELECT plan, COUNT(*) as users
FROM subscriptions
WHERE status = 'active'
GROUP BY plan;

-- Segment by behavior
SELECT
  CASE
    WHEN used_feature_x THEN 'power_user'
    WHEN used_feature_y THEN 'feature_specific'
    ELSE 'casual'
  END as segment,
  COUNT(*) as users
FROM user_activity
GROUP BY 1;
```

## A/B Testing

```bash
# Test subject lines
curl -X POST https://api.sendgrid.com/v3/marketing/ab_tests \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -d '{
    "name": "Subject Line Test",
    "variations": [
      {"subject": "🚀 New feature alert!", "percentage": 50},
      {"subject": "You asked, we built it", "percentage": 50}
    ],
    "winner_criteria": "open_rate"
  }'
```

## Related Commands

- `/blog-post` — Blog content
- `/social-media` — Social media content
- `/landing-page` — Landing page copy
