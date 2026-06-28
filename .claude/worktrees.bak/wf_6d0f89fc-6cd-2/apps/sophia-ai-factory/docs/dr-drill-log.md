# Sophia AI Factory — DR Drill Log

> **Purpose:** Record of monthly Disaster Recovery drills.
> **Owner:** Platform operator.
> **Retention:** Keep 12 months; archive older entries to `docs/archive/dr-drill-log-archive.md`.
> **Template:** Copy the entry block below for each new drill. Replace placeholder values.

---

## Drill Entry Template

```markdown
## drill-YYYY-MM-DDTHH-MM-SS — PASSED | FAILED

| Field | Value |
|---|---|
| **Date** | YYYY-MM-DDTHH:MM:SSZ |
| **Drill ID** | drill-YYYY-MM-DDTHH-MM-SS |
| **Status** | PASSED / FAILED |
| **Source DB** | sophia-raas-db |
| **Test DB** | sophia-drill-test (isolated) |
| **Backup file** | d1-YYYY-MM-DD-HHMMSS.sql |
| **Backup size** | N bytes |
| **Checksum (sha256)** | `<hex>` |
| **Row count** | N |
| **Restored tables** | N |
| **RTO** | X.XX min (NNNN ms) |
| **RPO** | X.XX min (NNNN ms) |
| **Export elapsed** | NNNN ms |
| **Restore elapsed** | NNNN ms |
| **Integrity** | OK / FAILED |
| **Operator** | <name or "automated"> |
| **Notes** | Free-text observations |
```

---

## 2026-06-17 — Monthly Drill (placeholder)

> **Status:** Template — replace with actual drill results.
> **Run command:** `node scripts/dr/run-drill.js`

| Field | Value |
|---|---|
| **Date** | 2026-06-17T03:00:00Z |
| **Drill ID** | drill-2026-06-17T03-00-00 |
| **Status** | PENDING |
| **Source DB** | sophia-raas-db |
| **Test DB** | sophia-drill-test |
| **Backup file** | d1-2026-06-17-030000.sql |
| **Backup size** | TBD |
| **Checksum (sha256)** | TBD |
| **Row count** | TBD |
| **Restored tables** | TBD |
| **RTO** | TBD |
| **RPO** | TBD |
| **Export elapsed** | TBD |
| **Restore elapsed** | TBD |
| **Integrity** | TBD |
| **Operator** | automated |
| **Notes** | First scheduled monthly drill post Phase 2 implementation. |

---

## 2026-05-17 — Monthly Drill (placeholder)

> **Status:** Template — replace with actual drill results.

| Field | Value |
|---|---|
| **Date** | 2026-05-17T03:00:00Z |
| **Drill ID** | drill-2026-05-17T03-00-00 |
| **Status** | PENDING |
| **Source DB** | sophia-raas-db |
| **Test DB** | sophia-drill-test |
| **Backup file** | d1-2026-05-17-030000.sql |
| **Backup size** | TBD |
| **Checksum (sha256)** | TBD |
| **Row count** | TBD |
| **Restored tables** | TBD |
| **RTO** | TBD |
| **RPO** | TBD |
| **Export elapsed** | TBD |
| **Restore elapsed** | TBD |
| **Integrity** | TBD |
| **Operator** | automated |
| **Notes** | Pre-Phase 2 baseline drill — manual trigger only. |

---

## 2026-04-17 — Monthly Drill (placeholder)

> **Status:** Template — replace with actual drill results.

| Field | Value |
|---|---|
| **Date** | 2026-04-17T03:00:00Z |
| **Drill ID** | drill-2026-04-17T03-00-00 |
| **Status** | PENDING |
| **Source DB** | sophia-raas-db |
| **Test DB** | sophia-drill-test |
| **Backup file** | d1-2026-04-17-030000.sql |
| **Backup size** | TBD |
| **Checksum (sha256)** | TBD |
| **Row count** | TBD |
| **Restored tables** | TBD |
| **RTO** | TBD |
| **RPO** | TBD |
| **Export elapsed** | TBD |
| **Restore elapsed** | TBD |
| **Integrity** | TBD |
| **Operator** | automated |
| **Notes** | Earliest recorded drill. Baseline for RTO/RPO targets. |

---

## Drill Metrics Glossary

| Metric | Definition | Target |
|---|---|---|
| **RTO** (Recovery Time Objective) | Wall-clock time from disaster declaration to service restored on test DB | < 30 min |
| **RPO** (Recovery Point Objective) | Maximum acceptable data loss = time between last successful backup and disaster | < 24 h (daily backups) |
| **Export elapsed** | Time to produce the SQL dump via `wrangler d1 export` | < 5 min |
| **Restore elapsed** | Time to apply dump to test D1 via `wrangler d1 execute` | < 10 min |
| **Checksum** | SHA-256 of backup file — must match between creation and restore verification | 1:1 match |
| **Row count** | Number of `INSERT INTO` statements in the dump | Must be > 0 |
| **Restored tables** | Table count in the restored test DB | Must match prod |

## Schedule

| Frequency | Trigger | Responsible |
|---|---|---|
| Monthly | 03:00 UTC, 1st of month | Automated (`run-drill.js`) |
| Ad-hoc | After schema migration | Operator (manual) |
| Post-incident | After any production restore | Operator (mandatory) |

## Related

- `scripts/dr/run-drill.js` — automated drill runner
- `scripts/dr/d1-snapshot.sh` — daily D1 snapshot
- `scripts/dr/restore-from-snapshot.sh` — restore from snapshot
- `scripts/backup/mirror-to-r2.sh` — R2→S3/B2 cross-region mirror
- `scripts/verify-d1-backup.sh` — backup integrity drift detector
