---
phase: 05
title: "Email Sequences"
status: pending
effort: 1h
owner: writer
---

# Phase 05: Email Sequences

## Context Links

- **Parent Plan:** [plan.md](./plan.md)
- **Input:** Content from Phase 02-04
- **Output:** `../../reports/marketing/content/email-sequences.md`

## Overview

**Priority:** P2 | **Status:** ⏳ pending | **Effort:** 1h

Tạo email automation sequences cho user onboarding và engagement.

## Email Sequences

| Sequence | Emails | Purpose | Trigger |
|----------|--------|---------|---------|
| Welcome | 5 emails | Onboard new users | Sign up |
| Product Education | 3 emails | Feature adoption | Day 3 inactive |
| Re-engagement | 2 emails | Win back churned | 14 days inactive |

## Requirements

### Functional Requirements
- [ ] 5-email welcome sequence
- [ ] 3-email product education sequence
- [ ] 2-email re-engagement sequence
- [ ] Subject lines (A/B test variants)
- [ ] Personalization tokens

### Non-Functional Requirements
- Mobile-optimized copy (<200 words per email)
- Clear single CTA per email
- Personalization with user name, company
- Unsubscribe compliance

## Architecture

### Email Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Template                           │
├─────────────────────────────────────────────────────────────┤
│  Subject Line (2 variants for A/B testing)                  │
│  Preheader Text (40-50 chars)                               │
├─────────────────────────────────────────────────────────────┤
│  Personalized Greeting                                      │
│    - Hi {{first_name}},                                     │
├─────────────────────────────────────────────────────────────┤
│  Opening (20-30 words)                                      │
│    - Hook, relevance                                        │
├─────────────────────────────────────────────────────────────┤
│  Body (80-120 words)                                        │
│    - Value proposition                                      │
│    - Social proof (optional)                                │
├─────────────────────────────────────────────────────────────┤
│  CTA (single, clear)                                        │
│    - Button text                                            │
│    - Link URL                                               │
├─────────────────────────────────────────────────────────────┤
│  Sign-off                                                   │
│    - Best, The Sophia AI Team                               │
├─────────────────────────────────────────────────────────────┤
│  Footer                                                     │
│    - Unsubscribe, preferences, address                      │
└─────────────────────────────────────────────────────────────┘
```

## Related Code Files

**Files to Create:**
- `../../reports/marketing/content/email-sequences.md`

## Implementation Steps

### Step 1: Welcome Sequence (30 min)

**Email 1:** Welcome + Quick Start (Send immediately)
- Subject: "Welcome to Sophia AI! Start here →"
- Content: Welcome, 1-minute setup guide
- CTA: "Create Your First Video"

**Email 2:** Feature Highlight (Day 2)
- Subject: "Did you know? 90s videos from any URL"
- Content: URL-to-video feature demo
- CTA: "Try URL Import"

**Email 3:** Social Proof (Day 4)
- Subject: "How [Brand] increased conversions 40%"
- Content: Case study
- CTA: "See More Stories"

**Email 4:** Template Showcase (Day 7)
- Subject: "20+ templates ready to use"
- Content: Template library tour
- CTA: "Browse Templates"

**Email 5:** Upgrade Nudge (Day 10)
- Subject: "Ready to go pro?"
- Content: Premium features, limited offer
- CTA: "Upgrade Now"

### Step 2: Product Education Sequence (15 min)

**Email 1:** Feature Deep Dive (Day 3 inactive)
- Subject: "Missing this feature?"
- Content: Highlight underused feature
- CTA: "Learn More"

**Email 2:** Tutorial Offer (Day 5 inactive)
- Subject: "Need help creating videos?"
- Content: Tutorial resources, offer 1:1 help
- CTA: "Book Demo"

**Email 3:** Last Attempt (Day 7 inactive)
- Subject: "Should we close your account?"
- Content: Feedback request, win-back offer
- CTA: "Give Feedback"

### Step 3: Re-engagement Sequence (10 min)

**Email 1:** We Miss You (Day 14 inactive)
- Subject: "Come back! Here's 20% off"
- Content: Win-back offer
- CTA: "Claim Discount"

**Email 2:** Final Notice (Day 21 inactive)
- Subject: "Last chance to save your account"
- Content: Account closure warning
- CTA: "Keep My Account"

### Step 4: Review & Format (5 min)

1. Review all emails for consistency
2. Add personalization tokens
3. Format as markdown
4. Save final document

## Todo List

- [ ] Write 5-email welcome sequence
- [ ] Write 3-email product education sequence
- [ ] Write 2-email re-engagement sequence
- [ ] Add A/B test subject lines
- [ ] Add personalization tokens
- [ ] Review for mobile optimization
- [ ] Save to `../../reports/marketing/content/email-sequences.md`

## Success Criteria

- [ ] 10 total emails across 3 sequences
- [ ] Each email has: subject (2 variants), preheader, body, CTA
- [ ] Personalization tokens included
- [ ] Mobile-optimized (<200 words each)
- [ ] Clear single CTA per email
- [ ] Unsubscribe compliance noted

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Emails quá dài | Medium | Enforce word count limits |
| CTAs không rõ ràng | High | Single CTA per email rule |
| Quá nhiều emails | Low | Follow sequence best practices |
| Spam trigger words | Medium | Avoid spam vocabulary |

## Security Considerations

- Include unsubscribe links (CAN-SPAM compliance)
- No sensitive data in email copy
- Personalization tokens must be validated

## Next Steps

**Upon Completion:**
1. Update plan.md phase status to completed
2. Consolidate all reports into final deliverable
3. Handoff content to marketing team
4. Update project roadmap with content milestones

**Dependencies:**
- ← Blocked By: Phase 04 (Social Media)
- → Completes: Content Engine Implementation

---

## Appendix: Personalization Tokens

| Token | Example | Usage |
|-------|---------|-------|
| {{first_name}} | John | Greeting |
| {{company}} | Acme Inc | Customization |
| {{signup_date}} | March 15, 2026 | Context |
| {{last_login}} | 3 days ago | Re-engagement |
| {{videos_created}} | 5 | Usage-based |

## Email Compliance Checklist

- [ ] Unsubscribe link included
- [ ] Physical address in footer
- [ ] Clear sender identification
- [ ] No misleading subject lines
- [ ] CAN-SPAM compliant
- [ ] GDPR consent noted (if EU users)
