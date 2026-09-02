# SOPHIA AI FACTORY — CEO OPERATING HANDBOOK

> Version: 1.0 | Baseline: `5dd1f071` | Owner: CEO
> Last Updated: 2026-09-02

---

## Purpose

This handbook is the CEO's daily reference for operating Sophia AI Factory. It covers everything from checking platform health to making business decisions.

**Read this if you have 30 minutes** → Sections 1, 5, 10, 14, 16
**Read this if you have 2 hours** → All sections
**Bookmark this** → Section 10 (Escalation), Section 13 (Incidents), Section 16 (Financial)

---

## 1. What Sophia Is

Sophia AI Factory is a **SaaS platform** that helps agencies create AI-powered social media content. It combines AI models (text, image, voice, video) into automated "missions" that produce ready-to-post content.

**Business model:** Subscription tiers (BASIC $29/mo → PREMIUM $79/mo → ENTERPRISE $299/mo) + usage-based AI costs passed through.

**Key differentiators:**
- **BYOK (Bring Your Own Keys)** — Customers use their own AI provider keys
- **Bilingual** — Vietnamese and English, locale-aware
- **Multi-AI** — Supports OpenRouter, ElevenLabs, D-ID, HeyGen, Tavily
- **Human-in-the-loop** — Content requires human approval before posting

---

## 2. Daily Operations

### Morning Health Check (5 minutes)

```
1. Open terminal
2. Run health check:
   curl -s https://sophia.agencyos.network/api/health | jq .

   Expected: { "status": "ok", "version": "5dd1f071", "timestamp": "..." }

3. Check Sentry for new errors:
   → https://sentry.io (Sentry AI Factory project)
   → Filter: last 24 hours
   → Look for: any new error groups or increased frequency

4. Check cron job health:
   → curl -s https://sophia.agencyos.network/api/cron/health-check \
     -H "Authorization: Bearer $CRON_SECRET"

   Expected: { "status": "ok", "checks": [...] }
```

### What to Do If Health Check Fails

| Symptom | Action |
|---|---|
| /api/health returns 5xx | **SEV-1**: Follow INCIDENT_RESPONSE.md Playbook 1 |
| Sentry shows new errors | Check error details; if user-impacting, escalate to Tech Lead |
| Cron health-check fails | Run `curl` again; if persists, check D1: `SELECT * FROM cron_run_log ORDER BY created_at DESC LIMIT 10` |
| Response time > 500ms | Check Cloudflare Workers dashboard for CPU/memory |

---

## 3. Understanding the Architecture

### The Simple Version

```
Customer Browser
    ↓
Cloudflare (CDN + Workers)
    ↓
Sophia Application (Next.js on Workers)
    ├── Web Pages (UI for customers)
    ├── API Routes (server-side logic)
    ├── Cron Routes (background jobs — 43 routes)
    └── Inngest (long-running workflows — 10 functions)
    ↓
Cloudflare D1 (database — SQLite)
Cloudflare R2 (file storage)
    ↓
AI Providers (OpenRouter, ElevenLabs, D-ID, HeyGen, Tavily)
NOWPayments / PayOS (payments)
Better Auth (authentication)
Resend (emails)
Honeycomb (observability)
```

### The Technical Version

| Layer | Component | Technology |
|---|---|---|
| **Frontend** | Web App | Next.js 16 (App Router), React, Tailwind CSS |
| **i18n** | Translations | next-intl, Vietnamese (vi) + English (en) |
| **Auth** | Authentication | Better Auth v1.6.2, email+password, JWT sessions |
| **API** | Routes | 63 API routes + 43 cron routes |
| **Database** | Primary Store | Cloudflare D1 (SQLite), ~50 tables |
| **Cache** | Object Store | Cloudflare R2 (images, backups) |
| **Workflows** | Long Jobs | Inngest (10 event-driven functions) |
| **Background** | Cron Jobs | 43 Cloudflare Workers cron routes |
| **Payments** | Billing | NOWPayments (crypto), PayOS (Vietnam) |
| **AI** | Models | OpenRouter (text), ElevenLabs (voice), D-ID (video), HeyGen (video) |
| **Email** | Transactional | Resend |
| **Errors** | Tracking | Sentry |
| **Observability** | Metrics | Honeycomb |
| **Deploy** | Infrastructure | Cloudflare Pages + Workers (CF-direct) |
| **Version Control** | Code | GitHub (private repo) |

---

## 4. Understanding the Business

### Customer Journey

