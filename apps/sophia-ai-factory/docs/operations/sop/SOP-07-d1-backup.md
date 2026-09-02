# SOP-07: D1 Backup & Restore

> Version: 1.0 | Baseline: `5dd1f071` | Owner: Tech Lead | Review: Monthly
> **WARNING: Restore procedure is NOT VERIFIED — see DISASTER_RECOVERY_READINESS.md**

---

## Backup (Automated via Cron)

```bash
# Trigger manually if needed
curl -X POST https://sophia.agencyos.network/api/cron/d1-backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

- **Output:** `sophia-backups/d1-YYYY-MM-DD.sql` in R2
- **Retention:** 30-day R2 lifecycle
- **Idempotency:** Skips if backup succeeded in last 12h

---

## List Backups

```bash
npx wrangler s3 object list sophia-backups --prefix d1-
```

---

## Restore Procedure (UNVERIFIED)

```bash
# 1. Download backup from R2
npx wrangler s3 object get sophia-backups/d1-2026-09-01.sql --file=d1-restore.sql

# 2. Create scratch D1 for test restore
npx wrangler d1 create sophia-restore-test

# 3. Execute restore on scratch database
npx wrangler d1 execute sophia-restore-test --file=d1-restore.sql --remote

# 4. Verify
npx wrangler d1 execute sophia-restore-test --command="SELECT COUNT(*) FROM user" --remote
npx wrangler d1 execute sophia-restore-test --command="SELECT COUNT(*) FROM mission" --remote

# 5. If scratch restore works, apply to production
# ⚠️ THIS HAS NEVER BEEN TESTED ON PRODUCTION
npx wrangler d1 execute sophia-raas-db --file=d1-restore.sql --remote
```

---

## Verification After Restore

- [ ] Row counts match expected
- [ ] Schema intact (run migrations if needed)
- [ ] App health checks pass
- [ ] Protected flows work

---

## Monthly Drill (REQUIRED)

- [ ] Execute restore to scratch D1
- [ ] Document results in `docs/operations/drills/`
- [ ] Update `DISASTER_RECOVERY_READINESS.md` with drill date

---

## References

- `DISASTER_RECOVERY_READINESS.md` — Full DR assessment
- `INCIDENT_RESPONSE.md` — Playbook 3