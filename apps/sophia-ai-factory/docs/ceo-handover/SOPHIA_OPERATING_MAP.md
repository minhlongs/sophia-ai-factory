# SOPHIA OPERATING MAP — SYSTEM OVERVIEW FOR CEO

> Version: 1.0 | Baseline: `5dd1f071` | Owner: CEO
> Last Updated: 2026-09-02
>
> **Read this if you're new to Sophia.** This document explains every major system, what it does, why it exists, who owns it, what breaks if it fails, and how to check/recover.

---

## How to Read This Map

Each system has 7 standard sections:
- **WHAT IT DOES** — Plain English description
- **WHY IT EXISTS** — Business purpose
- **WHO OWNS IT** — Responsible role
- **WHAT BREAKS IF IT FAILS** — Impact assessment
- **HOW TO CHECK HEALTH** — Quick verification
- **HOW TO RECOVER** — Restoration steps
- **WHEN CEO MUST ESCALATE** — Decision boundary

---

## 1. PRODUCT — Sophia AI Factory

### WHAT IT DOES
Sophia is a SaaS platform that helps agencies create AI-powered social media content. Customers connect their own AI API keys (BYOK), configure payment, and create "missions" — automated workflows that generate text, images, voice, and video content for social media posting.

### WHY IT EXISTS
Agencies need to produce high-volume content at low cost. Sophia automates the content creation pipeline while keeping humans in the approval loop.

### WHO OWNS IT
CEO (strategy) + Tech Lead (execution)

### WHAT BREAKS IF IT FAILS
- Customers cannot create content → revenue stops
- Missions fail → customer trust erodes
- Content quality drops → churn increases

### HOW TO CHECK HEALTH
- Active missions completing successfully (> 80%)
- Customer complaints < 5/week
- New signups completing Setup Wizard

### HOW TO RECOVER
Follow incident playbooks in `INCIDENT_RESPONSE.md` based on failing component

### WHEN CEO MUST ESCALATE
- > 50% mission failure rate for > 1 hour
- Revenue impact > $1,000/day
- Customer data loss

---

## 2. APPLICATION — Next.js on Cloudflare Workers

### WHAT IT DOES
The web application serving all customer-facing pages (dashboard, setup wizard, mission management) and API routes (63 routes). Built with Next.js 16 App Router, deployed as Cloudflare Workers via OpenNext.

### WHY IT EXISTS
Primary customer interface. All user interactions happen here.

### WHO OWNS IT
Tech Lead

### WHAT BREAKS IF IT FAILS
- Website unreachable → no new signups, no customer access
- API errors → missions fail, payments fail, onboarding fails
- Slow response → poor user experience

### HOW TO CHECK HEALTH
```bash
curl -s https://sophia.agencyos.network/api/health | jq .
curl -s https://sophia.agencyos.network/login | head -5
# Should return HTML with login form
```

### HOW TO RECOVER
1. Check Cloudflare Workers dashboard for errors
2. Rollback if recent deploy: `npx wrangler rollback --name sophia-ai-factory`
3. If database issue, follow Playbook 3 in `INCIDENT_RESPONSE.md`

### WHEN CEO MUST ESCALATE
- Application down > 15 minutes (SEV-1)
- Data integrity concern
- Security breach suspected

---

## 3. SERVICES — External API Dependencies

### 3.1 AI Providers

| Provider | Purpose | Key |
|---|---|---|
| **OpenRouter** | Text generation (GPT, Claude, etc.) | Customer BYOK |
| **ElevenLabs** | Voice synthesis | Customer BYOK |
| **D-ID** | Talking head video | Customer BYOK |
| **HeyGen** | Avatar video | Customer BYOK |
| **Tavily** | Web search | Customer BYOK |

**WHAT BREAKS IF FAILS:** Content generation stops for that modality
**HOW TO CHECK:** Circuit breaker status in admin dashboard, Sentry errors
**RECOVERY:** Customers must fix their own keys; platform has circuit breakers

### 3.2 Payment Providers

| Provider | Purpose | Key |
|---|---|---|
| **NOWPayments** | Crypto payments (primary) | Platform config |
| **PayOS** | Vietnam domestic payments | Platform config |

**WHAT BREAKS IF FAILS:** Revenue stops; tier activation fails
**HOW TO CHECK:** Provider dashboard, webhook logs in D1
**RECOVERY:** Manual tier activation via D1 (see SOP-08)

### 3.3 Communication

| Provider | Purpose | Key |
|---|---|---|
| **Telegram Bot** | Customer commands & notifications | Bot token (platform) |
| **Resend** | Transactional emails | Platform config |