```
1. Discovery → Website (sophia.agencyos.network)
2. Signup → Better Auth (email + password)
3. Onboarding → Setup Wizard (6 steps, ~10 minutes)
4. Configuration → Enter API keys (BYOK)
5. Payment → NOWPayments or PayOS
6. Activation → Tier unlocked, ready to create
7. Usage → Create missions, approve content, post to social
8. Ongoing → Monitor results, adjust settings, upgrade tiers
```

### Tier Structure

| Tier | Price | Features | Target |
|---|---|---|---|
| **BASIC** | $29/mo | 30 missions, text+image, 2 platforms | Solo creators |
| **PREMIUM** | $79/mo | 100 missions, +voice+video, 5 platforms | Small agencies |
| **ENTERPRISE** | $299/mo | 500 missions, +multilingual, all platforms | Large agencies |
| **MASTER** | Custom | Unlimited, white-label, API | Enterprise clients |

---

## 5. Key Metrics to Monitor

### Daily Metrics (Check Every Morning)

| Metric | Where | Good | Concerning |
|---|---|---|---|
| API health | `/api/health` | 200 + status ok | 5xx or timeout |
| Error rate | Sentry | < 10 new/day | > 20 new/day |
| Failed logins | D1 query | < 5/day | > 15/day |
| Cron job failures | cron_run_log | 0 | > 2 in 24h |

### Weekly Metrics (Check Every Monday)

| Metric | Where | Good | Concerning |
|---|---|---|---|
| Active users | D1 query | Growing or stable | Declining > 10% |
| Mission completion | D1 query | > 80% success | < 60% success |
| Payment failures | D1 query | < 5/week | > 10/week |
| Customer support tickets | Feedback log | < 10/week | > 25/week |

### Monthly Metrics (First of Each Month)

| Metric | Where | Good | Concerning |
|---|---|---|---|
| MRR | FINANCIAL_OPERATING_MODEL.md | Growing | Declining |
| Churn | D1 query | < 5% | > 10% |
| AI costs | AI costs tracking | Stable | Spiking > 20% |
| Uptime | Better Stack | > 99.5% | < 99% |

---

## 6. Customer Communication

### When to Communicate

| Event | Action | Template |
|---|---|---|
| Planned maintenance | Telegram broadcast 24h prior | "Scheduled maintenance on [date] at [time]..." |
| Unplanned outage | Telegram broadcast immediately | "We're experiencing issues and working on a fix..." |
| New feature | Telegram + email | "We've added [feature]..." |
| Price change | Email 30 days prior | "We're updating our pricing..." |
| Security incident | Email immediately | "We've identified a security issue..." |

### Communication Channels

| Channel | Use For | Audience |
|---|---|---|
| **Telegram** | Quick updates, status | All users |
| **Email** | Formal announcements, security | All users |
| **In-app notifications** | Feature updates, tips | Active users |
| **Direct message** | Individual support | Specific user |

---

## 7. Financial Management

### Revenue Tracking

Revenue comes from two sources:
1. **Subscription payments** — Monthly via NOWPayments/PayOS
2. **Usage overage** — When customers exceed tier limits

**Query revenue:**
```sql
-- Monthly recurring revenue
SELECT
  strftime('%Y-%m', created_at) as month,
  SUM(amount) as mrr,
  COUNT(DISTINCT user_id) as paying_customers
FROM purchases
WHERE status = 'completed'
GROUP BY month
ORDER BY month DESC;

-- Recent payments
SELECT * FROM purchases
WHERE created_at > datetime('now', '-7 days')
ORDER BY created_at DESC;
```

### Cost Management

The main cost drivers are:
1. **AI provider costs** (passed through to customers at markup)
2. **Cloudflare** (Workers, D1, R2 — relatively low)
3. **Inngest** (workflow orchestration)
4. **Sentry** (error tracking)
5. **Resend** (transactional emails)

**Review monthly:** Compare AI costs billed to AI costs consumed. Margin should be positive.

### Refund Policy

- Self-service refunds via NOWPayments dashboard (within 14 days)
- Larger refunds require CEO approval (see DECISION_RIGHTS.md)
- All refunds logged in `payments_audit` table

---

## 8. Security Responsibilities

### Daily Security

- Check Sentry for authentication errors
- Monitor for unusual login patterns

### Weekly Security

- Review access logs (D1 query for admin API calls)
- Check for failed payment attempts
- Verify cron job integrity

### Monthly Security

- Rotate CRON_SECRET (CEO + Tech Lead present)
- Review who has infrastructure access
- Update ACCESS_OWNERSHIP_MATRIX.md if changes needed
- Run `npm audit` and review critical/high findings

### Emergency Security

