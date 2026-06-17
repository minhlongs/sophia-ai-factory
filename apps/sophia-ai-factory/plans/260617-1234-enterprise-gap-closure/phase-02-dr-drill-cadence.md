# Phase 02 — DR Drill Cadence & Off-site Backup

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Reliability category, Backup sub-area)
- Related: Phase 1 (SOC 2) needs DR procedures for Business Continuity controls
- Prior work: `GAP-R1` (d1-backup cron wiring) shipped in Wave A; this phase establishes track record

## Overview

- **Priority:** P0 (can run parallel to Phase 1; gating for Milestone B)
- **Status:** pending
- **Description:** Establish monthly disaster recovery (DR) drill cadence with documented restore procedures from R2 backups. Add off-site backup mirror (R2 → S3/B2 cross-region). Prove RTO/RPO targets with production-like testing.

## Key Insights

- Current state: `/api/cron/d1-backup` route exists and is wired to `inject-scheduled-handler.mjs`, but `cron_run_log` count = 0 in prod (prior to Wave A). Post-Wave A, need to establish track record.
- R2 lifecycle (30-day retention) is the de-facto backup store, but it's single-region and no verified restore procedure existed
- Honest score was 4/10 on Backup because "backup never executed in prod" — now we need execution + verified restore
- SOC 2 Type II requires documented DR tests; this phase feeds both Milestone B readiness and Phase 10 track record

## Requirements

### Functional
1. **Restore procedure documented** — Step-by-step runbook to restore D1 database from R2 backup to fresh D1 instance
2. **Monthly DR drill execution** — Automated schedule (first Monday of month); run restore on staging-like environment; document RTO/RPO
3. **Off-site backup copy** — Mirror R2 backups to different cloud provider (AWS S3 or Backblaze B2) daily
4. **Restore verification** — Automated checksum validation that restored DB matches backup source
5. **Drill log publication** — `docs/dr-drill-log.md` with results of last 3 drills (RTO, RPO, issues found)

### Non-functional
- Restore procedure must be executable by second operator (not original author)
- Full restore RTO < 4 hours (SLA target); RPO < 24h (backup frequency)
- Off-site copy must be in different geographic region than Cloudflare's primary region
- All drills must run on infrastructure-as-code (Terraform/Pulumi) to ensure reproducibility

## Architecture

### Restore Procedure (`docs/runbooks/D1-RESTORE.md`)

```bash
# 1. Identify latest backup file
LATEST=$(npx wrangler r2 list-objects sophia-ai-factory-opennext-cache --prefix backups/d1/ | sort | tail -1)

# 2. Download from R2
npx wrangler r2 download-file sophia-ai-factory-opennext-cache "$LATEST" /tmp/backup.sql

# 3. Verify checksum
echo "$LATEST.sha256" | sha256sum -c -

# 4. Create fresh D1 database (different name)
npx wrangler d1 create sophia-raas-db-restore-$(date +%Y%m)

# 5. Restore
npx wrangler d1 execute sophia-raas-db-restore-$(date +%Y%m) --file=/tmp/backup.sql

# 6. Validate row counts match expected
npx wrangler d1 execute sophia-raas-db-restore-$(date +%Y%m) --command "SELECT COUNT(*) FROM campaigns;" | jq .result
# Compare against source DB
```

**Rollback:** If restore fails, delete restore DB; retry with previous backup.

### Off-site Backup Mirror

**Option A: R2 → S3 Mirror (AWS)**
- Use `r2 sync` with Cloudflare R2 as source, AWS S3 as destination
- Daily cron on separate runner (not CF Workers) — could be GitHub Actions self-hosted runner on EC2 or local runner
- Encrypted in transit (HTTPS) and at rest (S3 SSE-S3 or SSE-KMS)
- Cost: ~$0.023/GB-month + egress from R2 (~$0.01/GB)

**Option B: R2 → Backblaze B2**
- Lower cost (~$0.006/GB-month)
- Similar mechanism via `r2 sync` or custom script

**Implementation:**
```bash
#!/usr/bin/env bash
# scripts/backup/mirror-to-s3.sh
set -euo pipefail

BACKUP_PREFIX="backups/d1/$(date -u +%Y-%m-%d)"
R2_BUCKET="sophia-ai-factory-opennext-cache"
S3_BUCKET="sophia-ai-factory-offsite-backup"

# List today's backups
BACKUPS=$(npx wrangler r2 list-objects "$R2_BUCKET" --prefix "$BACKUP_PREFIX" | jq -r '.objects[].key')

for backup in $BACKUPS; do
  # Stream from R2 to S3 (no local disk)
  npx wrangler r2 download-file "$R2_BUCKET" "$backup" - | \
    aws s3 cp - "s3://$S3_BUCKET/$backup" \
      --storage-class STANDARD_IA
done

# Upload manifest with checksums
echo "Backup mirror completed at $(date -u)" > /tmp/manifest.txt
aws s3 cp /tmp/manifest.txt "s3://$S3_BUCKET/manifests/$(date -u +%Y-%m-%d).txt"
```

