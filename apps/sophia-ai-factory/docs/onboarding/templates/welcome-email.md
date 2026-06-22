# Welcome Email Template

**Send**: Day 0 (within 1 hour of contract signed)
**From**: AM's email (not generic support)
**Subject**: Welcome to Sophia — Your Pilot Starts Now

---

## Email Body

```
Hi {{CEO_FIRST_NAME}},

Welcome to Sophia! I'm {{AM_NAME}}, your Account Manager for the next 12 weeks.

Here's everything you need to get started:

🎯 Your login
   URL: https://app.sophia.agencyos.network
   Email: {{CEO_EMAIL}}
   Temporary password: {{TEMP_PASSWORD}}
   (You'll be asked to change this on first login)

📚 Watch these 7 videos (30 min total)
   1. Welcome & Tour (5 min): {{LOOM_VIDEO_1_URL}}
   2. Daily CEO Workflow (4 min): {{LOOM_VIDEO_2_URL}}
   3. Reading Your Weekly Report (5 min): {{LOOM_VIDEO_3_URL}}
   4. Channels & Content Strategy (6 min): {{LOOM_VIDEO_4_URL}}
   5. Feedback Loop & Approvals (4 min): {{LOOM_VIDEO_5_URL}}
   6. When Things Go Wrong (5 min): {{LOOM_VIDEO_6_URL}}
   7. Pilot Wrap-Up & Next Steps (4 min): {{LOOM_VIDEO_7_URL}}

📖 Reference docs
   CEO Handoff Package: {{PDF_URL}}
   Customer Onboarding Guide: {{ONBOARDING_GUIDE_URL}}
   Quick Reference Card: {{QUICKREF_PDF_URL}}

💬 Join our shared Slack
   Invite link: {{SLACK_INVITE_URL}}
   Channel: #sophia-{{TENANT_SLUG}}

📅 Book our kickoff call
   {{CALENDLY_LINK}}

On the call, we'll cover:
- Your business goals for the next 12 weeks
- How to read your dashboard
- What success looks like

If you have any urgent questions before then, reach me directly:
- Slack: {{AM_SLACK_HANDLE}} (fastest)
- Email: {{AM_EMAIL}}
- Phone: {{AM_PHONE}} (for P0 only)

Looking forward to working with you!

{{AM_SIGNATURE}}
Account Manager, Sophia
```

---

## Variables

| Variable | Source |
|----------|--------|
| `CEO_FIRST_NAME` | Customer record |
| `AM_NAME` | Sender (AM) |
| `TEMP_PASSWORD` | Generated, force reset on first login |
| `LOOM_VIDEO_N_URL` | `public/handover/loom-scripts/` |
| `PDF_URL` | `docs/CEO-HANDOFF-PACKAGE-v3.pdf` |
| `ONBOARDING_GUIDE_URL` | `docs/onboarding/CUSTOMER-ONBOARDING-GUIDE.md` |
| `QUICKREF_PDF_URL` | `docs/runbooks/INCIDENT-RESPONSE-QUICKREF.pdf` |
| `SLACK_INVITE_URL` | Generated per tenant |
| `TENANT_SLUG` | Lowercase, hyphenated company name |
| `CALENDLY_LINK` | AM's scheduling link |
| `AM_SLACK_HANDLE` | `@am-firstname` |
| `AM_EMAIL` | `am-firstname@sophia.agencyos.network` |
| `AM_PHONE` | AM's direct line |
| `AM_SIGNATURE` | Full signature block |

---

## Send Checklist

Before sending:
- [ ] Tenant record created in D1
- [ ] D1 database provisioned
- [ ] Stripe customer + subscription active
- [ ] Slack channel created (`#sophia-{tenant-slug}`)
- [ ] All Loom videos uploaded + URLs generated
- [ ] PDFs generated + uploaded to public storage
- [ ] Customer Onboarding Guide uploaded + URL generated
- [ ] Temp password generated (16+ chars, alphanumeric)
- [ ] Variables all populated correctly
- [ ] Test send to AM's email first (preview)
- [ ] Send to CEO + CC any other stakeholders from contract
- [ ] Log sent timestamp in `tenants/{tenantId}/audit-log`

---

## Follow-up (Day 1)

If customer has not logged in within 24 hours:

1. Slack DM (preferred)
2. If no response in 2 hours → email
3. If still no response in 24 hours → phone call

Goal: confirm login + answer first questions before kickoff call.

---

**Last reviewed**: 2026-06-12
