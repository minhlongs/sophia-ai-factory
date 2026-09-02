# SOP-02: Emergency Rollback

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Monthly

---

## When to Use

- Production health check fails after deploy
- SEV-1 incident caused by recent deploy
- Critical bug in production

---

## Prerequisites

- [ ] Wrangler CLI authenticated
- [ ] Access to Cloudflare dashboard

---

## Procedure

### Option A: Wrangler Rollback (Fastest)

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Emergency rollback: <reason>" --yes
```

### Option B: Redeploy Specific Commit

```bash
# 1. Identify last good commit
git log --oneline -10

# 2. Checkout and deploy
git checkout <good-sha>
cd apps/sophia-ai-factory
npm run deploy:full

# 3. Return to main
git checkout main
```

---

## Verification After Rollback

```bash
# 1. Check version
curl -s https://sophia.agencyos.network/api/version | jq .

# 2. Health check
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health  # must be 200
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/login        # must be 200
```

---

## Success Criteria

- [ ] Rollback command succeeds
- [ ] `shortSha` shows rolled-back commit
- [ ] Health checks pass (200)
- [ ] Protected flows work (Setup Wizard, Telegram, Payment)

---

## Post-Rollback

- [ ] Create incident ticket
- [ ] Schedule postmortem within 24h
- [ ] Fix root cause before re-deploying
- [ ] Update `docs/operations/deploy-log.md`

---

## References

- `DEPLOYMENT_RUNBOOK.md` — Full runbook
- `INCIDENT_RESPONSE.md` — Playbook 1