Schedule: Daily at 02:00 UTC via external cron (QStash, GitHub Actions self-hosted, or operator's server)

### Monthly DR Drill Automation

Create `scripts/dr/run-drill.js` that:
1. Spins up fresh D1 database (`sophia-raas-db-drill-<date>`)
2. Downloads latest backup from R2
3. Restores and validates
4. Runs read-only sanity checks (row counts, foreign key integrity)
5. Generates report in `docs/dr-drill-log.md` format
6. Tears down restore DB (unless `--keep` flag for debugging)

```javascript
// scripts/dr/run-drill.js
import { execSync } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';

const date = new Date().toISOString().split('T')[0];
const restoreDb = `sophia-raas-drill-${date}`;

// ... steps ...

const report = `
## DR Drill — ${date}

- **RTO (restore complete):** ${rto} minutes
- **RPO (data freshness):** backup age ${backupAge} hours
- **Validation:** ${passed ? '✅ PASS' : '❌ FAIL'}
- **Issues:** ${issues.join(', ') || 'None'}
`;

appendFileSync('docs/dr-drill-log.md', report);
```

Schedule: GitHub Actions workflow running monthly (or QStash cron if token available)

## Related Code Files

**Files to create:**
- `docs/runbooks/D1-RESTORE.md`
- `scripts/backup/mirror-to-s3.sh` (or `mirror-to-b2.sh`)
- `scripts/dr/run-drill.js`
- `docs/dr-drill-log.md` (auto-updated)
- `scripts/security/restore-verifier.js` (checksum + row count validation)

**Files to modify:**
- `wrangler.toml` — add off-site backup bucket env if needed
- `.env.example` — add AWS credentials or B2 keys for mirror
- `package.json` — add `dr:drill` script
- GitHub Actions workflow (if using) or operator's cron config

## Implementation Steps

1. **Document current restore procedure** — Write `D1-RESTORE.md` based on current working process
2. **Test restore on staging** — Verify procedure works end-to-end on non-prod D1
3. **Implement restore verification** — `restore-verifier.js` with row count + checksum checks
4. **Build DR drill script** — `run-drill.js` automating the procedure
5. **Run first manual drill** — Execute and document RTO/RPO; iterate on procedure
6. **Select off-site destination** — AWS S3 vs Backblaze B2 decision (cost/region)
7. **Configure off-site mirror credentials** — Add to `.env` and secret management
8. **Implement mirror script** — `mirror-to-s3.sh` with proper error handling
9. **Schedule daily mirror** — QStash cron OR GitHub Actions self-hosted runner OR operator-managed cron
10. **Schedule monthly drill** — GitHub Actions monthly workflow OR manual reminder
11. **Publish drill log** — Create `docs/dr-drill-log.md` and populate with first 3 drills
12. **Integrate with SOC 2 evidence** — Link drill reports in `docs/compliance/` for auditor

## Todo List

- [ ] Write initial D1-RESTORE.md runbook (first draft based on staging test)
- [ ] Test restore on staging D1; measure RTO
- [ ] Implement restore verification script with checksums
- [ ] Create `run-drill.js` automation
- [ ] Execute first manual DR drill; document results
- [ ] Decide off-site destination (S3 vs B2)
- [ ] Configure credentials and test mirror script
- [ ] Schedule daily mirror (cron or Actions)
- [ ] Schedule monthly drill (cron or Actions)
- [ ] Run 3 consecutive monthly drills; ensure consistency
- [ ] Compile drill log `docs/dr-drill-log.md`
- [ ] Update SOC 2 evidence package with DR procedures and drill results

## Success Criteria

- ✅ `docs/runbooks/D1-RESTORE.md` exists and has been tested by second operator
- ✅ `docs/dr-drill-log.md` contains ≥3 monthly drill entries with RTO < 4h each
- ✅ Daily off-site mirror running; at least 7 days of mirrored backups verified
- ✅ Restore verification script passes on 100% of drills
- ✅ SOC 2 Type I evidence includes DR runbook and drill logs

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R2 backup corruption undetected | Low | High | Add SHA256 checksum on upload; verify before restore |
| Off-site mirror egress costs exceed budget | Med | Low | Set budget alerts; compress before transfer |
| Monthly drill forgotten | High | Med | Automate with calendar invites + GitHub Actions reminder |
| Restore takes >4h RTO | Med | High | Optimize (parallelize, faster runner); document realistic SLA |
| Operator unavailable for manual drill | Med | Med | Train second operator; automate as much as possible |

## Security Considerations

- Off-site backup encryption: Use S3 SSE-S3 or B2 native encryption (not client-side for recovery simplicity)
- Access controls: Only operators and auditors can read off-site bucket; use IAM roles with MFA
- Backup retention: Keep 90 days in R2 (30d lifecycle) + 365 days in off-site mirror
- Audit trail: Log all restore operations to `audit_log` table (Phase 1)

## Next Steps

1. Start with manual restore procedure documentation (Step 1) — this is prerequisite for everything else
2. Run first staging restore test within 1 week to establish baseline RTO
3. Parallelize: while restore script matures, decide off-site destination and start mirror PoC