**WHAT BREAKS IF FAILS:** No customer notifications; bot commands fail
**HOW TO CHECK:** Send `/status` to @Sophia_Bbot, check Resend dashboard

### 3.4 Infrastructure Services

| Provider | Purpose | Key |
|---|---|---|
| **Cloudflare** | Workers, D1, R2, DNS, Pages | Platform account |
| **GitHub** | Source code, issues | Platform account |
| **Inngest** | Workflow orchestration | Platform account |
| **Sentry** | Error tracking | Platform account |
| **Honeycomb** | Observability | Platform account |

**WHAT BREAKS IF FAILS:** Core platform infrastructure unavailable
**HOW TO CHECK:** Each service dashboard
**RECOVERY:** Follow provider-specific recovery

---

## 4. DATABASE — Cloudflare D1 (SQLite)

### WHAT IT DOES
Primary persistent storage. ~50 tables storing users, missions, payments, API keys (encrypted), configuration, audit logs, and cron job history.

### WHY IT EXISTS
All customer data, mission state, and operational records must persist reliably.

### WHO OWNS IT
Tech Lead

### WHAT BREAKS IF IT FAILS
- Cannot read/write customer data
- Missions stall
- Payments cannot be recorded
- Onboarding cannot complete

### HOW TO CHECK HEALTH
```bash
# Quick check
npx wrangler d1 execute sophia-raas-db --command="SELECT 1" --remote

# Row counts
npx wrangler d1 execute sophia-raas-db --command="SELECT 'user' as t, COUNT(*) FROM user UNION ALL SELECT 'mission', COUNT(*) FROM mission UNION ALL SELECT 'purchases', COUNT(*) FROM purchases" --remote

# Recent activity
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM cron_run_log ORDER BY created_at DESC LIMIT 10" --remote
```

### HOW TO RECOVER
**⚠️ RESTORE NEVER TESTED — See DISASTER_RECOVERY_READINESS.md**
1. List backups: `npx wrangler s3 object list sophia-backups --prefix d1-`
2. Download: `npx wrangler s3 object get sophia-backups/d1-YYYY-MM-DD.sql --file=restore.sql`
3. Create scratch DB: `npx wrangler d1 create sophia-restore-test`
4. Test restore: `npx wrangler d1 execute sophia-restore-test --file=restore.sql --remote`
5. If test passes, apply to production: `npx wrangler d1 execute sophia-raas-db --file=restore.sql --remote`

### WHEN CEO MUST ESCALATE
- D1 completely unavailable (SEV-1)
- Data corruption suspected
- Restore needed (founder/tech lead required)

---

## 5. STORAGE — Cloudflare R2

### WHAT IT DOES
Object storage for:
- D1 database backups (30-day lifecycle)
- Generated images/videos (temporary)
- OpenNext cache bucket

### WHY IT EXISTS
D1 is SQLite — no native backup. R2 provides durable, cheap object storage with automatic lifecycle.

### WHO OWNS IT
Tech Lead

### WHAT BREAKS IF IT FAILS
- No new backups
- Generated assets unavailable
- OpenNext cache misses (performance impact)

### HOW TO CHECK HEALTH
```bash
npx wrangler s3 object list sophia-backups --prefix d1- | tail -5
npx wrangler s3 object list sophia-ai-factory-opennext-cache | head -5
```

### HOW TO RECOVER
R2 is highly durable (99.999999999%). If bucket deleted, recreate and reconfigure lifecycle.

### WHEN CEO MUST ESCALATE
- R2 bucket deleted or inaccessible

---

## 6. AI PROVIDERS (Customer-Side — BYOK)

### WHAT IT DOES
Customers enter their own API keys for AI services during Setup Wizard. Platform encrypts and stores keys, uses them to call providers on customer's behalf.

### WHY IT EXISTS
No-code doctrine: customers own their AI relationships, control costs, avoid platform markup.

### WHO OWNS IT
Customer (keys) / Tech Lead (encryption/integration)

### WHAT BREAKS IF IT FAILS
- Invalid/expired key → missions fail for that customer
- Provider outage → all customers using that provider affected
- Key rotation needed → customer must update in dashboard

### HOW TO CHECK HEALTH
- Circuit breaker status per provider (admin dashboard)
- Sentry errors filtered by provider
- Customer support tickets about "generation failed"

### HOW TO RECOVER
- Provider outage: wait, circuit breaker auto-recovers
- Invalid key: customer updates in dashboard
- Platform bug: deploy fix via CF-direct

### WHEN CEO MUST ESCALATE
- Multiple customers affected by same provider issue
- Suspected key leak (security incident)

