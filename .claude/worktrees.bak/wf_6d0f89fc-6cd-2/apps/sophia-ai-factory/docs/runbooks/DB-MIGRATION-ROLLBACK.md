# Runbook: Database Migration Rollback

**Severity:** P0
**Owner:** DBA / CTO

---

## Symptoms

- Migration applied but contains SQL error or logic bug
- Application errors after migration (e.g., column missing, constraint violation)
- Data corruption or loss detected post-migration
- Rollback required but not pre-scripted (manual intervention)

---

## Diagnosis

### 1. Identify problematic migration

```bash
# List applied migrations
npx wrangler d1 execute sophia-raas-db --remote --command "
  SELECT id, name, applied_at
  FROM _cf_KV
  WHERE key LIKE 'migration:%'
  ORDER BY applied_at DESC;
"
```

Or check migration tracking table if app uses custom tracking:

```sql
SELECT * FROM migrations ORDER BY applied_at DESC LIMIT 10;
```

Identify the most recent migration(s) that coincided with the incident.

### 2. Review migration contents

```bash
cat migrations/<NNNN_name>.sql
```

Check for:
- `DROP TABLE` or `DROP COLUMN` (destructive)
- `NOT NULL` additions without default
- Data transformation errors
- Missing `BEGIN;` / `COMMIT;` causing partial application

### 3. Check application logs for DB errors

```bash
npx wrangler tail --name sophia-ai-factory --since 10m | grep -i "error\|panic\|exception"
```

Typical errors:
- `no such column: X`
- `UNIQUE constraint failed`
- `foreign key constraint failed`

---

## Remediation

### Case A: Migration is reversible (has down script)

If migration file includes `-- DOWN:` section or a corresponding `down.sql`:

```bash
# Apply down migration
npx wrangler d1 execute sophia-raas-db --remote --file=migrations/<NNNN_name>_down.sql
```

Or use the apply-migrations script with `--revert`:

```bash
bash scripts/apply-migrations.sh --revert <NNNN_name>
```

### Case B: Migration is NOT reversible (common)

Manual rollback required.

**Step 1: Take a backup immediately**

```bash
# Export entire DB to R2 (or local file)
npx wrangler d1 export sophia-raas-db --remote --output=sophia-raas-db-backup-$(date +%s).sql
```

**Step 2: Reverse the changes manually**

For `ADD COLUMN`:
```sql
ALTER TABLE table_name DROP COLUMN column_name;
```

For `DROP TABLE`:
- Restore from backup if table data was important
- May be unrecoverable if no backup

For `CREATE INDEX`:
```sql
DROP INDEX index_name;
```

For data transformation (UPDATE):
```sql
-- Reverse the transformation if possible
UPDATE table SET old_col = new_col;  -- inverse logic
```

**Step 3: Verify application works**

- Check health endpoint
- Run smoke tests
- Verify key workflows manually

**Step 4: Re-deploy previous version**

If migration was part of a deploy, rollback the Worker:

```bash
npx wrangler rollback --name sophia-ai-factory --yes
```

This ensures application code matches the previous DB schema.

---

## Preventing Future Migration Issues

### Migration Checklist (Pre-apply)

- [ ] Migration reviewed by at least one other engineer (`-- Reviewed by:` comment in file)
- [ ] Down migration script exists (even if `-- DOWN: NOT REVERSIBLE`)
- [ ] Migration tested on staging first
- [ ] Backup taken before applying to production (`scripts/apply-migrations.sh` does this automatically)
- [ ] Migration is idempotent or tracked in `_cf_KV` to prevent double-apply

### Safe Migration Patterns

**Additive-only (zero risk):**
```sql
CREATE TABLE new_table (...);
CREATE INDEX idx_name ON table(col);
```

**Add nullable column:**
```sql
ALTER TABLE table ADD COLUMN new_col TEXT;
-- No default, nullable — safe
```

**Backfill with care:**
```sql
BEGIN;
UPDATE large_table SET new_col = 'value' WHERE new_col IS NULL;
COMMIT;
-- Do in batches: UPDATE ... WHERE id BETWEEN X AND Y;
```

**Never do in production without extensive testing:**
- `DROP COLUMN` / `DROP TABLE`
- `ALTER COLUMN SET NOT NULL` without default
- Mass `DELETE` without backup
- `VACUUM` or other maintenance locks

---

## Escalation

Escalate to CTO immediately if:

- Data loss suspected and backup is missing or corrupted
- Migration affected critical tables (`users`, `subscriptions`, `payments`)
- Manual rollback is incomplete or causing further errors
- Production is down and rollback is not working

---

## Post-Incident

1. Document what happened in incident report
2. Update migration to include proper down script
3. Add additional safeguards (e.g., feature flag for schema changes)
4. Review deployment process: should migrations be gated behind pre-deploy checks?
5. Consider implementing migration dry-run in staging before every prod apply

---

## References

- `scripts/apply-migrations.sh` — migration application script (auto-backup)
- `docs/deployment-guide.md` — D1 migration workflow
- `docs/incident-runbook.md` — general incident response
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
