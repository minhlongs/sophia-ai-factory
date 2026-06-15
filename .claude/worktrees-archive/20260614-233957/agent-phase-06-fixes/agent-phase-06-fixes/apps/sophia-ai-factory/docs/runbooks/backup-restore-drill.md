# Backup Restore Drill SOP

**Document ID:** RUN-BACKUP-001
**Effective Date:** 2026-05-20
**Review Date:** 2026-08-20 (Quarterly)
**Owner:** Platform Ops
**Scope:** Monthly verification that D1 backups in `sophia-backups` R2 bucket are restorable.

---

## 1. Why This Exists

Backup that has never been restored is a hypothesis, not a backup. This SOP turns the daily D1 dump produced by `/api/cron/d1-backup` into a tested recovery capability.

**Acceptance:** every calendar month, operator restores the most recent dump into an ephemeral D1 database and verifies row counts on 3 critical tables.

---

## 2. Pre-Drill Checks

1. Confirm `sophia-backups` bucket has objects from the last 7 days:
   ```bash
   npx wrangler r2 object list sophia-backups --jq '.[] | {key, uploaded}' | head -10
   ```
2. Confirm `CRON_SECRET` env is set locally (needed if you trigger a fresh dump):
   ```bash
   echo $CRON_SECRET | wc -c   # > 1 means set
   ```
3. Confirm `wrangler` CLI ≥ 3.x and authenticated:
   ```bash
   npx wrangler whoami
   ```

---

## 3. Drill Procedure (30 min)

### 3.1 Pull the latest backup

```bash
# List most recent objects
LATEST=$(npx wrangler r2 object list sophia-backups --jq 'sort_by(.uploaded) | reverse | .[0].key')
echo "Restoring: $LATEST"

# Download
mkdir -p /tmp/backup-drill
npx wrangler r2 object get sophia-backups/$LATEST --file=/tmp/backup-drill/dump.sql
ls -lh /tmp/backup-drill/dump.sql   # sanity: should be MB-range, not bytes
```

### 3.2 Create ephemeral D1 database

```bash
# Use timestamped name so drills don't collide
DRILL_DB="sophia-restore-drill-$(date +%y%m%d)"
npx wrangler d1 create "$DRILL_DB"
# Note the database_id from output
```

### 3.3 Apply dump

```bash
npx wrangler d1 execute "$DRILL_DB" --file=/tmp/backup-drill/dump.sql --remote
```

### 3.4 Verify row counts (3 critical tables)

```bash
# users — should be > 0
npx wrangler d1 execute "$DRILL_DB" --command "SELECT COUNT(*) AS n FROM users;" --remote

# subscriptions — should be > 0 if any paid tier exists
npx wrangler d1 execute "$DRILL_DB" --command "SELECT COUNT(*) AS n FROM subscriptions;" --remote

# payment_events — should be > 0 after first NOWPayments IPN
npx wrangler d1 execute "$DRILL_DB" --command "SELECT COUNT(*) AS n FROM payment_events;" --remote
```

Compare against PROD counts (run same SELECTs against `sophia-raas-db`). Acceptable drift: ≤ 24h worth of new rows (dump is daily).

### 3.5 Smoke schema integrity

```bash
# Count tables — should match PROD
npx wrangler d1 execute "$DRILL_DB" --command "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table';" --remote
npx wrangler d1 execute sophia-raas-db --command "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table';" --remote
```

### 3.6 Cleanup

```bash
# Drop ephemeral DB
npx wrangler d1 delete "$DRILL_DB" --skip-confirmation
rm -rf /tmp/backup-drill
```

---

## 4. Record in Drill Log

Append a row to §6 below:

| Date | Backup key | Tables matched | Row delta | Verdict | Operator |
|---|---|---|---|---|---|
| 2026-MM-DD | `dump-YYYYMMDD-HHMM.sql` | ✅ users / subs / payments | < 24h | PASS / FAIL | name |

If FAIL → file incident, do not delete the dump, escalate via `cron-escalation-contacts.md`.

---

## 5. Failure Modes & Responses

| Symptom | Likely cause | Action |
|---|---|---|
| `wrangler r2 object list` empty | `/api/cron/d1-backup` not running OR wrong bucket | Trigger manual dump; check cron wiring |
| dump.sql is 0 bytes | Producer wrote empty file; D1 export bug | Re-trigger dump; if reproducible, file Cloudflare issue |
| `d1 execute --file` fails on syntax | Schema drift between dump and current wrangler | Pin wrangler version; re-export |
| Row counts wildly off | Dump from wrong DB OR clock skew | Verify producer's D1 binding; check dump timestamp |
| `wrangler d1 create` quota exceeded | Too many drill DBs not cleaned | Delete old `sophia-restore-drill-*` DBs |

---

## 6. Drill Log

| Date | Backup key | Tables matched | Row delta | Verdict | Operator |
|---|---|---|---|---|---|
| _baseline_ | — | — | — | — | populate first drill |

---

## 7. Cross-References

- `docs/runbooks/r2-storage-policy.md` — `sophia-backups` 30-day lifecycle (RUN-R2-001)
- `docs/runbooks/cf-quota-response.md` — D1 quota response
- `docs/runbooks/d1-region-failure.md` — DR procedure
- `apps/sophia-ai-factory/src/app/api/cron/d1-backup/route.ts` — backup producer route
- `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` → §"Backup" (operator discretion, no external cron)

---

## 8. Unresolved

- Drill is **manual only**. Automation (a `/api/cron/restore-drill` route that spins up a workers-internal ephemeral D1) deferred — D1 doesn't yet support programmatic ephemeral DB creation from Workers runtime
- No checksum on dump.sql at producer time — restore-drill is the only integrity check
- 30-min drill is sequential; can't easily parallelize across multiple operators