If you suspect a security breach:
1. **Immediately:** Follow INCIDENT_RESPONSE.md Playbook 6
2. **Notify:** Tech Lead and Founder (if available)
3. **Preserve:** Do not modify any systems until evidence is collected
4. **Communicate:** Use security incident template (SECTION 14)

---

## 9. Change Management

### What the CEO Can Change (Without Consultation)

- Marketing copy and website text
- Social media posts
- Customer communications
- Pricing (within ±20% of current)
- Feature priority (reorder backlog)
- Support responses
- Internal documentation

### What Requires Tech Lead Consultation

- Production deployment
- Database schema changes
- API contract changes
- Infrastructure configuration
- Security settings
- Third-party integrations

### What Requires Founder Approval

- Architecture changes
- Major pricing changes (> ±20%)
- New payment providers
- Domain changes
- Legal/compliance changes

---

## 10. Escalation Guide

### Escalation Path

```
Level 0 (CEO handles):
├── Customer support
├── Marketing decisions
├── Feature prioritization
├── Documentation updates
│
Level 1 (Tech Lead):
├── Deployment issues
├── Technical incidents
├── Database problems
├── API failures
│
Level 2 (Founder):
├── Architecture decisions
├── Security breaches
├── Legal/compliance
├── Major outages (> 1 hour)
│
Level 3 (External):
├── Cloudflare support
├── Payment provider support
├── Legal counsel
├── Security auditor
```

### How to Reach Each Level

| Level | Contact | When |
|---|---|---|
| Tech Lead | [Tech Lead contact] | Technical issues, deployments, incidents |
| Founder | [Founder contact] | Architecture, security, legal, major outages |
| Cloudflare | dashboard support ticket | Infrastructure issues |
| NOWPayments | support@nowpayments.io | Payment issues |
| Sentry | sentry.io support | Error tracking issues |

---

## 11. Understanding the Data

### Key Database Tables

| Table | Purpose | CEO Relevance |
|---|---|---|
| `user` | Customer accounts | Customer list, tier status |
| `purchases` | Payment records | Revenue, refunds |
| `mission` | Content creation jobs | Usage, success rate |
| `cron_run_log` | Background job history | Operational health |
| `sentry_errors` | Error tracking | Platform health |
| `payments_audit` | Refund/change audit | Financial audit |
| `feedback` | Customer feedback | Customer satisfaction |
| `system_config` | Configuration | Feature flags |

### Common CEO Queries

**Who are my customers?**
```sql
SELECT id, email, tier, subscription_active, created_at
FROM user
WHERE subscription_active = 1
ORDER BY created_at DESC;
```

**How much revenue this month?**
```sql
SELECT COUNT(*) as transactions, SUM(amount) as total_revenue
FROM purchases
WHERE status = 'completed'
AND created_at > datetime('now', 'start of month');
```

**Which customers might be at risk?**
```sql
SELECT u.id, u.email, u.tier,
  MAX(m.created_at) as last_mission
FROM user u
LEFT JOIN mission m ON m.creator_id = u.id
WHERE u.subscription_active = 1
GROUP BY u.id
HAVING last_mission < datetime('now', '-14 days')
   OR last_mission IS NULL;
```

**What are the most common errors?**
```sql
SELECT fingerprint, COUNT(*) as occurrences
FROM sentry_errors
WHERE created_at > datetime('now', '-7 days')
GROUP BY fingerprint
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 12. Protected Flows (DO NOT BREAK)

These three flows are the backbone of the business. If any breaks, revenue stops.

### Flow 1: Setup Wizard

**What:** New customer onboarding — enters API keys, configures payment, connects Telegram
**Why protected:** If this breaks, no new customers can onboard
**Verification:** Test with a new email signup weekly

### Flow 2: Telegram Bot

**What:** @Sophia_Bbot responds to `/campaign`, `/status`, `/results`
**Why protected:** Customers interact with Sophia through Telegram daily
**Verification:** Send `/status` to the bot weekly

### Flow 3: Payment Flow

**What:** NOWPayments IPN webhook → tier activation
**Why protected:** If this breaks, revenue stops flowing
**Verification:** Check payment dashboard for recent successful transactions

---

## 13. Common Tasks

### Task: Verify a Customer's Payment

```sql
-- Check if payment was received
SELECT * FROM purchases
WHERE user_id = 'customer_id'
ORDER BY created_at DESC LIMIT 5;

-- Check if tier was activated
SELECT id, email, tier, subscription_active
FROM user WHERE id = 'customer_id';
```

### Task: Check Background Job Health

```sql
-- Recent cron job runs
SELECT job_name, status, created_at, duration_ms
FROM cron_run_log
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;