---

## 7. BACKGROUND JOBS — Cron + Inngest

### 7.1 Cron Jobs (43 routes)
Scheduled tasks running on Cloudflare Workers schedule:

| Category | Examples | Frequency |
|---|---|---|
| Backup | `d1-backup` | Daily |
| Billing | `dunning-check`, `overage-billing` | Hourly |
| Usage | `usage-metering`, `quota-reset` | Hourly/Daily |
| AI | `model-health-check` | Every 15 min |
| Cleanup | `cleanup-expired`, `cleanup-orphans` | Daily |
| Analytics | `aggregate-metrics` | Hourly |

### 7.2 Inngest Functions (10)
Long-running workflows with retry/state:

| Function | Purpose |
|---|---|
| `video-generation` | Multi-step video creation |
| `mission-orchestrator` | Full mission pipeline |
| `dunning-handler` | Failed payment retries |
| `commission-payout` | Affiliate commissions |

### WHY IT EXISTS
Async work that doesn't fit in HTTP request timeout (30s Workers limit).

### WHO OWNS IT
Tech Lead

### WHAT BREAKS IF IT FAILS
- Missions don't complete
- Payments not retried
- Usage not metered → billing inaccurate
- Backups not created

### HOW TO CHECK HEALTH
```bash
# Cron logs
curl -s https://sophia.agencyos.network/api/cron/health-check -H "Authorization: Bearer $CRON_SECRET" | jq .

# D1 cron log
npx wrangler d1 execute sophia-raas-db --command="SELECT job_name, status, COUNT(*) FROM cron_run_log WHERE created_at > datetime('now', '-24 hours') GROUP BY job_name, status" --remote

# Inngest
→ https://app.inngest.com (function runs tab)
```

### HOW TO RECOVER
- Failed cron: re-trigger manually via curl with CRON_SECRET
- Stuck Inngest: replay from Inngest dashboard
- Stuck mission: check `mission` table status, manually advance if needed

### WHEN CEO MUST ESCALATE
- Multiple cron jobs failing simultaneously
- Inngest completely down
- Backlog > 100 stuck missions

---

## 8. AUTH — Better Auth

### WHAT IT DOES
Authentication system: email/password signup, JWT sessions, password reset, email verification. Integrates with Next.js middleware for route protection.

### WHY IT EXISTS
Secure customer access to their data and missions.

### WHO OWNS IT
Tech Lead

### WHAT BREAKS IF IT FAILS
- Cannot login/signup
- Sessions expire unexpectedly
- Unauthorized access risk

### HOW TO CHECK HEALTH
```bash
# Check auth routes
curl -s https://sophia.agencyos.network/api/auth/signin | head -5
# Try login flow manually
```

### HOW TO RECOVER
- Check Better Auth configuration
- Verify `BETTER_AUTH_SECRET` in Cloudflare secrets
- Check D1 `user` table integrity

### WHEN CEO MUST ESCALATE
- Auth bypass vulnerability (SEV-1 security)
- Mass session invalidation

---

## 9. PAYMENTS — NOWPayments + PayOS

### WHAT IT DOES
Payment processing via webhook (IPN) from NOWPayments/PayOS → tier activation in D1.

### WHY IT EXISTS
Revenue collection and automatic tier management.

### WHO OWNS IT
CEO (business) + Tech Lead (technical)

### WHAT BREAKS IF IT FAILS
- Payments received but tier not activated (revenue loss, customer anger)
- Webhook signature verification fails
- Duplicate payments

### HOW TO CHECK HEALTH
```bash
# Recent payments
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM purchases WHERE created_at > datetime('now', '-24 hours') ORDER BY created_at DESC" --remote

# Webhook logs
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM cron_run_log WHERE job_name LIKE '%payment%' ORDER BY created_at DESC LIMIT 10" --remote
```

### HOW TO RECOVER
See SOP-08: manual tier activation via D1 update

### WHEN CEO MUST ESCALATE
- > 5 payment failures in 24h
- Payment provider outage > 1 hour
- Suspected fraud

---

## 10. ANALYTICS — Metrics & Observability

### 10.1 Business Metrics (D1 queries)
- MRR, ARR, revenue, refunds
- Active customers, churn, retention
- Mission success rates
- AI cost per mission

### 10.2 Technical Metrics
- **Sentry:** Error tracking, alerting
- **Honeycomb:** Distributed tracing, performance
- **Cloudflare Analytics:** Workers CPU, requests, errors
- **Inngest Dashboard:** Function execution, latency

### WHO OWNS IT
CEO (business) / Tech Lead (technical)

