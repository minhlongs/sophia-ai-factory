# SOP-03: Production Health Check

> Version: 1.0 | Baseline: `5dd1f071` | Owner: CEO | Review: Weekly

---

## When to Use

- Daily morning check
- After any deploy
- When alert fires
- Customer reports issues

---

## Quick Health Check (30 seconds)

```bash
# 1. Version + SHA match
curl -s https://sophia.agencyos.network/api/version | jq .

# 2. Core endpoints
curl -s -o /dev/null -w "health: %{http_code}\n" https://sophia.agencyos.network/api/health
curl -s -o /dev/null -w "login: %{http_code}\n" https://sophia.agencyos.network/login
curl -s -o /dev/null -w "vi/login: %{http_code}\n" https://sophia.agencyos.network/vi/login

# 3. Telegram bot
# Send /campaign to @Sophia_Bbot — must respond
```

---

## Deep Health Check (5 minutes)

```bash
# 1. Metrics (requires METRICS_BEARER_TOKEN)
curl -s -H "Authorization: Bearer $METRICS_BEARER_TOKEN" \
  https://sophia.agencyos.network/api/metrics | jq .

# 2. Real-time ops view (admin only)
curl -s -N https://sophia.agencyos.network/api/analytics/realtime | head -20

# 3. D1 query
npx wrangler d1 execute sophia-raas-db --command="SELECT COUNT(*) FROM user" --remote

# 4. Cron health
npx wrangler d1 execute sophia-raas-db --command="SELECT job_name, status, created_at FROM cron_run_log ORDER BY created_at DESC LIMIT 10" --remote
```

---

## Expected Results

| Check | Expected | Alert If |
|---|---|---|
| `/api/version` | 200 + SHA match | SHA mismatch or non-200 |
| `/api/health` | 200 | Non-200 |
| `/login` | 200 (after 307) | Non-200 |
| `/vi/login` | 200 | Non-200 |
| Telegram bot | Responds to `/campaign` | No response |
| Metrics p95 | < 5s | > 5s |
| Cron jobs | All SUCCESS in last 24h | Any FAILED |

---

## If Any Check Fails

1. Run `SOP-02: Emergency Rollback` if recent deploy
2. Check `SOP-07: Cron Failure` for background jobs
3. Escalate per `INCIDENT_RESPONSE.md`

---

## References

- `CEO_SCORECARD.md` — Full metrics catalog
- `DEPLOYMENT_RUNBOOK.md` — Health verification