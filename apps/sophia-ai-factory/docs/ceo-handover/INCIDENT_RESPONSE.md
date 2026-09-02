# INCIDENT RESPONSE — SOPHIA AI FACTORY

> Baseline SHA: `5dd1f071` | Generated: 2026-09-02
> Severity definitions, escalation paths, and playbooks for production incidents.

---

## Severity Definitions

| SEV | Name | Response Time | Resolution Target | Example |
|-----|------|---------------|-------------------|---------|
| **SEV-1** | Critical | Immediate (within 15 min) | 2 hours | Platform down, data loss, security breach, protected flow broken |
| **SEV-2** | Major | Within 30 min | 8 hours | Core feature broken, degraded performance, cron failures |
| **SEV-3** | Minor | Within 4 hours | 24 hours | Non-critical bug, cosmetic issue, single-user issue |
| **SEV-4** | Low | Next business day | 72 hours | Enhancement request, minor UX issue |

---

## Escalation Path

```
Incident detected (Sentry / monitoring / customer report)
  → On-call classifies severity
  → SEV-1/2: Page Tech Lead immediately
  → SEV-3/4: Create ticket, handle in normal workflow
  → If founder-dependent (credentials / provider): Escalate to Founder
  → Postmortem within 24h for SEV-1, 48h for SEV-2
```

---

## Playbooks

### PLAYBOOK 1: Platform Down (SEV-1)

**Trigger:** `GET /api/health` returns non-200 or timeout

1. **Verify** — `curl -sI https://sophia.agencyos.network/api/health`
2. **Check last deploy** — `curl -s https://sophia.agencyos.network/api/version`
3. **If regression after recent deploy** — Roll back immediately:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --yes
   ```
4. **Verify rollback** — `curl -s https://sophia.agencyos.network/api/version` → old SHA
5. **Health check** — `curl -s https://sophia.agencyos.network/api/health` → 200
6. **If NOT a regression** — Check Cloudflare status, D1 status, DNS
7. **Notify customers** — Telegram bot message
8. **Postmortem** — Within 24h

### PLAYBOOK 2: Protected Flow Broken (SEV-1)

**Trigger:** Setup Wizard, Telegram Bot, or Payment Flow fails

**Setup Wizard broken:**
1. Test full onboarding flow end-to-end
2. Check `/api/setup-wizard/*` routes
3. Check API key encryption/decryption
4. If code issue → Rollback
5. If provider issue → Check provider status pages

