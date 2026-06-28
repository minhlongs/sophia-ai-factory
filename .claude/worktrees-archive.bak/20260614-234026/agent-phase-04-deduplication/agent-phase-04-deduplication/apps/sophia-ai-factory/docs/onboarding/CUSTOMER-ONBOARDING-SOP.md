# Customer Onboarding SOP

**Version**: 1.0 | **Date**: 2026-06-12
**Owner**: Account Manager + Customer Success
**Duration**: 14 days from contract signed → first value delivered

---

## Overview

```
Day 0: Contract signed
Day 1-3: Welcome + discovery
Day 4-7: Setup + integration
Day 8-14: First value + training
```

---

## Day 0: Contract Signed

**Owner**: AM

### Tasks

- [ ] Receive signed contract + first payment
- [ ] Create tenant record in D1 (`tenants` table)
- [ ] Provision D1 database for tenant (DB-per-tenant)
- [ ] Create Stripe customer + subscription
- [ ] Send welcome email (template: `templates/welcome-email.md`)
- [ ] Schedule kickoff call (within 48 hours)
- [ ] Add to Slack workspace (`#sophia-{tenant-name}`)

### Welcome Email Checklist

Email must include:
- [ ] Login URL: `https://app.sophia.agencyos.network`
- [ ] Temporary password (force reset on first login)
- [ ] Loom video links (7 videos, see `public/handover/loom-scripts/README.md`)
- [ ] CEO Handoff Package PDF (`docs/CEO-HANDOFF-PACKAGE-v3.pdf`)
- [ ] AM contact info (Slack, email, phone for P0)
- [ ] Calendar link to book kickoff call

---

## Day 1-3: Welcome + Discovery

**Owner**: AM leads, SME supports

### Goals

- Understand customer's business, audience, goals
- Identify success metrics for pilot
- Document baseline state

### Kickoff Call (60 min)

| Time | Topic | Lead |
|------|-------|------|
| 0-10 | Intros + agenda | AM |
| 10-25 | Customer's business, goals, constraints | Customer |
| 25-40 | Walkthrough of dashboard + first Loom video | AM |
| 40-55 | Q&A + success metrics agreement | Joint |
| 55-60 | Next steps + homework | AM |

### Discovery Questions

Document answers in `tenants/{tenantId}/discovery.md`:

1. **Business**: Industry, size, revenue model
2. **Audience**: Demographics, channels they use, pain points
3. **Goals**: What does success look like in 12 weeks?
4. **Constraints**: Budget, team capacity, brand guidelines
5. **Tech stack**: Existing tools (CRM, analytics, marketing)
6. **Decision makers**: Who approves what?
7. **Timeline**: Any launches, campaigns, or events in next 90 days?

### Deliverables End of Day 3

- [ ] Discovery doc completed
- [ ] Success metrics agreed (3 KPIs from pilot plan)
- [ ] Slack channel active with customer present
- [ ] Customer has logged into dashboard successfully

---

## Day 4-7: Setup + Integration

**Owner**: Engineering (with AM coordination)

### Tasks

- [ ] Connect channels (LinkedIn, Instagram, etc.) — see Channel Setup Checklist
- [ ] Import customer brand assets (logos, colors, fonts)
- [ ] Configure AI prompts for customer's voice/tone
- [ ] Set up content calendar (3-5 posts/week)
- [ ] Verify analytics tracking (UTM params, conversion events)
- [ ] Connect billing (Stripe customer portal link)

### Channel Setup Checklist

For each channel:

- [ ] OAuth connection established
- [ ] Brand account permissions verified
- [ ] Posting schedule configured
- [ ] First draft content created (3 posts minimum)
- [ ] Customer review workflow activated

### Brand Asset Intake

Request from customer:
- [ ] Logo (SVG + PNG, light + dark variants)
- [ ] Brand colors (hex codes)
- [ ] Brand fonts (or close alternatives)
- [ ] Brand voice doc (tone, do's/don'ts)
- [ ] 5-10 example posts they love
- [ ] 5-10 example posts they hate

### Deliverables End of Day 7

- [ ] All channels connected
- [ ] Brand assets loaded
- [ ] First content calendar approved
- [ ] Customer trained on approval workflow (Loom video 5)

---

## Day 8-14: First Value + Training

**Owner**: AM + Customer Success

### Goals

- First post published
- First report delivered
- Customer team trained on daily/weekly routines

### Daily Activities

| Day | Activity |
|-----|----------|
| 8 | First post published across 2 channels |
| 9 | Monitor engagement, respond to comments |
| 10 | First weekly report generated |
| 11 | Report review call with CEO (30 min) |
| 12 | Onboarding training session (team, 60 min) |
| 13 | Q&A + edge case handling |
| 14 | 2-week retro + handoff to ongoing support |

### Training Agenda (Day 12, 60 min)

| Time | Topic | Video |
|------|-------|-------|
| 0-10 | Daily CEO workflow | Loom 2 |
| 10-25 | Reading weekly report | Loom 3 |
| 25-40 | Channels + content strategy | Loom 4 |
| 40-55 | Feedback loop + approvals | Loom 5 |
| 55-60 | Q&A | Live |

### 2-Week Retro (Day 14, 30 min)

Questions to discuss:

1. What's working well?
2. What's confusing or frustrating?
3. Are the 5 KPIs visible and understandable?
4. Any feature requests?
5. Comfort level (1-10) with platform?

### Deliverables End of Day 14

- [ ] First post published
- [ ] First weekly report reviewed with CEO
- [ ] Team trained (recorded session saved to tenant folder)
- [ ] Retro doc with action items
- [ ] Customer moved to "Active" status in D1

---

## Roles & Responsibilities

| Role | Primary Responsibility |
|------|------------------------|
| Account Manager | Owns customer relationship, kickoff, training |
| Engineer | Technical setup, integrations, bug fixes |
| Customer Success | Adoption, retention, expansion signals |
| CEO (Long Tho) | Escalation point for P0 + strategic decisions |

---

## Tools

- **D1**: Tenant records, discovery docs, retro notes
- **Stripe**: Billing, subscription management
- **Slack**: Customer communication (`#sophia-{tenant}`)
- **Loom**: Pre-recorded training videos
- **Notion**: Shared workspace for discovery + retro docs (optional)

---

## Metrics

Track for each onboarding:

- **Time to first post** (target: Day 8)
- **Time to first value** (target: Day 11)
- **NPS at Day 14** (target: 8+)
- **Setup completion rate** (% of customers completing all steps)

If any metric falls below target, escalate to AM lead for review.

---

## Common Pitfalls

1. **Skipping discovery**: Leads to wrong assumptions about goals
2. **Too much too fast**: Customers feel overwhelmed → churn
3. **Not training the team**: Only CEO knows how to use it → single point of failure
4. **Forgetting brand assets**: Content looks generic → low engagement
5. **No retro feedback**: Missed opportunity to improve product

---

## Templates

- Welcome email: `templates/welcome-email.md`
- Kickoff call agenda: `templates/kickoff-agenda.md`
- Discovery doc: `templates/discovery-doc.md`
- Retro doc: `templates/retro-doc.md`

---

**Last reviewed**: 2026-06-12
**Next review**: After first 5 onboardings
