# CF Quota Response Runbook

**Audience:** Platform operator (non-technical CEO)  
**Trigger:** Sentry alert with tag `quota_metric` OR email from automated quota check  
**Last updated:** 2026-05-20

---

## What This Means

Sophia AI Factory runs on Cloudflare's infrastructure. Cloudflare provides a **free tier** with usage limits. When usage approaches these limits, the platform may slow down or become unavailable until the billing cycle resets (or you upgrade the plan).

The automated quota check runs **every hour** and sends Sentry alerts when usage crosses thresholds.

---

## Thresholds and What to Do

### GREEN (< 70%) — No action needed

Everything is normal. No intervention required.

---

### YELLOW — Warning (70%–89%)

**What happened:** Usage is elevated. You have headroom but should monitor closely.

**Steps:**

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → Select your account → **Analytics & Logs**.
2. Check which metric triggered the alert (the Sentry alert tag `quota_metric` tells you: `workers_requests_daily`, `d1_reads_daily`, `d1_writes_daily`, or `r2_storage_gb`).
3. Check if there was an unusual spike (campaign launch, viral traffic, cron storm).
4. **No immediate action needed** unless the metric is climbing fast.
5. Reply to Sentry alert with note: "Acknowledged — monitoring."

**Consider:** If this happens repeatedly, plan a Cloudflare paid plan upgrade (see Upgrade section below).

---

### RED — Critical (90%–99%)

**What happened:** Usage is dangerously high. Action needed within 2 hours.

**Steps:**

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → Analytics → identify the overloaded metric.
2. Identify the cause:
   - **Workers requests high:** Possible cron storm, bot traffic, or viral campaign. Check Worker logs: `npx wrangler tail --name sophia-ai-factory`.
   - **D1 reads/writes high:** Likely a cron loop or large batch job. Check `cron_run_log` table for recent run counts: `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT cron_name, run_count, last_run_at FROM cron_run_log ORDER BY run_count DESC LIMIT 10;"`.
   - **R2 storage high:** Videos or backups accumulating. Check bucket size.
3. **Mitigation options:**
   - Temporarily disable non-critical cron schedules in `wrangler.toml` (comment out cron lines, redeploy).
   - Pause high-frequency crons (e.g., `*/2 * * * *` fulfillment-retry) by removing from cron triggers.
   - Upgrade Cloudflare plan to Workers Paid ($5/mo) to raise limits immediately.
4. Notify support team or escalation contacts (see `docs/escalation-contacts.md`).

---

### BLACK — Page On-Call (100%)

**What happened:** Quota is exhausted. The platform may be returning errors to users.

**Immediate action (within 30 minutes):**

1. **Upgrade Cloudflare plan NOW:**
   - Dashboard → Account → Plans → Upgrade to Workers Paid ($5/mo).
   - Workers Paid gives: 10M requests/day, unlimited D1 within fair use.
   - R2: first 10GB free; storage doesn't block Workers.

2. **Check platform health:**
   ```bash
   curl -sI https://sophia.agencyos.network | head -3
   # Should return HTTP/2 200 — if 429 or 5xx, quota is blocking requests
   ```

3. **Check which metric hit 100%:**
   - Workers requests → Users get 429 errors. Upgrade immediately.
   - D1 reads → DB queries fail. Most features broken. Upgrade immediately.
   - D1 writes → Write operations fail (payments, state updates). Critical. Upgrade immediately.
   - R2 storage → File uploads fail (videos). Non-critical for core features.

4. **Customer communication (if > 15 min downtime):**
   Use the template below.

5. **Post-incident:** Create entry in `docs/postmortems/` after resolution.

---

## Customer Communication Template

**Subject:** Sophia Platform — Brief Service Disruption (Resolved)

---

Dear [Customer Name],

We experienced a brief service disruption affecting Sophia AI Factory from [START TIME] to [END TIME] (Vietnam time).

**What happened:** Our platform infrastructure reached its usage limit due to [high traffic / campaign activity / scheduled jobs].

**What we did:** We upgraded our infrastructure plan to prevent this from occurring again.

**Your data is safe.** No data was lost. Campaigns that were running may have been delayed — please check your campaign status in the dashboard.

We apologize for the inconvenience. If you have questions, contact us at support@mekongmind.com.

Best regards,  
Sophia AI Factory Team

---

## Upgrade Plan

| Plan | Monthly cost | Workers requests | D1 reads | D1 writes | R2 storage |
|------|-------------|-----------------|----------|-----------|-----------|
| Free | $0 | 100K/day | 5M/day | 100K/day | 10GB |
| Workers Paid | $5/mo | 10M/day | 25M/day | 50M/day | 10GB free then $0.015/GB |
| Workers + D1 | $5/mo + D1 overage | 10M/day | Billed per read | Billed per write | 10GB free |

**To upgrade:** Cloudflare Dashboard → Account → Plans → Workers Paid.

D1 overage pricing (beyond free tier): $0.001 per 1M reads, $1.00 per 1M writes (approximate — check CF pricing page).

---

## Quota Check Script (Manual Run)

To manually check current quota usage:

```bash
cd apps/sophia-ai-factory
CLOUDFLARE_API_TOKEN=<your-token> CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  npx tsx scripts/check-cf-quota.ts
```

Output example:
```
[CF Quota Check] 2026-05-20T14:00:00.000Z
  OK       workers_requests_daily: 45000 / 100000 requests/day (45%)
  OK       d1_reads_daily: 2100000 / 5000000 reads/day (42%)
  WARNING  d1_writes_daily: 72000 / 100000 writes/day (72%)
  OK       r2_storage_gb: 3.2 / 10 GB (32%)
Summary: 1 alert(s) — d1_writes_daily@72%
```

---

## Escalation Contacts

See `docs/escalation-contacts.md` for current contact list.

For CF infrastructure emergencies: [Cloudflare Support](https://support.cloudflare.com) — include account ID in ticket.

---

## Related Files

- `scripts/check-cf-quota.ts` — automated quota check implementation
- `docs/runbooks/d1-region-failure.md` — D1 database outage runbook
- `docs/disaster-recovery.md` — general DR procedures
- `docs/escalation-contacts.md` — who to call