-- Failed jobs
SELECT * FROM cron_run_log
WHERE status = 'FAILED'
AND created_at > datetime('now', '-24 hours');
```

### Task: View Active Missions

```sql
-- Missions in progress
SELECT m.id, m.status, m.created_at, u.email as creator
FROM mission m
JOIN user u ON u.id = m.creator_id
WHERE m.status IN ('pending', 'in_progress')
ORDER BY m.created_at DESC;
```

### Task: Check AI Provider Usage

```sql
-- Missions by AI provider
SELECT
  CASE
    WHEN config LIKE '%openrouter%' THEN 'OpenRouter'
    WHEN config LIKE '%elevenlabs%' THEN 'ElevenLabs'
    WHEN config LIKE '%d-id%' THEN 'D-ID'
    WHEN config LIKE '%heygen%' THEN 'HeyGen'
    ELSE 'Other'
  END as provider,
  COUNT(*) as missions
FROM mission
WHERE created_at > datetime('now', '-30 days')
GROUP BY provider;
```

---

## 14. Incident Communication Templates

### Outage (SEV-1)

**Telegram:**
```
⚠️ Sophia is experiencing issues.

Status: Investigating
Impact: [describe what's affected]
Started: [time]
Next update: [time + 30 min]

We're working on this urgently.
```

### Resolved (SEV-1)

**Telegram:**
```
✅ Sophia is back online.

Duration: [X hours Y minutes]
Impact: [what was affected]
Root cause: [brief description]
Prevention: [what we're doing to prevent recurrence]

Thank you for your patience.
```

### Maintenance Window

**Telegram (24h advance):**
```
🔧 Scheduled maintenance

When: [date] at [time] [timezone]
Duration: Approximately [X] hours
Impact: [what will be affected]
What to expect: [any user action needed]

We'll send an update when maintenance begins and completes.
```

---

## 15. Legal & Compliance

### Data Handling

- Customer API keys encrypted with AES-256-GCM
- Customer data stored in Cloudflare D1 (US data centers)
- Backups stored in Cloudflare R2 (encrypted at rest)
- No customer data shared with third parties (except AI providers the customer configures)

### Privacy Considerations

- Privacy Policy and Terms of Service links on website
- Customer can delete account (self-service or support request)
- Data retention: active accounts only; deleted accounts removed within 30 days

### When to Involve Legal

| Situation | Action |
|---|---|
| Customer demands data deletion | Process request, document in feedback log |
| Customer disputes charges | Review payment audit log, process refund per policy |
| Potential IP infringement | Document, consult founder, potentially consult counsel |
| Regulatory inquiry | Immediately notify founder and legal counsel |

---

## 16. Quarterly Business Review

### Every Quarter, CEO Should:

1. **Review Financial Performance**
   - MRR growth rate
   - Customer acquisition cost
   - AI cost margins
   - Churn rate

2. **Review Customer Health**
   - NPS or equivalent feedback
   - Support ticket volume and resolution time
   - Feature requests (from feedback log)
   - At-risk customers

3. **Review Technical Health**
   - Platform uptime
   - Error rate trends
   - Performance metrics
   - Security posture

4. **Review Strategic Progress**
   - Product roadmap progress
   - Competitive landscape
   - Market opportunities
   - Team capacity

5. **Decision Points**
   - Pricing adjustments
   - Feature prioritization for next quarter
   - Infrastructure investments
   - Partnership opportunities

---

## Appendix A: Quick Reference Links

| Resource | Location |
|---|---|
| Health endpoint | https://sophia.agencyos.network/api/health |
| Sentry | https://sentry.io |
| Honeycomb | https://ui.honeycomb.io |
| Cloudflare | https://dash.cloudflare.com |
| GitHub | https://github.com/[org]/sophia-ai-factory |
| NOWPayments | https://dashboard.nowpayments.io |
| Inngest | https://app.inngest.com |

---

## Appendix B: Emergency Contacts

| Role | Name | Contact |
|---|---|---|
| Founder | [Founder] | [Phone/Telegram] |
| Tech Lead | [Tech Lead] | [Phone/Telegram] |
| Cloudflare Support | — | dashboard ticket |
| NOWPayments | — | support@nowpayments.io |
| Sentry | — | sentry.io support |

---

## Appendix C: Version History

| Date | Version | Changes |
|---|---|---|
| 2026-09-02 | 1.0 | Initial handbook created |

*Generated by CEO HANDOVER AUDIT, Phase 14.*