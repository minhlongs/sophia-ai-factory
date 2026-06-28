# Migration Checklist: Redis → Supabase

> **Project:** RaaS License System
> **Date:** 2026-03-06
> **Status:** Historical reference — do not execute as a current Sophia runbook
> **Owner:** DevOps / Backend Team

> **Current-state note (2026-05-21):** This checklist predates the Cloudflare Workers/D1 deployment doctrine. It references legacy artifacts such as `docs/migrations/raas-licenses-schema.sql` and `scripts/deploy-raas-migration.sh` that are not present in the current repo. For current Sophia database/deploy operations, use `docs/deployment-guide.md`, `docs/codebase-summary.md`, and `apps/sophia-ai-factory/migrations/`.

---

## Pre-Migration Checks

### Environment Setup

- [ ] **Supabase CLI installed**
  ```bash
  npm install -g supabase
  # or
  npx supabase --version
  ```

- [ ] **Supabase CLI logged in**
  ```bash
  npx supabase login
  # Browser opens → login with GitHub
  ```

- [ ] **Project ref obtained**
  - Go to: https://supabase.com/dashboard/project/YOUR_REF
  - Copy project ref from URL

- [ ] **Environment variables ready**
  ```bash
  # Required for migration script
  export SUPABASE_SERVICE_ROLE_KEY=your-key-here
  export UPSTASH_REDIS_REST_URL=https://xxx.upstash.io  # Optional
  export UPSTASH_REDIS_REST_TOKEN=your-token  # Optional
  ```

### Backup (Recommended)

- [ ] **Export existing Redis data** (if any)
  ```bash
  # If using Upstash Redis
  redis-cli -u $UPSTASH_REDIS_REST_URL KEYS 'license:*' > redis-licenses-backup.txt
  redis-cli -u $UPSTASH_REDIS_REST_URL LRANGE audit 0 -1 > redis-audit-backup.txt
  ```

- [ ] **Document current state**
  ```bash
  # Count existing licenses
  redis-cli -u $UPSTASH_REDIS_REST_URL KEYS 'license:*' | wc -l
  # Count audit logs
  redis-cli -u $UPSTASH_REDIS_REST_URL LLEN audit
  ```

### Files Review

- [ ] **Read SQL schema**: historical artifact `docs/migrations/raas-licenses-schema.sql` (not present in current repo)
- [ ] **Read migration guide**: `docs/migrations/REDIS_TO_SUPABASE.md`
- [ ] **Review code changes**: `git diff main` (if applicable)

---

## Migration Execution

### Step 1: Run Deployment Script

Historical script path: `scripts/deploy-raas-migration.sh` (not present in current repo). Do not execute this section without first rebuilding a current migration plan from the live codebase.

**Expected output:**
```
[INFO] === Step 1: Checking Prerequisites ===
[SUCCESS] All prerequisites checked
[INFO] === Step 2: Linking Supabase Project ===
[SUCCESS] Supabase project linked successfully
[INFO] === Step 3: Executing SQL Migration ===
[SUCCESS] SQL migration executed successfully
[INFO] === Step 4: Verifying Tables Created ===
[SUCCESS] raas_licenses table exists (rows: 0)
[SUCCESS] raas_audit_logs table exists (rows: 0)
[SUCCESS] Found 11 indexes
[SUCCESS] Found 2 RLS policies
```

### Step 2: Manual Verification (Alternative)

If script fails, run manually:

```bash
# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Execute SQL (historical artifact; file is not present in current repo)
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql

# Verify tables
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_licenses;"
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_audit_logs;"

# Verify indexes
psql "$(npx supabase db url)" -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('raas_licenses', 'raas_audit_logs');"
```

### Step 3: Data Migration (Optional)

**Only if you have existing Redis data:**

```bash
# Set Redis env vars
export UPSTASH_REDIS_REST_URL=...
export UPSTASH_REDIS_REST_TOKEN=...

# Run migration script
npx tsx scripts/migrate-redis-to-supabase.ts

# Verify counts match
echo "Redis count: $(redis-cli KEYS 'license:*' | wc -l)"
echo "Supabase count: $(psql "$(npx supabase db url)" -t -c "SELECT COUNT(*) FROM raas_licenses;")"
```

**Important notes:**
- Redis stores metadata only, NOT full license keys
- Migrated licenses will have `requiresKeyRegeneration: true`
- Users will need new keys generated

---

## Post-Migration Verification

### Database Verification

- [ ] **Tables exist**
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'raas%';
  ```

- [ ] **Indexes created**
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename IN ('raas_licenses', 'raas_audit_logs');
  ```

- [ ] **RLS policies enabled**
  ```sql
  SELECT policyname FROM pg_policies WHERE schemaname = 'public';
  ```

- [ ] **RLS enabled on tables**
  ```sql
  SELECT relname, relrowsecurity FROM pg_class
  WHERE relname IN ('raas_licenses', 'raas_audit_logs');
  ```

### Code Deployment (Historical)

Do not use the original Vercel/GitHub Actions deployment checklist. Current Sophia deploy doctrine is:

```bash
cd apps/sophia-ai-factory
npm run deploy:migrations   # when D1 migrations are needed
npm run deploy:full         # build + OpenNext + CF Worker deploy + SHA injection
curl -s https://sophia.agencyos.network/api/version
```

`/api/version` must report the deployed commit short SHA. See `docs/deployment-guide.md`.

### API Testing

- [ ] **Test license list**
  ```bash
  curl -H "Authorization: Basic $(echo 'admin:password' | base64)" \
    https://sophia.agencyos.network/api/admin/licenses
  ```

