# Phase 09 — Operator Enablement

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (DevEx category, Infra & Cost)
- Gap: "Wrangler-from-M1" single-machine deploy bus-factor 1; no second-operator capability
- Related: Phase 2 (DR) and Phase 3 (APM) need second-operator tests to be valid for SOC 2

## Overview

- **Priority:** P1 (enables Milestone B & C track record)
- **Status:** pending
- **Description:** Establish second-operator capability with documented runbooks, test environments, and knowledge transfer. Enable any qualified operator to deploy, restore, and respond to incidents without original developer dependence.

## Key Insights

- Current state: Deploys happen from a single M1 MacBook (`wrangler CLI` local)
- No documented "deploy from clean machine" procedure (bus-factor 1)
- DR drill and APM response runbooks exist but untested by anyone other than original author
- SOC 2 requires separation-of-duties and cross-training; this phase delivers that

## Requirements

### Functional
1. **Clean machine deploy runbook** — Step-by-step instructions to set up fresh environment and deploy within 60 minutes
2. **Backup builder environment** — Scripted restore from R2 to fresh D1; tested end-to-end
3. **Operator onboarding guide** — New operator can be productive in < 1 day (access provisioning, tooling setup, runbooks)
4. **Second-operator test certification** — Formal test where two operators independently execute critical procedures
5. **Access review automation** — Quarterly access review (from Phase 1) includes operator privileges

### Non-functional
- Deploy-from-clean-machine RTO < 60 minutes (from bare OS to production live)
- All runbooks must be executable without "tribal knowledge" (assume reader is competent but new to Sophia)
- Operator onboarding checklist covers all access provisioning (CF account, GitHub, Sentry, Honeycomb, AWS if used)

## Architecture

### Deploy-from-Clean-Machine Runbook (`docs/runbooks/DEPLOY-FROM-CLEAN.md`)

```
Prerequisites:
- macOS or Linux machine with Node.js 20+ installed
- GitHub account with repo access
- Cloudflare account with API token
- NOWPayments API key (for testing payment flow)

Steps:

1. Clone repository
   git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
   cd sophia-ai-factory
   git checkout main && git pull origin main

2. Install dependencies
   corepack enable
   pnpm install --frozen-lockfile

3. Configure environment
   cp .env.example .env.local
   # Fill in secrets from 1Password vault (see OPERATOR-ACCESS.md)

4. Verify wrangler config
   npx wrangler whoami --show-balance  # ensure CF account active

5. Run tests
   npm test  # must pass before deploy

6. Build
   npm run build  # verify 0 TypeScript errors

7. Deploy
   npm run deploy:full

8. Verify
   curl https://sophia.agencyos.network/api/health
   # Should return 200
   curl https://sophia.agencyos.network/api/version | jq .shortSha
   # Should match: git rev-parse HEAD | cut -c1-8

Total expected time: 45-60 minutes (includes test suite ~15-20min)
```

### Backup Builder Environment

Extend Phase 2's DR drill script to be operator-portable:

```bash
#!/usr/bin/env bash
# scripts/dr/restore-from-backup.sh
set -euo pipefail

echo "🔧 Restore from R2 backup — Sophia DR Procedure"
echo "Ensure you have: wrangler CLI logged in, R2 bucket read access, fresh D1 database"

# Read backup file from user input or auto-select latest
LATEST_BACKUP="${1:-auto}"

if [ "$LATEST_BACKUP" = "auto" ]; then
  LATEST_BACKUP=$(npx wrangler r2 list-objects sophia-ai-factory-opennext-cache --prefix backups/d1/ \
    | jq -r '.objects[-1].key')
fi

echo "📦 Downloading backup: $LATEST_BACKUP"
npx wrangler r2 download-file sophia-ai-factory-opennext-cache "$LATEST_BACKUP" /tmp/restore.sql

# Create restore DB with timestamp
RESTORE_DB="sophia-raas-db-restore-$(date +%Y%m%d-%H%M%S)"
echo "🗄️  Creating restore database: $RESTORE_DB"
npx wrangler d1 create "$RESTORE_DB"

# Restore
echo "⚡ Restoring..."
npx wrangler d1 execute "$RESTORE_DB" --file=/tmp/restore.sql

# Validate
echo "✅ Restore complete. Run validation:"
npx wrangler d1 execute "$RESTORE_DB" --command "SELECT COUNT(*) FROM campaigns;"

echo "🎯 To promote to primary: rename databases (planned downtime)"
```

Document in `docs/runbooks/D1-RESTORE.md` and cross-link.

### Operator Onboarding Guide (`docs/runbooks/OPERATOR-ONBOARDING.md`)

Checklist sections:
1. **Access provisioning** — Cloudflare account invite, GitHub org access, Sentry org, Honeycomb, AWS (if used), 1Password vault
2. **Tooling setup** — Node.js, pnpm, wrangler CLI, gh CLI, jq
3. **Credentials configuration** — `.env.local` population from vault
4. **Runbooks familiarization** — Read and sign-off on: DEPLOY-FROM-CLEAN, D1-RESTORE, FAILOVER, INCIDENT_RESPONSE, COMPLIANCE-REVIEW
5. **Shadow deployment** — Observe live deploy from senior operator
6. **First solo deploy** — Deploy to staging, then production under observation
7. **Certification** — Pass written test covering runbook steps; receive `operator` role in auth system

