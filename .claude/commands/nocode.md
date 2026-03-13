---
description: 🔧 No-Code MVP Builder — Build and launch without code
argument-hint: [product-type: saas|marketplace|mobile-app|internal-tool]
---

**Think harder** để build no-code MVP: $ARGUMENTS

## Tool Selection Matrix

| Tool | Best For | Pricing | Learning Curve |
|------|----------|---------|----------------|
| **Bubble** | Full web apps, SaaS | Free-$32/mo | Medium |
| **Webflow** | Marketing sites, CMS | Free-$29/mo | Medium |
| **Softr** | Airtable-powered apps | Free-$49/mo | Low |
| **Glide** | Mobile apps from sheets | Free-$99/mo | Low |
| **Retool** | Internal tools, admin | Free-$10/user | Medium |
| **Zapier** | Automation, integrations | Free-$20/mo | Low |
| **Make** | Complex automation | Free-$9/mo | Medium |
| **Airtable** | Database + views | Free-$20/mo | Low |
| **Notion** | Docs, wikis, light apps | Free-$10/mo | Low |
| **Carrd** | Simple landing pages | Free-$19/yr | Very Low |
| **Tally** | Forms, surveys | Free-$29/mo | Very Low |
| **Memberstack** | Memberships, auth | $29/mo | Low |

## No-Code Architecture Patterns

### SaaS MVP Stack
```
Frontend:  Bubble or Webflow
Database:  Airtable or Supabase
Auth:      Memberstack or Bubble built-in
Payments:  Stripe (via Bubble/Memberstack)
Email:     Mailchimp or SendGrid
Automation: Zapier or Make
```

### Marketplace MVP Stack
```
Frontend:  Sharetribe or Bubble
Database:  Bubble or Airtable
Payments:  Stripe Connect
Search:    Algolia (via Bubble plugin)
Messaging: Bubble built-in or SendBird
```

### Internal Tool Stack
```
Dashboard: Retool or Appsmith
Database:  PostgreSQL or Airtable
API:       Xano or Supabase
Automation: n8n or Zapier
```

## When to Transition to Code

```
STAY no-code if:
✅ <1000 users
✅ Simple CRUD operations
✅ Standard authentication needs
✅ <$5K MRR

SWITCH to code when:
⚠️ Performance becomes an issue
⚠️ Custom algorithms needed
⚠️ Complex real-time features
⚠️ >1000 concurrent users
⚠️ Cost of no-code > custom dev
```

## Cost Comparison (Year 1)

```
No-code MVP:     $100-500/month → $1.2K-6K/year
Custom dev hire: $5K-15K/month  → $60K-180K/year
Dev agency:      $20K-100K one-time

Winner: No-code for validation (10-30x cheaper)
```

## Related Commands
- `/mvp-validate` — Validate your MVP
- `/landing-page` — Landing page copy
- `/startup-credits` — Free credits for tools
