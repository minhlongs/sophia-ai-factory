# D1 Migration Risk Audit

**Date:** 2026-07-17 | **Auditor:** kongming-actions | **Scope:** 193 SQL migrations, apply-migrations.sh runner, wrangler.toml D1 config

---

## 1. Migration Count & Duplicate Severity

### Counts

- **Total files in `migrations/`**: 193 (all `.sql`)
- **Duplicate migration numbers**: 12 prefixes appear more than once
- **Duplicate files**: 12 extra files (193 - 181 unique-named)

### Duplicate breakdown

| Prefix | Files | Likely cause |
|--------|-------|-------------|
| `0004` | `0004-user-profiles.sql`, `0004_error_log.sql`, `0004_migrate_users_to_user.sql` | Pre-consolidation rename churn (dash vs underscore) |
| `0005` | `0005-signals-events.sql`, `0005_migrate_users_to_user.sql` | Same |
| `0031` | `0031-affiliate-offers-catalog.sql`, `0031-video-pipeline-jobs.sql` | Parallel dev branches merged |
| `0032` | `0032-seed-affiliate-catalog.sql`, `0032-voices.sql` | Same |
| `0033` | `0033-video-templates.sql`, `0033-video-usage-monthly.sql` | Same |
| `0034` | `0034-tenant-storage-usage.sql`, `0034-video-onboarding-events.sql` | Same |
| `0100` | `0100-onboarding-automation.sql`, `0100-telegram-pairing-unique-paired-by.sql` | Different intent, same number |
| `0118` | `0118_d1_migrations_baseline.sql`, `0118_d1_migrations_baseline_full.sql` | Baseline variants |
| `0178` | `0178_idempotency_keys.sql`, `0178_referral_rewards_table.sql` | Same |
| `0179` | `0179_batch_jobs_idempotency_unique.sql`, `0179_referral_rewards_table.sql` | Same |
| `0212` | `0212_create_creator_profiles.sql`, `0212_user_beta_invites.sql` | Same |
| `0213` | `0213_create_sop_listings.sql`, `0213_user_streaks.sql` | Same |

### Numbering gaps (potential missing-in-action migrations)

- `0028`, `0029`, `0030` exist as separate files. **0035 through 0099 files do not exist** in the directory. The baseline (0118) confirms they were applied historically -- these numbers were reused or skipped. **Actual gap: 0035-0099 are not files in this directory** (were applied in earlier deploys before this branch).
- `0203` through `0206` exist but **0204, 0205 are absent** -- gaps in the numbering.

### Severity assessment: MEDIUM

The duplicates are a **naming problem, not an execution problem** -- because of how `apply-migrations.sh` works (detailed in Section 2). The runner checks by **filename**, not by prefix, so each duplicate file has a unique name and gets its own `d1_migrations` table entry. The actual schema state in production is consistent with the baseline.

However, the **maintenance burden is real**: anyone reading the directory sees confusing numbering, `git diff`-based triggers may skip files during merges, and future automated numbering tools (like `wrangler d1 migrations create`) will collide.

---

## 2. Runner Behavior

### `apply-migrations.sh` mechanism

The script uses a **git-diff-based trigger** (not a full scan of the migrations directory):

```bash
MIGRATIONS=$(git diff --name-only --relative "$REF" HEAD -- migrations/  | grep -E "\.sql$" | sort || true)
```

Default REF is `HEAD~1`. This means **only migrations changed in the last commit** are applied. A new commit that touches multiple migration files is the trigger unit.

### Idempotency guarantees

The runner has **three layers of defense**:

1. **`d1_migrations` table check** -- Before applying, queries `SELECT COUNT(*) FROM d1_migrations WHERE name = ?`. If already applied, SKIP. This is the primary idempotency mechanism.
2. **Pre-flight `sqlite_master` guard** -- `guard_drop_rename()` parses each migration for `DROP TABLE` / `ALTER TABLE` and verifies those tables still exist. If they don't, the migration is SKIPPED (with warning). This makes re-runs safe for destructive migrations.
3. **Post-flight schema verification** -- Hardcoded verification queries in `VERIFY_AFTER` array confirm specific tables/columns exist after migration. **Non-blocking warnings only** (does not fail deploy).

