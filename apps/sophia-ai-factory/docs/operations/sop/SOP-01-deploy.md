# SOP-01: Production Deploy

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Monthly

---

## When to Use

- Any code change going to production
- Hotfixes
- Emergency rollbacks (see SOP-02)

---

## Prerequisites

- [ ] Working tree is clean (`git status` = clean)
- [ ] All tests pass (`npm test`)
- [ ] Type-check passes (`npm run typecheck`)
- [ ] Build passes (`npm run build`)
- [ ] New D1 migrations applied (if any)

---

## Procedure

```bash
# 1. Push to main (deploy script rejects unpushed commits)
git push origin main

# 2. Build + deploy from app package
cd apps/sophia-ai-factory
npm run deploy:full

# 3. Verify SHA match (CRITICAL)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"

# 4. Health checks
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health  # must be 200
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/login        # must be 200
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/vi/login     # must be 200
```

---

## Success Criteria

- [ ] `npm run deploy:full` exits 0
- [ ] `shortSha` matches local commit
- [ ] `/api/health` returns 200
- [ ] `/login` returns 200
- [ ] `/vi/login` returns 200

---

## If Deploy Fails

1. **Build fails** — Fix errors locally, do not deploy broken code
2. **Deploy fails** — Check wrangler auth, Cloudflare account limits
3. **SHA mismatch** — Verify `git status` clean, re-run `npm run deploy:full`
4. **Health check fails** — Rollback immediately (SOP-02)

---

## Post-Deploy

- [ ] Update `docs/project-changelog.md`
- [ ] Record deploy in `docs/operations/deploy-log.md`
- [ ] Notify team if customer-facing change

---

## References

- `DEPLOYMENT_RUNBOOK.md` — Full runbook
- `.claude/rules/sophia-deploy-verify.md` — Authoritative verification spec