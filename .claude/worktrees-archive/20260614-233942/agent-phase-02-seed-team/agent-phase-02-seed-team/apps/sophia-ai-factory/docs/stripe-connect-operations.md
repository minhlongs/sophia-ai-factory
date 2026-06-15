# Stripe Connect Operations Guide

> Operator guide for Stripe Connect webhook registration, secret rotation, and event monitoring.
> Supplements `docs/payout-operations-runbook.md` with infrastructure setup procedures.

---

## Webhook Registration

### Initial Setup

1. **Open Stripe Dashboard**
   - Navigate to Dashboard → Developers → Webhooks
   - Select the appropriate environment (Test or Live)

2. **Add Endpoint**
   - Click "Add an endpoint"
   - Paste endpoint URL: `https://sophia.agencyos.network/api/webhooks/stripe-connect`
   - Event version: Keep default (latest)

3. **Subscribe to Events**
   - Under "Select events to send to this endpoint", choose:
     - `account.updated` — Account KYC status changes, requirements updates
     - `account.application.deauthorized` — User disconnects Connect account
   - Do NOT select `charge.`, `payment_intent.`, or other payment events (we only process Connect account events)

4. **Copy Signing Secret**
   - After endpoint is created, Stripe displays the signing secret (starts with `whsec_` in test, `whsec_` in live)
   - Click "Reveal" to see the full secret
   - **DO NOT share this secret in logs, Slack, or email**

### Store Secret in Cloudflare

```bash
# Read the signing secret from Stripe Dashboard and paste when prompted
npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET --name sophia-ai-factory

# Verify secret was set (shows only `[REDACTED]`)
npx wrangler secret list --name sophia-ai-factory | grep STRIPE
```

---

## Secret Rotation Procedure

### When to Rotate

- **Suspected compromise:** If secret may be exposed in logs, error messages, or git history
- **Scheduled rotation:** Every 90 days as security best practice
- **Key change:** If Stripe dashboard shows old secret still accepting webhooks after 3+ days

### Rotation Steps

1. **Generate New Signing Secret in Stripe Dashboard**
   - Dashboard → Developers → Webhooks → Endpoint → "Roll signing secret"
   - Stripe displays the NEW secret and begins accepting both old + new simultaneously (for 24h)

2. **Update Cloudflare Worker Secret**
   ```bash
   npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET --name sophia-ai-factory
   # Paste the NEW secret when prompted
   ```

3. **Verify with Test Event**
   - In Stripe Dashboard, click the endpoint → "Send test event"
   - Select `account.updated` 
   - Stripe shows request details
   - Confirm response code is **200** (not 401/403)

4. **Monitor Webhook Logs (5 minutes)**
   - Dashboard → Developers → Webhooks → Endpoint → "Logs"
   - You should see the test event with status **green** (success)
   - If red (failed), check:
     - `wrangler tail --name sophia-ai-factory` for error messages
     - Ensure both `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` are set

5. **Wait Out Legacy Retry Window (24 hours)**
   - Stripe retries old events signed with the previous secret for ~24 hours after rotation
   - You may see warnings in logs like "[stripe-connect] webhook signature verification failed"
   - This is normal; Stripe will stop retrying once old secret expires

6. **Confirm Completion**
   - After 24+ hours, check Sentry for absence of signature verification failures
   - Old secret is no longer accepted

### Verification Query

```bash
# Check current secret expiry in Stripe Dashboard (no direct API)
# Logs → look for "whsec_" entries with timestamps
npx wrangler tail --name sophia-ai-factory | grep -i "stripe\|webhook"
```

---

## Unprocessed Event Monitoring

### Common Scenarios

**Problem:** Affiliate's Stripe Connect account status is stuck in "pending" (KYC) state despite completing the onboarding link.

**Root Cause:** Webhook for `account.updated` was not delivered (network timeout, Stripe DNS issue, or endpoint misconfiguration).

### Detection Query

```sql
-- Find events received but not processed
SELECT event_id, event_type, account_id, received_at, processed, attempts
FROM stripe_connect_events
WHERE processed = 0 AND received_at < datetime('now', '-1 hour')
ORDER BY received_at DESC;
```

### Triage Steps

1. **Check Stripe Dashboard Logs**
   - Dashboard → Developers → Webhooks → Endpoint → "Logs"
   - Filter by date range when issue occurred
   - Look for red (failed) entries — note the response code

2. **Response Code Meanings**
   - **200 OK** → Event delivered successfully; our handler should have marked `processed=1`
   - **4xx** → Our endpoint rejected the request (signature mismatch, schema error)
   - **5xx** → Our endpoint crashed or was unavailable
   - **Timeout** → Network issue; Stripe will retry

3. **Force Reprocess Event**
   ```bash
   # If Stripe shows 200 OK but DB shows processed=0, webhook handler crashed
   # Option A: Re-trigger via Stripe Dashboard
   # Dashboard → Developers → Webhooks → Endpoint → Recent Attempts → Click event → "Resend"
   
   # Option B: Manual DB correction (only if you're certain handler succeeded)
   # npx wrangler d1 execute sophia-raas-db --remote --command="
   #   UPDATE stripe_connect_events SET processed=1 WHERE event_id='<EVENT_ID>'
   # "
   ```

4. **Check Worker Logs for Errors**
   ```bash
   # Real-time logs
   npx wrangler tail --name sophia-ai-factory --format pretty
   
   # Search for webhook errors
   npx wrangler tail --name sophia-ai-factory | grep -i "webhook\|stripe" | head -50
   ```

### Known Failure Modes

| Symptom | Root Cause | Resolution |
|---|---|---|
| `[stripe-connect] webhook signature verification failed` | Wrong `STRIPE_CONNECT_WEBHOOK_SECRET` or body mutated | Rotate secret (see above), verify middleware doesn't parse body before signature check |
| `STRIPE_SECRET_KEY env var not set` | Missing Cloudflare secret | `wrangler secret put STRIPE_SECRET_KEY --name sophia-ai-factory` |
| Stripe shows 200 OK but `processed=0` in D1 | Handler crashed after signature verification | Check Sentry errors; re-send from Stripe Dashboard |
| Webhook delivery timeout in Stripe logs | Cloudflare Workers cold start exceeded 30s | Reduce handler complexity or pre-warm cache |

---

## Integration with Payout Operations Runbook

See `docs/payout-operations-runbook.md` sections:
- **"Affiliate stuck in Stripe Connect KYC"** — Triage & resolution steps when webhook drift is suspected
- **"Webhook signature failures spam in logs"** — Root cause analysis for signature verification failures
- **"Payout batch failed mid-dispatch"** — Checking Stripe Dashboard transfer status for failed batches

---

## Deployment Impact

**When deploying new webhook handler code:**

1. **Do NOT rotate `STRIPE_CONNECT_WEBHOOK_SECRET`** during or immediately after deploy
2. **Verify signature verification logic** (handler must read raw request body BEFORE JSON parsing)
3. **Test with Stripe CLI** locally before pushing:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-connect
   stripe trigger account.updated
   ```
4. **Monitor Sentry** for 30 minutes post-deploy to catch any new signature failures

---

## Unresolved

- No automated reconciliation between Stripe Dashboard transfers and `payout_batches` table
  - Drift detected only on customer complaint (see payout-operations-runbook.md section 5)
- Manual webhook re-send via Stripe Dashboard is required if event permanently lost (no CLI automation)

