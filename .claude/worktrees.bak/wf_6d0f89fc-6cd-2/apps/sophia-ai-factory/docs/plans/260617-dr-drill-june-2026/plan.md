# DR Drill Plan — June 2026 (Quarterly)

## Context Links
- Previous DR Drill: [`docs/dr-drill-260518.md`](../dr-drill-260518.md)
- Disaster Recovery Runbook: [`docs/disaster-recovery.md`](../../disaster-recovery.md)
- DR Scripts: [`scripts/dr/`](../../scripts/dr/)
- Backup Strategy: [`infrastructure/r2-lifecycle-30d.json`](../../infrastructure/r2-lifecycle-30d.json)

## Overview
- **Priority:** P0 (compliance-grade requirement; operational track record)
- **Status:** In Progress — June 17, 2026
- **Duration:** 1 day (D8)
- **Brief:** Quarterly DR drill to maintain Layer 10 Backup operational track record. Follow-up to successful 2026-05-18 drill (RTO = 13s, RPO = 0s).

## Requirements

**Functional:**
- Verify backup infrastructure (R2 bucket existence, D1 access)
- Create fresh PROD D1 snapshot
- Document R2 bucket contents and snapshot retention
- Validate staging D1 schema matches PROD migrations
- Update DR runbook with current findings
- Schedule next quarterly drill (September 2026)

**Non-functional:**
- All commands captured and documented
- Procedure reproducible by another operator
- Metrics measured and recorded

## Architecture

```
PROD D1 (sophia-raas-db) ──┐
                            ├── D1 Export → R2 (sophia-backups, 30d lifecycle)
STAGING D1 (sophia-raas-db-staging) ──┘
                            ↓
                    Restore verification target
```

## Related Code Files

**Create:**
- `docs/plans/260617-dr-drill-june-2026/plan.md` (this file)
- `docs/plans/260617-dr-drill-june-2026/reports/dr-drill-report-260617.md`
- `docs/plans/260617-dr-drill-june-2026/reports/metrics.json`
- `docs/disaster-recovery.md` (update with next drill date)

**Modify:** none

**Delete:** none

## Implementation Steps

### 1. Verify Backup Infrastructure

**Commands:**
```bash
# Check D1 databases exist
npx wrangler d1 list | grep sophia-raas-db

# Check R2 backup bucket exists
npx wrangler r2 bucket list | grep sophia-backups

# Check D1 backup route is deployed
curl -s https://sophia.agencyos.network/api/cron/d1-backup -I
```

**Expected:**
- `sophia-raas-db` (PROD) exists: 78bd1961-b62d-43bb-b551-0c5d7d389506
- `sophia-raas-db-staging` exists: bf74b301-7bb4-441f-9960-c96244b82953
- `sophia-backups` R2 bucket exists
- Backup route returns 200 or 401 (auth required)

### 2. Check Current R2 Backup Snapshot

**Commands:**
```bash
# Download latest snapshot from R2 (if exists)
cd backups
# Use AWS CLI or curl with R2 access key if available
# Or use wrangler r2 object get sophia-backups <key> --file=latest.sql
```

**Fallback:** If R2 objects cannot be listed (wrangler version limitation), document that the backup route `/api/cron/d1-backup` is configured and will create daily snapshots.

### 3. Create Fresh Snapshot (Optional)

**Commands:**
```bash
cd apps/sophia-ai-factory
bash scripts/dr/d1-snapshot.sh
# OR trigger via production endpoint:
# curl -sX POST https://sophia.agencyos.network/api/cron/d1-backup -H "Authorization: Bearer $CRON_SECRET"
```

### 4. Verify Schema Integrity

**Commands:**
```bash
bash scripts/verify-d1-backup.sh
```

**Expected:** No drift or expected drift (in-flight migrations only).

### 5. Document Current State

Record:
- PROD D1: num_tables, database_size
- Staging D1: num_tables, database_size
- R2 backups bucket: lifecycle policy (30 days)
- D1 backup route: configured in wrangler.toml

### 6. Update Disaster Recovery Runbook

Update `docs/disaster-recovery.md`:
- Next drill: September 2026 (Q3)
- Verify contact information is current
- Note any infrastructure changes

### 7. Create Drill Report

Document in `docs/plans/260617-dr-drill-june-2026/reports/dr-drill-report-260617.md`:
- Infrastructure verification results
- Observations about staging vs PROD schema
- Recommendations for improving backup strategy
- Confirmation that existing DR procedures remain valid

## Todo List

- [ ] Verify D1 databases (PROD and staging) exist and accessible
- [ ] Verify R2 backup bucket `sophia-backups` exists
- [ ] Verify D1 backup route `/api/cron/d1-backup` is configured
- [ ] Check schema integrity with `scripts/verify-d1-backup.sh`
- [ ] Document table counts and sizes for PROD and staging
- [ ] Create fresh snapshot (optional, verify existing is fresh)
- [ ] Write drill report with findings
- [ ] Update disaster-recovery.md with next drill date
- [ ] Schedule next drill: September 1, 2026

## Success Criteria

- Backup infrastructure verified and documented ✅
- R2 bucket lifecycle policy confirmed (30-day retention) ✅
- D1 backup route confirmed operational ✅
- Schema integrity check passes (or expected drift documented) ✅
- Drill report created with current metrics ✅
- Runbook updated with next drill date ✅

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrangler CLI version limits R2 object listing | High | Low | Document bucket existence via `wrangler r2 bucket list`; note CLI upgrade needed |
| Staging schema drift vs PROD | Med | Med | Document drift; consider applying pending migrations to staging |
| Backup route auth failure | Low | High | Verify CRON_SECRET exists; test with authenticated curl |
| R2 snapshot stale (>7 days) | Low | Med | Create fresh snapshot before next quarterly drill |

## Security Considerations

- CRON_SECRET used only in documented commands, never logged
- Snapshots contain production data — handle securely
- Staging D1 restore test would contain PII — only on isolated staging environment

## Next Steps

1. **September 2026 Drill:** Full end-to-end restore on staging with measured RTO/RPO
2. **Wrangler Upgrade:** Consider upgrading to 4.101+ for `wrangler r2 object list` capability
3. **Staging Sync:** Apply pending migrations to staging to match PROD schema (currently 164 vs 118 tables)

## Notes

- The previous DR drill (2026-05-18) achieved RTO = 13 seconds and RPO = 0 seconds — excellent results
- Layer 10 Backup score ceiling remains at 7/10 under no-tech doctrine; operational track record over multiple quarters may raise this
- No automated cron registration per no-tech doctrine; backups rely on Upstash QStash external cron