### HOW TO CHECK HEALTH
- Sentry: check for new error groups
- Honeycomb: check latency percentiles
- Cloudflare: check Workers success rate
- Inngest: check function success rate

### WHEN CEO MUST ESCALATE
- Error rate spike > 2x baseline
- P99 latency > 5s
- Workers error rate > 1%

---

## 11. DEPLOYMENT — CF-Direct Doctrine

### WHAT IT DOES
Local build + deploy via `npm run deploy:full` using Wrangler CLI. No GitHub Actions.

### WHY IT EXISTS
- Simplicity: no CI/CD pipeline to maintain
- Speed: deploy from laptop in ~2 minutes
- Control: SHA verification proves exact code is live

### WHO OWNS IT
Tech Lead (executes) / CEO (approves)

### WHAT BREAKS IF IT FAILS
- Cannot deploy fixes or features
- Stale code in production

### HOW TO CHECK HEALTH
```bash
# Verify deploy matches commit
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ MATCH" || echo "❌ MISMATCH"
```

### HOW TO RECOVER
- Rollback: `npx wrangler rollback --name sophia-ai-factory`
- Redeploy specific commit: `git checkout <sha> && npm run deploy:full`

### WHEN CEO MUST ESCALATE
- Deploy fails repeatedly
- Production SHA mismatch after deploy
- Need to deploy hotfix but Tech Lead unavailable

---

## 12. MONITORING — Health & Alerting

### Active Monitoring
| System | What It Monitors | Alert Channel |
|---|---|---|
| **Sentry** | Application errors | Sentry alerts → email |
| **Honeycomb** | Latency, throughput | Honeycomb triggers |
| **Cloudflare Workers** | CPU, memory, errors | CF dashboard |
| **Inngest** | Function failures | Inngest alerts |
| **Cron health** | `/api/cron/health-check` | Manual check |
| **Better Stack** | Uptime (if configured) | SMS/Email |

### Passive Monitoring (CEO Checks)
- Daily: `/api/health`, Sentry, cron health
- Weekly: Business metrics, error trends
- Monthly: Full operational review

### WHAT BREAKS IF IT FAILS
- Blind to production issues
- Delayed incident detection

### HOW TO RECOVER
- Restore monitoring access
- Add missing alerts

### WHEN CEO MUST ESCALATE
- Monitoring completely down
- Critical alert not firing

---

## Quick Reference: System Ownership

| System | Owner | Access Required |
|---|---|---|
| Application | Tech Lead | Cloudflare Workers, GitHub |
| Database (D1) | Tech Lead | Cloudflare D1, R2 |
| Storage (R2) | Tech Lead | Cloudflare R2 |
| AI Providers | Customer / Tech Lead | Provider dashboards |
| Payments | CEO + Tech Lead | NOWPayments, PayOS |
| Auth | Tech Lead | Cloudflare secrets |
| Background Jobs | Tech Lead | Cloudflare, Inngest |
| Monitoring | Tech Lead | Sentry, Honeycomb, CF |
| Deployment | Tech Lead | Local machine, Cloudflare |
| DNS/Domain | Founder | Cloudflare DNS |

---

## Quick Reference: Failure Impact

| System Failure | Customer Impact | Revenue Impact | Recovery Time |
|---|---|---|---|
| Application | Complete outage | Immediate | 5-30 min (rollback) |
| D1 Database | Complete outage | Immediate | 30-120 min (restore) |
| R2 Storage | Partial (backups, assets) | Delayed | 10-30 min |
| NOWPayments | No new revenue | Immediate | Provider dependent |
| Telegram Bot | No bot commands | Delayed | 5-10 min |
| Inngest | Missions stall | Delayed | 10-30 min |
| Cron Jobs | Billing, backups stop | Delayed | 5-15 min |
| Auth | No login | Immediate | 5-30 min |
| AI Providers | Content generation fails | Delayed | Provider dependent |

---

## CEO Decision Matrix

| Situation | CEO Can Decide | CEO Needs Tech Lead | CEO Needs Founder |
|---|---|---|---|
| Customer refund < $100 | ✅ | | |
| Customer refund > $100 | | ✅ | |
| Pricing change ±20% | ✅ | | |
| Pricing change > ±20% | | | ✅ |
| Feature priority | ✅ | | |
| Deploy to production | | ✅ | |
| Database migration | | ✅ | |
| Security incident | | ✅ | ✅ |
| Architecture change | | | ✅ |
| New payment provider | | | ✅ |
| Domain change | | | ✅ |

---

*Generated by CEO HANDOVER AUDIT, Phase 2.*