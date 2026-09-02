# SOP-06: Customer Onboarding Verification

> Version: 1.0 | Baseline: `5dd1f071` | Owner: CEO | Review: Monthly

---

## When to Use

- New customer signs up
- Weekly audit of onboarding funnel
- Setup Wizard changes deployed

---

## Setup Wizard Flow (Protected - DO NOT BREAK)

```
1. Welcome → Locale selection (VN/EN)
2. API Keys → OpenRouter, ElevenLabs, D-ID, HeyGen (BYOK)
3. Payment → NOWPayments / PayOS configuration
4. Telegram → Bot token + chat ID
5. Affiliate → Network credentials (optional)
6. Complete → Dashboard access granted
```

---

## Verification Checklist

### For Each New Customer

- [ ] User created in D1 (`user` table)
- [ ] Setup Wizard completed (all steps green)
- [ ] API keys encrypted and stored (`encrypted_api_keys` table)
- [ ] Payment provider configured
- [ ] Tier assigned correctly
- [ ] Telegram bot responds to `/campaign`
- [ ] First mission can be created

### Weekly Audit

```bash
# 1. New users last 7 days
npx wrangler d1 execute sophia-raas-db --command="SELECT id, email, created_at, tier FROM user WHERE created_at > datetime('now', '-7 days')" --remote

# 2. Setup completion rate
npx wrangler d1 execute sophia-raas-db --command="SELECT COUNT(*) as total, SUM(CASE WHEN setup_completed THEN 1 ELSE 0 END) as completed FROM user WHERE created_at > datetime('now', '-7 days')" --remote

# 3. Failed onboarding (users without setup_completed)
npx wrangler d1 execute sophia-raas-db --command="SELECT id, email FROM user WHERE setup_completed = 0 AND created_at > datetime('now', '-7 days')" --remote
```

---

## Common Issues

| Issue | Cause | Resolution |
|---|---|---|
| Stuck at API keys | Provider validation failed | Check provider status, verify key format |
| Payment not activating | Webhook not received | Check NOWPayments dashboard, re-trigger IPN |
| Telegram not responding | Webhook not registered | Re-register webhook via bot settings |
| Tier not upgraded | IPN verification failed | Check `NOWPAYMENTS_IPN_SECRET` |

---

## Escalation

- Onboarding failure affecting >1 customer → SEV-2
- Payment flow broken → SEV-1 (INCIDENT_RESPONSE.md Playbook 2)

---

## References

- `INCIDENT_RESPONSE.md` — Playbook 2
- `PRODUCT_GOVERNANCE.md` — Protected flows
- `DEPLOYMENT_RUNBOOK.md` — Post-deploy verification