# Runbook: Deployment Failure

**Severity:** P0 (if production down) / P1 (if degraded)
**Owner:** DevOps / Platform team

---

## Symptoms

- Deploy script exits with non-zero code
- `/api/version` returns old SHA after deploy
- Production HTTP returns 5xx errors
- Cloudflare Worker logs show runtime errors
- Health check endpoint failing

---

## Diagnosis

### 1. Check deploy script exit code and logs

```bash
cd apps/sophia-ai-factory
tail -100 scripts/deploy-with-sha.sh.log  # if logging enabled
# Or review terminal output if running interactively
```

Common exit codes:
- `1` — Pre-deploy gate failed
- `2` — Git precondition failed or version mismatch
- `4` — Post-deploy smoke failed (E2E)

### 2. Verify git state

```bash
git status
git log --oneline -5
git rev-parse HEAD   # local SHA
```

Check if HEAD is ahead of origin/main:

```bash
git log origin/main..HEAD --oneline
```

If unpushed commits exist, deploy will be rejected (unless `ALLOW_UNPUSHED_DEPLOY=1`).

### 3. Check pre-deploy gate failures

If gate failed, the script output will list failed checks:

- **Git clean** — uncommitted changes or untracked files
- **Tests** — `npm test` failed
- **Build** — `npm run build` errors
- **TypeScript** — type errors
- **Secrets** — missing required env vars
- **Migrations** — unreviewed SQL migrations

### 4. Check current deployment status

```bash
# Get live SHA
curl -s https://sophia.agencyos.network/api/version | jq '.shortSha'

# Compare with local
git rev-parse HEAD | cut -c1-8
```

If mismatch, either:
- Deploy hasn't propagated yet (wait up to 2 minutes)
- Previous deploy failed mid-way
- Wrangler encountered an error

### 5. Check Cloudflare Worker logs

```bash
npx wrangler tail --name sophia-ai-factory
```

Look for:
- Uncaught exceptions
- Missing environment variables
- Database connection errors
- D1 binding issues

### 6. Check build artifacts

```bash
ls -la .open-next/
# Should contain worker.js, worker.js.map
```

If missing, build step failed or was skipped.

---

## Remediation

### Case A: Pre-deploy gate failure

Fix the failing checks:

```bash
# Resolve uncommitted changes
git add .
git commit -m "Fix: <description>"
git push origin main

# Fix failing tests
npm test
# Address failures, commit and push

# Fix type errors
npm run type-check
# Fix reported issues

# Add missing secrets to .env.local or wrangler secret put
```

Then re-run deploy: `npm run deploy:full`

### Case B: Deploy script error during build

Build failures typically due to:
- Out of memory (OOM) — increase `NODE_OPTIONS=--max-old-space-size=8192`
- TypeScript errors — run `npm run type-check` locally
- Missing dependencies — `npm install`

Fix and retry.

### Case C: Deploy completes but SHA mismatch persists

1. Wait up to 5 minutes for Cloudflare propagation
2. Check wrangler deploy output for errors
3. Manually verify worker version:

```bash
npx wrangler deployments list --name sophia-ai-factory
# Latest deployment should show the expected version
```

If deployment shows but `/api/version` is stale, secret injection may have failed. Re-run:

```bash
npx wrangler secret put COMMIT_SHA --value "$(git rev-parse HEAD)"
npx wrangler secret put DEPLOYED_AT --value "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

### Case D: Production HTTP 5xx after successful deploy

1. Check logs for error stack traces:

```bash
npx wrangler tail --name sophia-ai-factory --since 5m
```

2. Identify failing route (e.g., `/api/...` or page)
3. Rollback immediately if core functionality down:

```bash
npx wrangler rollback --name sophia-ai-factory --yes
```

4. Investigate root cause in code, fix, and redeploy

### Case E: Health check endpoint failing

`/api/health` requires authentication (Bearer token from `API_TOKEN` or session cookie). Verify:

```bash
curl -H "Authorization: Bearer $API_TOKEN" https://sophia.agencyos.network/api/health
```

If DB connection error, check D1 binding and quota.

---

## Rollback Procedure

```bash
# List recent deployments
npx wrangler deployments list --name sophia-ai-factory

# Rollback to previous version (prompts for confirmation)
npx wrangler rollback --name sophia-ai-factory

# Or specify a specific deployment ID
npx wrangler rollback --name sophia-ai-factory --deployment-id <id>
```

After rollback:
1. Verify `/api/version` returns previous SHA
2. Verify HTTP 200 on production URL
3. Notify stakeholders
4. Investigate root cause before retrying deploy

---

## Escalation

Escalate to CTO if:

- Rollback fails or causes additional issues
- Database migration applied incorrectly (requires manual data fix)
- Quota exceeded and cannot be quickly resolved
- Repeated deploy failures (>3 attempts with same error)

---

## Post-Incident

For P0/P1 incidents:

1. Write incident report in `docs/incidents/` within 48 hours
2. Update this runbook with new findings if applicable
3. Schedule blameless retrospective with involved parties
4. Track action items to prevent recurrence

---

## Related

- `docs/deployment-guide.md` — standard deployment procedure
- `docs/incident-runbook.md` — incident response overview
- `scripts/deploy-with-sha.sh` — deploy script source
- `docs/runbooks/DB-MIGRATION-ROLLBACK.md` — DB-specific rollback
