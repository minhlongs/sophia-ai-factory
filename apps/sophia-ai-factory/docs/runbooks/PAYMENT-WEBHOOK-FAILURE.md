# Runbook: Payment Webhook Failure

**Severity:** P1
**Owner:** Billing / Platform team

---

## Symptoms

- NOWPayments IPN webhook endpoint (`/api/webhook/nowpayments`) returning 5xx
- Customer payments not activating tier upgrades
- `webhook.log` shows repeated failures or timeouts
- Customers report "payment completed but no tier change"
- Monitoring alert: "Payment webhook error rate > 10%"

---

## Diagnosis

### 1. Check recent webhook attempts

```bash
# Query D1 for recent webhook logs (last 1 hour)
npx wrangler d1 execute sophia-raas-db --remote --command "
  SELECT id, created_at, status, payload, error
  FROM nowpayments_webhook_logs
  WHERE created_at > datetime('now', '-1 hour')
  ORDER BY created_at DESC
  LIMIT 20;
"
```

Look for:
- `status != 'processed'`
- `error` column containing exception messages
- Repeated identical payloads (idempotency key duplicates)

### 2. Check NOWPayments dashboard

Log into NOWPayments merchant dashboard:
- Verify IPN URL is correctly set to `https://sophia.agencyos.network/api/webhook/nowpayments`
- Check "IPN History" for recent callbacks and their response codes
- Re-send failed IPNs manually to test

### 3. Check Worker logs

```bash
npx wrangler tail --name sophia-ai-factory --since 10m | grep -i "webhook\|nowpayments"
```

Look for:
- `Error: Invalid signature` — API key mismatch
- `Error: Payment not found` — payment ID not in DB yet (race condition)
- Timeouts — downstream DB latency

### 4. Verify signature verification

The webhook verifies HMAC signature using `NOWPAYMENTS_API_KEY`. If this secret is missing or incorrect:

```bash
# Check secret exists (will not echo value)
npx wrangler secret list --name sophia-ai-factory | grep NOWPAYMENTS_API_KEY
```

If missing or rotated, set it:

```bash
npx wrangler secret put NOWPAYMENTS_API_KEY --value "<correct-key>"
```

### 5. Check database connectivity

```bash
# Test D1 connection via simple query
npx wrangler d1 execute sophia-raas-db --remote --command "SELECT 1;"
```

If connection fails, check D1 binding in `wrangler.toml` and Cloudflare account status.

### 6. Check idempotency behavior

Webhook may be retrying same payment. Verify `payment_id` uniqueness constraint in `subscription_payments` table. Duplicate processing should be safely idempotent.

---

## Remediation

### Immediate: Re-play failed webhooks

From NOWPayments dashboard, select failed IPNs and click "Resend". Monitor logs for success.

### If signature verification failing

1. Obtain correct `NOWPAYMENTS_API_KEY` from production env (stored in password manager)
2. Update Cloudflare secret:

```bash
npx wrangler secret put NOWPAYMENTS_API_KEY --value "$(op item get 'NOWPayments API Key' --otp)"
```

3. Re-play failed IPNs

### If database errors (quota exceeded, deadlock)

1. Check D1 quota and size:

```bash
npx wrangler d1 info sophia-raas-db
```

2. If near 10GB limit, archive old logs:

```bash
# Export logs older than 90 days to R2
node scripts/archive-webhook-logs.mjs
```

3. If deadlock errors, increase D1 connection pool or reduce batch size in `land/billing/nowpayments-ipn-handler.ts`.

### If timeout errors

The webhook handler may be doing too much work synchronously. Consider:

- Offload tier activation to Inngest job (already done — check `forest/inngest/functions/process-payment-confirmation.ts`)
- Ensure webhook returns 200 immediately after queuing job

Current implementation should already do this. If not, fix:

```typescript
// In /api/webhook/nowpayments/route.ts
// Should: verify signature → enqueue Inngest → return 200
```

---

## Rollback

If the webhook code was recently deployed and is broken:

```bash
npx wrangler rollback --name sophia-ai-factory --yes
```

Then re-play failed IPNs from NOWPayments dashboard.

---

## Escalation

Escalate to CTO if:

- NOWPayments API key is compromised (must rotate)
- Database corruption or data loss detected
- Repeated signature verification failures despite correct secret
- Payment data inconsistent (customer paid but no record in our DB)

---

## Prevention

- Webhook is idempotent (safe to retry)
- Signature verification uses constant-time compare
- Processing offloaded to Inngest for async execution
- Alert on webhook failure rate > 5% for 5 minutes
- Daily backup of `subscription_payments` and `nowpayments_webhook_logs`

---

## Post-Incident

1. Analyze root cause (signature mismatch, DB deadlock, timeout)
2. Update webhook handler to be more resilient
3. Consider increasing D1 resources if quota-related
4. Document any NOWPayments API changes
5. Add additional monitoring if coverage gaps found