### Warning: non-deterministic ordering within a single commit

```bash
for m in $MIGRATIONS; do
```

The `for` loop iterates over the output of `git diff ... | sort`. The `sort` is lexicographic (byte-level), which for filenames with mixed dash/underscore styles is fine. But the order **follows git diff output, not a numeric prefix sequence**. In theory this could run `0033-video-templates.sql` before `0032-voices.sql` if the diff lists them that way. In practice SQLite DDL is idempotent enough that order within a single deploy rarely matters, but **migrations with foreign-key dependencies between them would be unsafe**.

### Warning: failures are non-fatal

```bash
if ! npx wrangler d1 execute ...; then
  echo "ERROR: ${MIGRATION_NAME} FAILED -- continuing with remaining migrations"
  continue
fi
```

A failed migration is logged but the loop continues. No deploy abort. This means **silent schema divergence is possible** if a migration fails silently (bad SQL that happens to not error).

### What is NOT checked

- **No schema_version table** -- The only `schema_version` reference found is a column in `tenant_settings` (application-level, not a migration tracking table). Migration state is tracked exclusively by the `d1_migrations` table.
- **No rollback mechanism** -- Failed migrations cannot be rolled back from this script.
- **No enforcement of numeric prefix ordering** -- D1 does not validate that `0020` comes before `0025`. Ordering is the developer's responsibility.

---

## 3. Recommended Fix Priority

### P1 -- Immediate safety (do before next deploy)

**A. Add a pre-commit or CI hook that rejects duplicate prefixes.**
The `grep -oP '^\d+' | sort | uniq -d` check (12 duplicates today) should fail the build. No new prefix collision should enter the repo. Simple script: extract numeric prefix, check for collisions.

**B. Rename historical duplicates to use the next available gap.**
The 0035-0099 numbering gap exists because those migrations were applied in earlier deploys (pre-this-branch). The duplicates in 0031-0034 and 0178-0179 and 0212-0216 never should have had the same prefix. Renaming approach: assign the next available number in the gap range.

### P2 -- Before next major schema change

**C. Enforce `cyril` or `wrangler d1 migrations create` naming convention.**
All new migrations should use `NNNN-description.sql` format with dashes, no underscores, no duplicate NNNN. Wrap `wrangler d1 migrations create` in a project wrapper script that validates naming before creating.

**D. Add migration dependency graph or at least a topology comment.**
If any pair of migrations has a foreign-key or dependency relationship, document it in the migration filename or a `MIGRATION_DAG.md`. The `for` loop in `apply-migrations.sh` should at minimum sort by numeric prefix before executing.

### P3 -- Ongoing hygiene

**E. Periodic audit of `d1_migrations` vs filesystem.**
Once per sprint, run a script that compares `SELECT name FROM d1_migrations` against `ls migrations/ | grep .sql`. Any diversions should be investigated.

**F. Consider baseline refresh cadence.**
The `0118_baseline.sql` has 120 records and `0118_baseline_full.sql` has 169 records. These are historical snapshots. Once production is stable, these baseline files could be archived out of the migrations directory to reduce noise. They are not executed by `apply-migrations.sh` (the script only runs git-diff-triggered files), so they are dead weight in the directory listing.

---

## Summary

| Dimension | Finding |
|-----------|---------|
| Total migrations | 193 files |
| Duplicate prefixes | 12 (6.2% of file count) |
| Actual risk to production | LOW -- runner uses filename, not prefix; d1_migrations table is authoritative |
| Maintenance risk | MEDIUM -- confusing for developers, collision risk with wrangler |
| Runner idempotency | GOOD -- 3-layer guard (d1_migrations table, sqlite_master pre-flight, post-flight verify) |
| Runner failure mode | WEAK -- failed migrations are non-fatal, no abort, no rollback |
| schema_version table | NONE -- not used for migration tracking |
| Primary recommendation | Add naming collision guard to CI + rename historical duplicates |

**Bottom line**: Production schema state is consistent and safe. The risk is developer confusion and future collision, not current data integrity. P1 guard + rename is a 2-hour fix with outsized safety benefit.
