# Phase 07 — DR Drill: Restore on Staging

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §6 D4, §7
- Existing DR doc: `docs/disaster-recovery.md`
- D1 backup route: `src/app/api/cron/d1-backup/route.ts` (per doctrine)
- R2 backup bucket: `BACKUPS_BUCKET` binding (per `wrangler.toml`)
- Staging D1: `sophia-raas-db-staging` (from Phase 02)

## Overview
- **Priority:** P0 (compliance-grade requirement; score uplift)
- **Status:** pending (unblocked 2026-05-18 via Phase 02 staging deploy)
- **Duration:** ~1 day (D8)
- **Brief:** Take fresh snapshot of PROD D1 → R2. Wipe staging D1. Restore from R2 snapshot to staging D1. Verify integrity. Measure wall-clock RTO + data-age RPO. Document procedure step-by-step.

## Key Insights
- Backup route exists (`/api/cron/d1-backup`) but is NOT cron-registered (per no-tech doctrine) — manual trigger via authenticated curl
- R2 lifecycle (30-day) is de-facto backup
- DR drill on staging = ZERO risk to PROD
- Measured RTO < 4h, RPO < 24h = compliance baseline
- This is the SCORE-UPLIFT event — Layer 10 Backup operational track record

## Requirements
**Functional:**
- Trigger fresh PROD D1 backup → R2
- Wipe staging D1 (drop all tables) — confirm zero rows
- Restore from R2 snapshot → staging D1
- Integrity check: row counts match per table for critical tables (users, promo_codes, subscriptions, coupon_redemptions, sessions, payment_events)
- Measure RTO (wall-clock from "start restore" to "data verified")
- Measure RPO (timestamp of latest row in restore vs current time)

**Non-functional:**
- Procedure documented with step-by-step commands + timestamps
- Every command's output captured to file
- Procedure reproducible by another operator

## Architecture
```
PROD D1 ──[/api/cron/d1-backup + CRON_SECRET]──→ R2 (BACKUPS_BUCKET)
                                                     │
STAGING D1 (wiped)  ←──[wrangler d1 execute --file]──┘
       │
       └─→ Integrity check via SELECT counts + sample queries
```

## Related Code Files
**Create:**
- `docs/dr-drill-260522.md` (procedure + measured metrics)
- `scripts/dr-restore-staging.sh` (reproducible script)
- `plans/260517-2223-sophia-free100-handover/reports/phase-07-dr-drill-report.md`

**Modify:**
- `docs/disaster-recovery.md` (update with measured RTO/RPO values)

**Delete:** none

## Implementation Steps

### 1. Trigger fresh PROD D1 backup
```bash
T_BACKUP_START=$(date +%s)
echo "Backup start: $(date -Iseconds)"
curl -sX POST "https://sophia.agencyos.network/api/cron/d1-backup" \
  -H "Authorization: Bearer $CRON_SECRET" | tee /tmp/dr-backup-response.json
T_BACKUP_END=$(date +%s)
echo "Backup end: $(date -Iseconds) (duration $((T_BACKUP_END - T_BACKUP_START))s)"
```
Capture: response file path in R2.

### 2. List R2 backups to confirm new snapshot present
```bash
npx wrangler r2 object list sophia-ai-factory-backups --prefix d1-backup/
# expect newest entry timestamped within last 5 min
```
Capture: snapshot key (e.g. `d1-backup/2026-05-22T14-30-00Z.sql`).

### 3. Download snapshot locally
```bash
SNAPSHOT_KEY="d1-backup/2026-05-22T14-30-00Z.sql"  # adapt
npx wrangler r2 object get sophia-ai-factory-backups "$SNAPSHOT_KEY" \
  --file=/tmp/dr-snapshot.sql
ls -lh /tmp/dr-snapshot.sql
```

