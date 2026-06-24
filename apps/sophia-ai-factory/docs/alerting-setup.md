# Alerting Setup — Sophia AI Factory

> Production monitoring and alerting configuration guide for operators.

## Overview

Sophia uses multiple observability tools. This document covers:

- **Sentry** — error tracking and alerting
- **Honeycomb** — distributed tracing (optional)
- **Telegram Bot** — operational notifications (optional)
- **Cloudflare Workers Analytics** — built-in metrics

All alerts integrate with the incident runbook (`docs/incident-runbook.md`).

---

## Sentry Alerts

### Prerequisites

- Sentry organization and project already created
- `SENTRY_AUTH_TOKEN` stored as Cloudflare Worker secret (set by deploy script)
- Source maps uploaded during deploy (`scripts/ci/sentry-upload-sourcemaps.sh`)

### Configure Alert Rules

1. Open Sentry project: https://sentry.io/organizations/[...]/projects/sophia-ai-factory/
2. Navigate to **Alerts** → **Create Alert Rule**
3. Choose issue or metric-based alerts:

#### Critical Issues Alert

- **Condition**: Issue is new and `level: error` or `level: fatal`
- **Frequency**: Immediately
- **Actions**:
  - Send email to `ops@sophia.agencyos.network`
  - Post to Telegram channel (if webhook configured)
- **Name**: `[Prod] New Critical Error`

#### Performance Regression

- **Condition**: `p75(lcp)` > 2.5s for 5 minutes
- **Actions**: Same as above
- **Name**: `[Prod] LCP Regression`

#### Unhandled Exception Spike

- **Condition**: `unhandled` errors > 10/min for 5 minutes
- **Actions**: Same as above
- **Name**: `[Prod] Error Spike`

### Slack/Telegram Integration

In Sentry → Integrations → Add **Slack** or **Telegram**:

For Telegram:
1. Create bot via @BotFather, get token
2. Get chat ID: `https://api.telegram.org/bot<token>/getUpdates`
3. Add integration with webhook URL: `https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat_id>&text={message}`

---

## Honeycomb Triggers (Optional)

If Honeycomb is enabled (`HONEYCOMB_API_KEY` set):

1. Open Honeycomb dataset: `sophia-production`
2. Create Trigger:
   - **Condition**: `count() WHERE status >= 500` > 5 for 2 minutes
   - **Action**: Send to Slack #sophia-alerts or PagerDuty
   - **Name**: `High Error Rate`
3. Create Trigger for latency:
   - **Condition**: `p99(duration)` > 5000ms for 5 minutes
   - **Name**: `High Latency`

---

## Telegram Bot Alerts

Sophia includes a built-in Telegram bot (`@Sophia_Bbot`) for operational commands.

### Alert Channel Setup

1. Create a dedicated Telegram group/channel for alerts (e.g., `Sophia Alerts`)
2. Add bot to the channel
3. Get channel ID (use @username_to_id_bot or programmatically)
4. Store `TELEGRAM_ALERT_CHAT_ID` in `.env.local` or as wrangler secret

### Automated Notifications

The following events trigger Telegram alerts:

- Deployment success/failure (via `deploy-with-sha.sh`)
- Payment webhook failures
- D1 migration errors
- Quota enforcement actions

Configuration in `src/forest/telegram/telegram-client.ts`:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALERT_CHAT_ID=-100xxxxxxxxxx
```

---

## Cloudflare Workers Analytics

Built-in metrics available in Cloudflare Dashboard:

- **Requests** — total HTTP requests
- **Errors** — 4xx/5xx responses
- **CPU Time** — compute time per request
- **Gateway Response Time** — latency at edge

Set up alerts in Cloudflare dashboard:

1. Workers & Pages → `sophia-ai-factory` → Analytics
2. Enable email alerts for:
   - Error rate > 5%
   - CPU time > 50ms p99
   - 5xx responses > 10/min

---

## Alert Triage Workflow

When an alert fires:

1. **Acknowledge** in the alert channel (Slack/Telegram)
2. Run health check: `npm run deploy:verify` or `curl https://sophia.agencyos.network/api/health`
3. Check recent deployments: `git log --oneline -10`
4. Consult runbook: `docs/runbooks/DEPLOYMENT-FAILURE.md` or appropriate
5. If rollback needed: `npx wrangler rollback --name sophia-ai-factory --yes`

See `docs/incident-runbook.md` for full incident response procedure.

---

## Alert Policy Summary

| Severity | Response Time | Channel | Escalation |
|----------|---------------|---------|------------|
| Critical (5xx spike, crash) | 15 min | Telegram + Email | PagerDuty (if configured) |
| Warning (high latency) | 1 hour | Telegram | Daily digest |
| Info (deployment) | None | Telegram | Archive |

---

## Maintenance

- Review Sentry/Honeycomb alert rules monthly
- Update notification channels when team composition changes
- Test alert delivery quarterly (send test messages)
- Keep this document in sync with actual monitoring setup