**Telegram Bot broken:**
1. Send `/campaign` to @Sophia_Bbot
2. Check webhook registration: `curl -s https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. If webhook dropped → Re-register
4. If bot not responding → Check Inngest workflows

**Payment Flow broken:**
1. Check NOWPayments IPN webhook logs
2. Verify `/api/payments/nowpayments/*` routes
3. Check tier activation logic
4. If webhook not arriving → Check NOWPayments dashboard
5. If activation failing → Check database tier assignment

### PLAYBOOK 3: D1 Database Issues (SEV-1/2)

**Trigger:** Database errors in Sentry, slow queries, connection failures

1. **Check D1 status** — Cloudflare dashboard → D1 → `sophia-raas-db`
2. **Query recent errors** — `wrangler d1 execute sophia-raas-db --command "SELECT * FROM cron_run_log ORDER BY created_at DESC LIMIT 10"`
3. **If corruption suspected** — Trigger backup immediately:
   ```bash
   curl -X POST https://sophia.agencyos.network/api/cron/d1-backup \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
4. **If restore needed** — Follow DISASTER_RECOVERY_READINESS.md procedure
5. **If migration issue** — Check recent migrations in `src/seed/db/migrations/`

### PLAYBOOK 4: Cron Job Failures (SEV-2)

**Trigger:** Sentry alerts for cron routes, cron_run_log shows failures

1. **Identify failing cron** — Check Sentry or query `cron_run_log`
2. **Check route directly** — `curl -s https://sophia.agencyos.network/api/cron/<job-name>`
3. **Common causes:**
   - Provider API timeout → Check provider status
   - D1 write failure → Check database
   - Missing environment variable → Check CF dashboard
4. **If transient** — Wait for next scheduled run
5. **If persistent** — Investigate code, check recent changes

### PLAYBOOK 5: Performance Degradation (SEV-2)

**Trigger:** High latency alerts, p95 > 5s

1. **Check metrics** — `curl -s -H "Authorization: Bearer $METRICS_BEARER_TOKEN" https://sophia.agencyos.network/api/metrics`
2. **Identify slow routes** — p95/p99 per route
3. **Check Cloudflare** — Workers limits, D1 latency, R2 latency
4. **Check AI providers** — Provider response times
5. **If Workers limit** — Consider upgrade or optimization
6. **If provider slow** — Circuit breaker should activate

### PLAYBOOK 6: Security Incident (SEV-1)

**Trigger:** Unauthorized access, data exposure, credential leak

1. **Contain** — Rotate affected credentials immediately
2. **Assess** — What data was exposed? Which customers affected?
3. **Notify** — Founder + Tech Lead immediately
4. **Investigate** — Check access logs, Sentry, Cloudflare analytics
5. **Remediate** — Fix vulnerability, rotate all related credentials
6. **Disclose** — If customer data affected, notify per legal requirements
7. **Postmortem** — Within 24h, include timeline + impact

### PLAYBOOK 7: AI Provider Outage (SEV-2)

**Trigger:** OpenRouter, ElevenLabs, D-ID, or HeyGen unreachable

1. **Check provider status page**
2. **Verify circuit breaker state** — `src/seed/security/circuit-breaker`
3. **If single provider** — Other providers should continue
4. **If OpenRouter down** — All AI completions affected; missions will queue
5. **Communicate** — Notify affected customers if prolonged
6. **Monitor** — Circuit breaker will auto-recover when provider returns

### PLAYBOOK 8: Cost Overrun (SEV-2)

**Trigger:** AI cost exceeds threshold, budget alerts

1. **Check cost data** — `agent-cost-overrun-scan` cron output
2. **Identify source** — Which missions/agents are consuming most?
3. **If runaway agent** — Consider pausing mission
4. **If provider pricing change** — Evaluate alternatives
5. **Adjust thresholds** — Update cost limits if needed

### PLAYBOOK 9: Customer Data Issue (SEV-3)

**Trigger:** Customer reports data loss, incorrect data, or access issues

1. **Verify claim** — Query D1 for customer's data
2. **If data exists** — Help customer access it
3. **If data missing** — Check recent operations, migrations
4. **If our bug** — Fix + compensate per DECISION_RIGHTS.md
5. **If customer error** — Guide them through recovery

### PLAYBOOK 10: Deployment Failure (SEV-2)

**Trigger:** `npm run deploy:full` fails, SHA mismatch, build errors

1. **Check build** — `npm run build` locally
2. **Check tests** — `npm test`
3. **Check types** — `npm run typecheck`
4. **If build fails** — Fix errors, do not deploy broken code
5. **If deploy fails** — Check wrangler auth, CF account limits
6. **If SHA mismatch** — Verify `git status` is clean, redeploy
7. **Never deploy with dirty tree** — Per DECISION_RIGHTS.md

---

## Communication Templates

### Customer Notification (Telegram)

```
⚠️ Sophia Platform Status Update

We're experiencing [issue description].
Impact: [what's affected]
Status: [investigating / fixing / resolved]
ETA: [estimated resolution]

We apologize for the inconvenience.
— Sophia Team
```

### Internal Escalation (Slack/Call)

```
🚨 SEV-[X] INCIDENT

What: [description]
Impact: [who/what is affected]
Status: [current status]
Next: [what's being done]
Owner: [name]
```

---

## Postmortem Template

```markdown
# Postmortem: [Incident Title]

Date: YYYY-MM-DD
Severity: SEV-X
Duration: X hours Y minutes
Impact: [description]

## Timeline
- HH:MM — [event]
- HH:MM — [event]

## Root Cause
[description]

## What Went Well
- [item]

## What Went Wrong
- [item]

## Action Items
- [ ] [action] — Owner: [name] — Due: [date]

## Lessons Learned
[description]
```

---

## On-Call Rotation

| Period | Primary | Backup |
|---|---|---|
| Business hours (VN) | Tech Lead | Founder |
| After hours | Tech Lead | Founder (SEV-1 only) |

**Note:** Per the no-tech doctrine, the CEO manages the *platform* and escalates technical incidents to the Tech Lead. The CEO does not need to be on-call but must be reachable for SEV-1 customer-facing incidents.

*Generated by CEO HANDOVER AUDIT, Phase 6.*