### 4. Wipe staging D1
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
# Get list of all tables and drop them
TABLES=$(npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'" \
  --json | jq -r '.[].results[].name')
for t in $TABLES; do
  echo "DROP TABLE $t"
  npx wrangler d1 execute sophia-raas-db-staging --remote \
    --config wrangler.staging.toml --command "DROP TABLE IF EXISTS $t"
done
# Verify zero tables
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
# expect 0
```

### 5. Start restore (T0 for RTO measurement)
```bash
T0=$(date +%s)
echo "Restore start T0: $(date -Iseconds)"
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml --file=/tmp/dr-snapshot.sql \
  2>&1 | tee /tmp/dr-restore.log
T_RESTORE_END=$(date +%s)
echo "Restore end: $(date -Iseconds) (duration $((T_RESTORE_END - T0))s)"
```

### 6. Integrity check — row counts
```bash
for table in users promo_codes subscriptions coupon_redemptions sessions payment_events; do
  COUNT=$(npx wrangler d1 execute sophia-raas-db-staging --remote \
    --config wrangler.staging.toml --json \
    --command "SELECT count(*) AS c FROM $table" \
    | jq -r '.[].results[0].c')
  PROD_COUNT=$(npx wrangler d1 execute sophia-raas-db --remote --json \
    --command "SELECT count(*) AS c FROM $table" \
    | jq -r '.[].results[0].c')
  echo "$table: staging=$COUNT prod=$PROD_COUNT"
  # allow small delta (rows written between backup time and now)
done
```

### 7. Integrity check — sample queries
```bash
# Verify a known recent FREE100 row exists
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "SELECT id, code FROM promo_codes WHERE code LIKE 'FREE100%' LIMIT 5"
# Verify auth schema intact
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml \
  --command "PRAGMA table_info(users)"
```

### 8. Measure RPO
```bash
# Find latest row timestamp across critical tables
npx wrangler d1 execute sophia-raas-db-staging --remote \
  --config wrangler.staging.toml --json \
  --command "SELECT max(created_at) AS latest FROM users UNION SELECT max(created_at) FROM promo_codes UNION SELECT max(created_at) FROM payment_events" \
  | jq
# RPO = NOW - max(latest)
NOW_MS=$(date +%s%3N)
# compute delta in hours
```

### 9. T_END for RTO
```bash
T_END=$(date +%s)
RTO_SEC=$((T_END - T0))
echo "RTO: $RTO_SEC seconds (~$(echo "scale=2; $RTO_SEC / 60" | bc) min)"
```

### 10. Write reproducible script
`scripts/dr-restore-staging.sh` encapsulates steps 1-9. Idempotent, safe to re-run.

### 11. Write `docs/dr-drill-260522.md`
```md
# DR Drill — 2026-05-22

## Procedure
<numbered steps with commands>

## Measured Metrics
- RTO (wall-clock): <X> minutes
- RPO (data age): <X> hours
- Snapshot size: <X> MB
- Snapshot key: <key>
- PROD vs Staging row delta per table: <table>

## Integrity Verification
- ✅ Row counts within delta tolerance
- ✅ Sample queries return expected rows
- ✅ Schema PRAGMA matches PROD

## Limitations Discovered
- <e.g. R2 download took longer than expected>

## Next Drill
Scheduled: <quarterly per disaster-recovery.md>
```

### 12. Update `docs/disaster-recovery.md`
- Replace placeholder RTO/RPO with measured values
- Add link to drill report
- Note "Verified by drill on 2026-05-22"

## Todo List
- [ ] Trigger PROD D1 backup via authenticated curl
- [ ] Confirm new R2 snapshot
- [ ] Download snapshot locally
- [ ] Wipe staging D1 (drop all tables, verify zero)
- [ ] Restore snapshot to staging D1 (capture T0/T_END)
- [ ] Verify row counts within tolerance
- [ ] Verify sample queries + schema
- [ ] Compute RTO (wall-clock)
- [ ] Compute RPO (data age)
- [ ] Write reproducible `scripts/dr-restore-staging.sh`
- [ ] Write `docs/dr-drill-260522.md`
- [ ] Update `docs/disaster-recovery.md` with measured values
- [ ] Write `reports/phase-07-dr-drill-report.md`

## Success Criteria
- Restore completes with no errors
- Row counts match PROD within tolerance (e.g., <1% delta for tables that grow continuously)
- Sample queries return valid data
- Schema matches PROD via PRAGMA diff
- RTO < 4 hours (target; document if higher)
- RPO < 24 hours (target; document if higher)
- Procedure reproducible by another operator (test by re-running script)

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backup route auth fails (CRON_SECRET wrong) | Low | High | Verify secret via `wrangler secret list`; fetch from secure store |
| Snapshot too large (>50MB) → slow download | Med | Low | Pre-check size; document if >5min download |
| Restore fails mid-stream | Med | High | Restore is idempotent (DROP TABLE first); re-run script |
| Schema drift between PROD and migrations applied to staging | Med | Med | Phase 02 applied all migrations; PRAGMA diff catches drift |
| Row delta exceeds tolerance | Med | Med | Document delta + investigate cause (e.g., rapid writes during backup window) |

## Security Considerations
- CRON_SECRET only used in command; never logged to file
- Snapshot downloaded to `/tmp` — wiped after drill (`rm /tmp/dr-snapshot.sql`)
- Staging D1 restored from PROD = may contain real customer PII
  - DO NOT expose staging publicly with this data
  - After drill, optionally wipe staging again or anonymize for further use
- R2 bucket access via wrangler authenticated session only

## Next Steps
- Phase 09 handover docs reference this DR drill report
- Phase 10 training video walks through restore procedure (using docs/dr-drill-260522.md as script)
- After Phase 10 sign-off, optionally schedule next drill in 90 days