### Second-Operator Test Certification

Formal test where two operators independently execute:
- Deploy from clean machine (both operators, separate VMs)
- DR restore procedure (both operators)
- APM alert response drill (both operators)

Pass criteria: Each completes within SLA target (deploy < 60min, restore < 4h, alert acknowledgment < 15min). Sign-off recorded in `docs/operator-certification/` directory.

### Access Review Automation

Extend Phase 1's quarterly access review to include operator privileges:

```sql
-- scripts/security/quarterly-access-review.js
SELECT u.id, u.email, u.role, u.last_login,
  CASE WHEN u.role IN ('admin', 'operator') THEN 'PRIVILEGED' ELSE 'STANDARD' END as privilege_level
FROM users u
WHERE u.role IN ('admin', 'operator', 'compliance')
  AND u.last_login < (strftime('%s', 'now', '-90 days'))  -- stale accounts
ORDER BY u.role DESC, u.last_login ASC;
```

Output goes to PR for approval; stale accounts auto-disabled after 14-day grace.

## Related Code Files

**Files to create:**
- `docs/runbooks/DEPLOY-FROM-CLEAN.md`
- `docs/runbooks/OPERATOR-ONBOARDING.md`
- `scripts/dr/restore-from-backup.sh` (portable version)
- `scripts/security/operator-certification-test.js` — automated test runner
- `docs/operator-certification/` — directory for signed-off test results
- `docs/access-reviews/Q2-2026/` — quarterly review PRs
- `docs/policy/ACCESS-CONTROL.md` — access policy for auditors

**Files to modify:**
- `docs/runbooks/D1-RESTORE.md` — make portable (no local path dependencies)
- `src/seed/auth/better-auth-server.ts` — add `operator` role and assignment
- `scripts/security/quarterly-access-review.js` — include operator role filtering
- `.env.example` — document all operator-required secrets

## Implementation Steps

1. **Write DEPLOY-FROM-CLEAN.md** — document actual steps; time it (target 60min)
2. **Create portable restore script** — `restore-from-backup.sh` with no hardcoded paths
3. **Test both procedures on fresh VM** — use DigitalOcean/Linode; document any missing prereqs
4. **Create OPERATOR-ONBOARDING.md** — compile access checklist; tooling install steps
5. **Define operator role** — add to `user_roles` table; document assignment process
6. **Build certification test** — automated script that checks operator can run key commands
7. **First second-operator test** — Have colleague execute from scratch; document gaps
8. **Iterate on runbooks** — fix any tribal knowledge gaps
9. **Quarterly access review integration** — ensure operator accounts included
10. **SOC 2 evidence** — capture signed certification test results; access review PRs

## Todo List

- [ ] Time actual clean-machine deploy (baseline)
- [ ] Write `DEPLOY-FROM-CLEAN.md` with all steps and time estimates
- [ ] Create `restore-from-backup.sh` portable script; test on fresh VM
- [ ] Write `OPERATOR-ONBOARDING.md` with access checklist
- [ ] Define `operator` role in auth system; document assignment
- [ ] Build `operator-certification-test.js` (checks each runbook step)
- [ ] Recruit second operator for dry-run test
- [ ] Document gaps found; update runbooks
- [ ] Add operator accounts to quarterly access review
- [ ] Archive first certification test result in `docs/operator-certification/`
- [ ] SOC 2 evidence package: runbooks + test logs + access reviews

## Success Criteria

- ✅ `DEPLOY-FROM-CLEAN.md` exists; can be followed by competent engineer to deploy in < 60min
- ✅ `restore-from-backup.sh` executes on fresh VM; restores backup in < 4h
- ✅ `OPERATOR-ONBOARDING.md` covers all access + tooling + runbooks
- ✅ At least 2 operators have independently passed certification test
- ✅ Quarterly access review includes operator privilege audit
- ✅ SOC 2 evidence includes: runbooks, certification test logs, access review PR

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Clean-machine deploy takes >60min | Med | Med | Optimize (cache node_modules, use prebuilt artifacts) |
| Second operator unavailable for testing | High | Med | Schedule well in advance; document as Milestone B blocker if no cert |
| Runbooks become stale | High | Med | Assign owner to review quarterly; link from runbook index |
| Operator privileges not removed on exit | Low | High | Access review automation catches stale accounts |

## Security Considerations

- Operator role must have MFA enforced (policy)
- All operator actions logged to `audit_log` (Phase 1)
- Onboarding/offboarding checklist includes credential revocation
- Runbooks stored in `docs/runbooks/` with "Sensitive — Internal Use Only" notice

## Next Steps

1. **Week 1:** Time clean-machine deploy; write runbook
2. **Week 2:** Portable restore script; test on VM
3. **Week 3:** Onboarding guide; define operator role
4. **Week 4:** Second-operator certification test; iterate
5. **Week 5:** SOC 2 evidence collection
