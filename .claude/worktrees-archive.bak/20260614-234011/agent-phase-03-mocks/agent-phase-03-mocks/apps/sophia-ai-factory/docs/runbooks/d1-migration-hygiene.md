# D1 Migration Hygiene

**Document ID:** RUN-MIG-001
**Effective Date:** 2026-05-20
**Review Date:** 2026-11-20 (Semi-annual)
**Owner:** Platform Ops
**Scope:** `apps/sophia-ai-factory/migrations/*.sql` against D1 `sophia-raas-db`.

---

## 1. Current State (2026-05-20)

- **Total migrations:** 117 (range `0001-init.sql` … `0117-refresh-video-generation-starter-sop.sql`)
- **Naming inconsistency:** mixed `NNNN-name.sql` (dash) and `NNNN_name.sql` (underscore) — both accepted by `wrangler d1 migrations apply`
- **Apply script:** `scripts/apply-migrations.sh` — applies only migrations changed since last commit
- **Format:** plain SQL, no DOWN migrations (D1 doesn't support automated rollback)

---

## 2. Hygiene Rules (per migration)

### 2.1 Filename
- Pattern: `NNNN-kebab-case-description.sql` (4-digit zero-padded, dash separator, lowercase)
- Sequential — no gaps, no duplicates
- Descriptive: filename must answer "what does this migrate?" in 4-6 words
- Bad: `0099-fix.sql`, `0100-update-users.sql`
- Good: `0099-add-tier-quota-snapshot-table.sql`, `0100-backfill-better-auth-user-roles.sql`

### 2.2 Content
- **Idempotent operations preferred** (D1 doesn't track applied state automatically in our flow):
  ```sql
  CREATE TABLE IF NOT EXISTS foo (...);
  CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar);
  ALTER TABLE foo ADD COLUMN baz TEXT;  -- Wrap in try/check pattern if re-runnable matters
  ```
- One logical change per file. Don't bundle unrelated schema edits.
- Comments at top: WHAT + WHY (1-2 sentences each)
- NO seed data > 100 rows — use a separate `NNNN-seed-*.sql` file

### 2.3 Backward compatibility
- Adding columns: always nullable OR have a DEFAULT
- Dropping columns: split into 2 migrations across 2 deploys (code stops reading → drop)
- Renaming: use `ALTER TABLE foo RENAME COLUMN bar TO baz` (D1 supports since 2024)

---

## 3. Apply Workflow

### Local
```bash
cd apps/sophia-ai-factory
# Apply against local SQLite
npx wrangler d1 execute sophia-raas-db --file=migrations/0118-<name>.sql --local
# Verify
npx wrangler d1 execute sophia-raas-db --command "SELECT name FROM sqlite_master WHERE type='table';" --local
```

### Remote (production)
```bash
# After git push + deploy:full, if migrations/ changed in commit:
bash scripts/apply-migrations.sh
# Or single file:
npx wrangler d1 execute sophia-raas-db --file=migrations/0118-<name>.sql --remote
```

---

## 4. Consolidation Strategy (Future)

**Current pain:** 117 migrations make fresh-bootstrap slow (~30s) and review-hostile.

**When to consolidate:** when migration count exceeds **200** OR fresh-bootstrap exceeds **60s**.

**How (DO NOT execute without explicit Long approval):**
1. Snapshot current schema: `wrangler d1 export sophia-raas-db --output=schema-snapshot.sql --no-data`
2. Create `migrations-archive/` folder; move all `0001-NNNN-*.sql` into it (git history preserved)
3. Create new `0001-consolidated-schema-vYYYY-MM-DD.sql` with the snapshot contents
4. Update `apply-migrations.sh` baseline reference
5. Document the consolidation point in this runbook §6

**Risks of consolidation:**
- Loses migration timeline (can no longer time-travel to a mid-2025 schema)
- Breaks any tooling that scans individual migration files
- One-way operation; can't undo cleanly

**Recommendation as of 2026-05-20:** **DEFER**. 117 migrations is manageable. Re-evaluate at 200.

---

## 5. Operator Checks

| Trigger | Action | Frequency |
|---|---|---|
| New migration PR | Verify filename pattern + content rules (§2) | Per PR |
| Migration apply fails on prod | Roll back via `wrangler d1 execute --command "<reverse>"` manual | When alert fires |
| Quarterly review | Check migration count, fresh-bootstrap time, consolidation threshold | Every 6 months |
| Pre-major-release | Run `apply-migrations.sh` against ephemeral D1 to verify clean apply | Per release |

---

## 6. Consolidation History

| Date | Trigger | Action | New baseline |
|---|---|---|---|
| _none yet_ | — | — | — |

---

## 7. Cross-References

- `apps/sophia-ai-factory/migrations/` — source-of-truth migrations
- `apps/sophia-ai-factory/scripts/apply-migrations.sh` — diff-based apply script
- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` → §"Migration Application"
- `apps/sophia-ai-factory/CLAUDE.md` → "Canonical Deploy Flow" step 2

---

## 8. Unresolved

- No automated check that `apply-migrations.sh` is run when `migrations/*.sql` changes — relies on operator memory + deploy-verify doc
- No CI gate on filename pattern (mixed `-` and `_` accepted today; should pick one)
- DOWN migrations: D1 doesn't support; document the manual reverse-SQL strategy per migration when destructive (defer until first incident)