- [ ] **Test license creation**
  ```bash
  curl -X POST \
    -H "Authorization: Basic $(echo 'admin:password' | base64)" \
    -H "Content-Type: application/json" \
    -d '{"tier":"basic","expiresAt":1893456000}' \
    https://sophia.agencyos.network/api/admin/licenses/create
  ```

- [ ] **Test license validation**
  ```bash
  curl -H "X-RaaS-License-Key: raas_basic_xxxx" \
    https://sophia.agencyos.network/api/protected
  ```

### Audit Log Verification

- [ ] **Create a license** via API
- [ ] **Check audit log created**
  ```sql
  SELECT action, license_nonce, created_at
  FROM raas_audit_logs
  ORDER BY created_at DESC
  LIMIT 5;
  ```

---

## Rollback Instructions

### Scenario 1: SQL Migration Failed

If tables were created but with errors:

```sql
-- Drop tables and start over
DROP TABLE IF EXISTS raas_audit_logs CASCADE;
DROP TABLE IF EXISTS raas_licenses CASCADE;
DROP FUNCTION IF EXISTS update_raas_licenses_updated_at CASCADE;

-- Re-run migration
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql
```

### Scenario 2: Data Migration Corrupted

If data migration caused issues:

```sql
-- Truncate tables (keeps schema)
TRUNCATE TABLE raas_audit_logs CASCADE;
TRUNCATE TABLE raas_licenses CASCADE;

-- Re-run data migration with fixed script
npx tsx scripts/migrate-redis-to-supabase.ts
```

### Scenario 3: Full Rollback to Redis

**NOT RECOMMENDED** - Only if critical issues:

```bash
# 1. Stop application traffic or disable affected routes
# 2. Drop Supabase tables
psql "$(npx supabase db url)" -c "DROP TABLE raas_licenses CASCADE; DROP TABLE raas_audit_logs CASCADE;"

# 3. Revert code to pre-migration commit
git checkout COMMIT_HASH_BEFORE_MIGRATION

# 4. Deploy reverted code through current CF-direct deploy doctrine
#    Never force-push main. Commit a revert, push, then run npm run deploy:full.

# 5. Restore Redis connection in env vars
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...
```

**Recommended alternative to rollback:**
- Instead of full rollback, fix the issue and deploy new keys for affected users
- Migration is designed to be forward-only

---

## Troubleshooting

### Issue: "relation already exists"

**Cause:** Tables already created from previous run

**Solution:**
```sql
-- Option 1: Drop and recreate
DROP TABLE IF EXISTS raas_audit_logs CASCADE;
DROP TABLE IF EXISTS raas_licenses CASCADE;
-- Re-run migration

-- Option 2: Use IF NOT EXISTS (already in schema)
-- Just re-run the script - it has IF NOT EXISTS clauses
```

### Issue: "permission denied"

**Cause:** Not logged in or wrong project

**Solution:**
```bash
# Relogin
npx supabase logout
npx supabase login

# Re-link project
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Issue: "connection refused"

**Cause:** Database URL not accessible

**Solution:**
```bash
# Check database URL
npx supabase db url

# Test connection
psql "$(npx supabase db url)" -c "SELECT 1;"
```

### Issue: Data migration fails

**Cause:** Redis connection or data format issues

**Solution:**
```bash
# Test Redis connection
curl "$UPSTASH_REDIS_REST_URL/ping?token=$UPSTASH_REDIS_REST_TOKEN"

# Check Redis keys manually
curl "$UPSTASH_REDIS_REST_URL/keys/license:*?token=$UPSTASH_REDIS_REST_TOKEN"
```

### Issue: API returns 500 errors

**Cause:** Required environment variables/secrets are not set in the current runtime

**Solution:**
1. Check required Worker secrets with `npx wrangler secret list`
2. Add missing values with `npx wrangler secret put <NAME>`
3. Re-run `cd apps/sophia-ai-factory && npm run deploy:full`

---

## Success Criteria

Migration is successful when ALL of these are true:

- [ ] Tables `raas_licenses` and `raas_audit_logs` exist
- [ ] At least 10 indexes created (check: `SELECT COUNT(*) FROM pg_indexes...`)
- [ ] RLS policies enabled (check: `SELECT relrowsecurity FROM pg_class...`)
- [ ] API route `/api/admin/licenses` returns 200 OK
- [ ] License creation via API creates database row
- [ ] License validation creates audit log entry
- [ ] No related errors in Cloudflare Worker logs (`npx wrangler tail --name sophia-ai-factory`)
- [ ] Production site loads without errors

---

## Contact & Support

- **Migration Plan:** `plans/260306-0952-raas-redis-supabase-migration/plan.md`
- **SQL Schema:** historical artifact `docs/migrations/raas-licenses-schema.sql` (not present in current repo)
- **Migration Guide:** `docs/migrations/REDIS_TO_SUPABASE.md`
- **Code Review:** `plans/260306-0952-raas-redis-supabase-migration/reports/code-reviewer-260306-1014-migration-review.md`

**Escalation:** Contact engineering team if issues persist after following troubleshooting steps.

---

## Appendix: Quick Reference Commands

```bash
# Link project
npx supabase link --project-ref abcdefghijklmnop

# Get database URL
npx supabase db url

# Execute SQL file
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql

# Count rows
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_licenses;"

# View indexes
psql "$(npx supabase db url)" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'raas_licenses';"

# View RLS policies
psql "$(npx supabase db url)" -c "SELECT policyname FROM pg_policies WHERE tablename = 'raas_licenses';"

# Test connection
psql "$(npx supabase db url)" -c "SELECT 1;"
```
