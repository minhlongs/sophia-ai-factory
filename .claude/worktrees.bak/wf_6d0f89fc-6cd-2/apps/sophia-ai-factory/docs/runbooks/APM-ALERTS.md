# APM Alert Runbook

This runbook describes how to respond to Honeycomb/APM alerts.

## Setup

### Create SLOs in Honeycomb

Before alerts can be configured, create the following SLOs in Honeycomb (UI or API):

1. **Latency SLO**
   - Name: `Latency SLO`
   - Dataset: `sophia-prod`
   - Time window: 30 days
   - Target: p95 latency < 500ms

2. **Availability SLO**
   - Name: `Availability SLO`
   - Dataset: `sophia-prod`
   - Time window: 30 days
   - Target: Success rate (2xx/3xx) >= 99.9%

3. **Error Rate SLO**
   - Name: `Error Rate SLO`
   - Dataset: `sophia-prod`
   - Time window: 30 days
   - Target: 5xx rate < 0.1%

Note: The queries for these SLOs can be built using Honeycomb's SLO builder UI.

### Create Alerts

After SLOs are created, create alert triggers in Honeycomb:

- **High Latency Alert**
  - Condition: `p95(duration_ms) > 500` over 5 minutes
  - Notify: Slack #eng-alerts (or configured webhook)

- **Error Budget Burn Alert**
  - Condition: Availability < 99.9% over 1 hour OR Error rate > 0.5% over 15 minutes
  - Notify: Slack #eng-alerts

- **Metrics Endpoint Failure** (already covered by separate monitoring)

To create alerts via UI: Alerts → New Alert → select SLO or query → set threshold → set notification channel.

### Create Dashboard

Create a Honeycomb board named "SLO Overview" with panels:

- Latency heatmap (p50/p95/p99 by route)
- Error rate by status code
- Availability gauge
- Burn rate tracker
- Top slowest routes

Use the SLO panels to visualize the SLOs created above. See Honeycomb documentation for board creation.

## Alert Types

### 1. High Latency (p95 > 500ms)

**Trigger**: p95 latency > 500ms for > 5 minutes on any critical route.

**Response**:
1. Open Honeycomb → Query: `duration_ms:percentiles:p95 > 500 AND http.route:"/api/campaigns"` (adjust route)
2. Check recent deployments: `git log --oneline -10`
3. Identify slow spans: look for database queries (D1) or external API calls (fetch)
4. If correlated with a deploy, consider rollback: `npm run deploy:rollback`
5. If database-related, check D1 metrics in Cloudflare dashboard
6. Document incident in `#incidents` Slack channel

**Mitigation**:
- Tune slow D1 queries (add indexes)
- Cache frequent results in KV
- Increase worker CPU limit if CPU-bound

### 2. Error Budget Burn (Availability < 99.9%)

**Trigger**: Error rate > 0.1% over 1-hour window.

**Response**:
1. Check Honeycomb error rate query: `http.status_code:>=500 COUNT / http.status_code:*`
2. Identify top error routes and error messages
3. Check Sentry for stack traces: https://sentry.io/organizations/sophia-ai-factory/
4. If widespread 5xx, check Cloudflare Workers logs: `wrangler tail`
5. If database errors, verify D1 connectivity and quota
6. Apply hotfix if known issue, otherwise escalate to on-call engineer

**Rollback**: `npx wrangler rollback --name sophia-ai-factory`

### 3. Metrics Endpoint Failure

**Trigger**: `/api/metrics` returns non-200 or empty.

**Response**:
1. curl the endpoint with auth: `curl -H "Authorization: Bearer $METRICS_BEARER_TOKEN" https://sophia.agencyos.network/api/metrics`
2. If 500, check Worker logs: `wrangler tail --name sophia-ai-factory`
3. Verify `METRICS_BEARER_TOKEN` secret exists: `npx wrangler secret list`
4. Redeploy if needed: `npm run deploy:full`

## Escalation

- P0 (site-wide outage): Page CTO immediately
- P1 (critical feature degraded): Notify engineering Slack within 5 min
- P2 (minor degradation): Create ticket, address within business hours

## Contacts

- On-call: check PagerDuty rotation
- Infra lead: Long Tho
- Slack: #eng-alerts
