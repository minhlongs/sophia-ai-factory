# SOP-08: Payment Failure Investigation

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Monthly

---

## When to Use

- Customer reports payment not processing
- Tier not activating after payment
- NOWPayments IPN webhook not received
- Payment dashboard shows failures

---

## Diagnosis

### 1. Check NOWPayments Dashboard

- [ ] Payment received in NOWPayments dashboard?
- [ ] IPN webhook triggered?
- [ ] Webhook status code? (expect 200)

### 2. Check Webhook Logs

```bash
# Query D1 for payment records
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM purchases WHERE created_at > datetime('now', '-24 hours') ORDER BY created_at DESC LIMIT 20" --remote

# Check IPN processing
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM cron_run_log WHERE job_name LIKE '%payment%' ORDER BY created_at DESC LIMIT 10" --remote
```

### 3. Test Webhook Manually

```bash
# Trigger IPN test from NOWPayments dashboard
# Or check route directly
curl -s https://sophia.agencyos.network/api/payments/nowpayments/ipn -X POST \
  -H "Content-Type: application/json" \
  -d '{"order_id":"test","payment_id":"test","payment_status":"completed"}'
```

---

## Common Failure Causes

| Cause | Symptom | Resolution |
|---|---|---|
| IPN hash mismatch | Webhook returns 401 | Verify `NOWPAYMENTS_IPN_SECRET` |
| Duplicate IPN | "already processed" | Idempotent — expected behavior |
| Network timeout | Webhook timeout | Check Cloudflare Workers limits |
| D1 write failure | SQL error in Sentry | Check D1 status |
| Provider outage | NOWPayments unreachable | Wait for recovery |

---

## Manual Tier Activation (if webhook fails)

```bash
# Verify customer payment in NOWPayments dashboard
# Then manually activate tier in D1
npx wrangler d1 execute sophia-raas-db --command="UPDATE user SET tier='PREMIUM', subscription_active=1 WHERE id='customer_id'" --remote
```

---

## Escalation

- Payment flow completely broken → SEV-1 (INCIDENT_RESPONSE.md Playbook 2)
- Single customer issue → SEV-3
- >5 customers affected → SEV-2

---

## References

- `INCIDENT_RESPONSE.md` — Playbook 2
- `FINANCIAL_OPERATING_MODEL.md` — Payment flow details