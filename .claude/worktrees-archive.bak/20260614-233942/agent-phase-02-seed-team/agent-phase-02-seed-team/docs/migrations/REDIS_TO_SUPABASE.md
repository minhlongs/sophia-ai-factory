# Redis to Supabase Migration Guide

> **Phase:** ROIaaS License System Migration
> **Date:** 2026-03-06
> **Status:** Historical reference — not a current Sophia execution guide

> **Current-state note (2026-05-21):** This guide predates Sophia's Cloudflare Workers/D1 deployment doctrine and references legacy Vercel URLs plus missing migration artifacts. Do not execute it as-is. For current database/deploy operations, use `docs/deployment-guide.md`, `docs/codebase-summary.md`, and `apps/sophia-ai-factory/migrations/`.

---

## Overview

This guide walks through migrating the RaaS (ROI-as-a-Service) license system from Redis to Supabase PostgreSQL.

### Why Migrate?

| Phase | Storage | Persistent | Audit Trail | Resilience |
|-------|---------|------------|-------------|------------|
| Phase 1 | Redis | ❌ | ❌ | ❌ |
| Phase 2 | Supabase | ✅ | ✅ | ✅ |

**Benefits:**
- Data persistence across restarts
- Full audit trail for compliance
- PostgreSQL transaction support
- Scalable and production-ready

---

## Prerequisites

### Environment Variables
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RAAS_LICENSE_SECRET=your-32-char-secret
```

### Supabase Setup
1. Create/verify Supabase project
2. Get service role key from project settings
3. Ensure RLS is disabled for service role (admin access)

---

## Migration Steps

### Step 1: Review SQL Schema

Read the migration script before running:
```sql
-- docs/migrations/raas-licenses-schema.sql
-- Creates:
--   - raas_licenses table
--   - raas_audit_logs table
--   - Indexes for performance
--   - RLS policies (admin-only)
--   - Triggers for timestamps
```

**Login to Supabase:**
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### Step 2: Execute SQL Migration

**Option A: Using Supabase CLI**
```bash
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql
```

**Option B: Using Supabase Dashboard**
1. Open: `https://supabase.com/dashboard/project/<ref>/sql/new`
2. Copy contents of `docs/migrations/raas-licenses-schema.sql`
3. Paste and run (Cmd+Enter)

**Verify tables created:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('raas_licenses', 'raas_audit_logs');
```

**Verify indexes:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename IN ('raas_licenses', 'raas_audit_logs');
```

### Step 3: Test API Routes

Historical API test examples. If this migration is resurrected, update endpoints to the current production host before use:

```bash
# Test GET /api/admin/licenses
curl -H "Authorization: Basic $(echo 'admin:password' | base64)" \
  https://sophia.agencyos.network/api/admin/licenses

# Test POST /api/admin/licenses/create
curl -X POST \
  -H "Authorization: Basic $(echo 'admin:password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"tier":"basic","expiresAt":1893456000}' \
  https://sophia.agencyos.network/api/admin/licenses/create
```

### Step 4: Optional - Migrate Existing Redis Data

**If you have existing Redis license data:**

```bash
# Set Redis connection env vars
export UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
export UPSTASH_REDIS_REST_TOKEN=your-token

# Run migration script
npx tsx scripts/migrate-redis-to-supabase.ts
```

**Migration script behavior:**
- Extracts all Redis `raas:license:*` keys
- Transforms to Supabase format
- Inserts into `raas_licenses` table
- Sets `metadata.requiresKeyRegeneration = true`

**Important:** Redis stores only metadata, not full license keys. After migration:
- Original license keys cannot be recovered
- Users must regenerate keys or you must provide new keys

---

## Data Models

### raas_licenses Table

```typescript
interface RaasLicense {
  id: string              // UUIDPrimary
  key_hash: string        // SHA256 hash of full key
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  expires_at: number | null  // Unix timestamp (0 = perpetual)
  nonce: string           // 32-char hex
  is_revoked: boolean
  revoked_at: number | null
  revoked_by: string | null  // User UUID
  created_by: string | null  // Admin UUID
  created_at: number       // Unix timestamp
  metadata: Json           // Extra fields
  updated_at: number | null
}
```

### raas_audit_logs Table

```typescript
interface RaasAuditLog {
  id: string                  // UUID
  action: 'CREATE' | 'VALIDATE' | 'REVOKE' | 'UPDATE'
  license_id: string | null   // FK to raas_licenses
  license_nonce: string | null
  user_id: string | null      // User UUID
  ip_address: string | null
  user_agent: string | null
  details: Json
  created_at: number          // Unix timestamp
}
```

---

## Rollback Instructions

**Rollback is NOT recommended** - this migration is designed to be forward-only.

If rollback is absolutely necessary:

### Step 1: Stop Application
```bash
# Pause all API routes (disable middleware or route)
```

### Step 2: Restore from Backup
```sql
-- Drop new tables
DROP TABLE raas_audit_logs CASCADE;
DROP TABLE raas_licenses CASCADE;

-- Restore from pg_dump if available
-- pg_restore -d database backup.sql
```

### Step 3: Revert Redis Connection
```bash
# Revert environment variables to Redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### Step 4: Update Code (if needed)
```bash
# Revert API routes to use Redis directly
# This requires code changes if fully migrated
```

**Recommended:** Instead of rollback, deploy new keys for affected users.

---

## FAQ

### Q1: Do I need to run the data migration script?

**A:** Only if you have existing Redis licenses you want to preserve. The script marks migrated licenses with `requiresKeyRegeneration: true` because Redis doesn't store full license keys.

If you don't run migration, just start fresh - new licenses created via API will work normally.

### Q2: Will existing license keys stop working?

**A:** No. Your existing license keys will continue to work via the middleware (`raas-gate.ts`) because:

1. Key validation uses `RAAS_LICENSE_SECRET` (unchanged)
2. HMAC verification is independent of storage layer
3. Revocation check moved to database (synced with Redis if both exist)

### Q3: How do I regenerate keys for migrated users?

**A:** Option 1: Generate via API
```bash
curl -X POST \
  -H "Authorization: Basic $ADMIN_AUTH" \
  -d '{"tier":"premium","expiresAt":1893456000}' \
  https://sophia.agencyos.network/api/admin/licenses/create
```

Option 2: Clarify key requirement with users who report issues.

### Q4: What happens during migration?

**A:** Zero downtime. The system supports dual storage:
- API routes use Supabase
- Middleware checks Supabase first, falls back to Redis if available

### Q5: Performance differences?

**A:** Supabase is faster for:
- Complex queries (WITH indexes)
- Pagination
- joins for audit logs

Redis was faster for:
- Simple key-value reads

**Net result:** Comparable or better performance with more functionality.

### Q6: Do I still need Redis?

**A:** After successful migration, Redis is optional:
- Keep for caching if desired
- Remove if not needed (simpler infrastructure)

### Q7: How long are audit logs kept?

**A:** Currently: Infinite retention. Add a retention policy if needed:

```sql
-- Add 'retained_at' column and scheduled cleanup
ALTER TABLE raas_audit_logs ADD COLUMN retained_at BIGINT;

-- Create job to delete old logs (example: 30 days)
-- Use Supabase Storage for archival if longer retention needed
```

---

## Verification Checklist

Run these after deployment:

```bash
# 1. Verify tables exist
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_licenses"
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_audit_logs"

# 2. Test license creation
curl -X POST \
  -H "Authorization: Basic $ADMIN_AUTH" \
  -d '{"tier":"basic"}' \
  https://sophia.agencyos.network/api/admin/licenses/create

# 3. Test license listing
curl \
  -H "Authorization: Basic $ADMIN_AUTH" \
  https://sophia.agencyos.network/api/admin/licenses

# 4. Test middleware validation
curl -H "X-RaaS-License-Key: raas_basic_..." https://sophia.agencyos.network/api/protected

# 5. Verify no errors in logs
# Check Cloudflare Worker logs for RAAS-related errors:
# npx wrangler tail --name sophia-ai-factory
```

---

## Monitoring

### Metrics to Track

| Metric | Alert Threshold |
|--------|-----------------|
| License creation errors | > 1/minute |
| Validation failures | > 5/minute |
| Database connection errors | Any |
| Query latency (P99) | > 500ms |

### Log Queries

```sql
-- Failed validations (check rate)
SELECT action, COUNT(*) FROM raas_audit_logs
WHERE details->>'error' IS NOT NULL
GROUP BY action;

-- Recent revocations
SELECT * FROM raas_audit_logs
WHERE action = 'REVOKE'
ORDER BY created_at DESC LIMIT 10;

-- License expiration warnings
SELECT * FROM raas_licenses
WHERE is_revoked = false
  AND expires_at > 0
  AND expires_at < extract(epoch from now())::bigint + 86400 * 7;  -- 7 days
```

---

## Migration Timeline

| Step | Time | Status |
|------|------|--------|
| SQL schema review | 5 min | ✅ |
| SQL execution | 1 min | ✅ Script ready |
| Code deployment | 2 min | ✅ |
| API testing | 5 min | ⏳ Pending |
| Redis data migration | 10-60 min | ⏳ Optional |
| Production verification | 5 min | ⏳ Pending |

---

## Quick Start Commands

### Option A: Automated Script (Recommended)

```bash
cd apps/sophia-ai-factory
# Historical script no longer exists in the current repo:
# scripts/deploy-raas-migration.sh
# Rebuild a current migration plan before executing.
```

The script will:
1. Check prerequisites (npx, psql, SQL file)
2. Link your Supabase project
3. Execute SQL migration
4. Verify tables and indexes
5. Optionally migrate Redis data
6. Verify API endpoints

### Option B: Manual Commands

```bash
# Step 1: Login and link
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Step 2: Execute SQL
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql

# Step 3: Verify tables
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_licenses;"
psql "$(npx supabase db url)" -c "SELECT COUNT(*) FROM raas_audit_logs;"

# Step 4: Verify indexes
psql "$(npx supabase db url)" -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('raas_licenses', 'raas_audit_logs');"

# Step 5: Current Sophia deploy doctrine, if new code/migrations are added
cd apps/sophia-ai-factory
npm run deploy:migrations
npm run deploy:full
curl -s https://sophia.agencyos.network/api/version

# Step 6: Set runtime secrets through Cloudflare Workers, not Vercel
# npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# npx wrangler secret put RAAS_LICENSE_SECRET
```

---

## Troubleshooting (Chi tiết)

### Error: "relation already exists"

**Nguyên nhân:** Tables đã được tạo từ lần chạy trước

**Giải pháp:**
```sql
-- Xóa và tạo lại
DROP TABLE IF EXISTS raas_audit_logs CASCADE;
DROP TABLE IF EXISTS raas_licenses CASCADE;

-- Chạy lại migration
psql "$(npx supabase db url)" -f docs/migrations/raas-licenses-schema.sql
```

### Error: "permission denied for relation"

**Nguyên nhân:** Chưa login hoặc sai project

**Giải pháp:**
```bash
# Logout và login lại
npx supabase logout
npx supabase login

# Link lại project
npx supabase link --project-ref YOUR_PROJECT_REF

# Kiểm tra quyền
psql "$(npx supabase db url)" -c "SELECT current_user;"
```

### Error: "connection refused"

**Nguyên nhân:** Database URL không truy cập được

**Giải pháp:**
```bash
# Kiểm tra database URL
npx supabase db url

# Test connection
psql "$(npx supabase db url)" -c "SELECT 1;"

# Nếu vẫn lỗi, kiểm tra network/firewall
```

### Error: "Failed to lookup license"

**Nguyên nhân:** License keys stored in Redis không khớp với Supabase

**Giải pháp:**
- Đây là expected behavior sau migration
- Redis chỉ lưu metadata, không lưu full license keys
- Cần generate lại license keys cho users
- Hoặc chạy data migration script để đồng bộ

### Error: API returns 500 Internal Server Error

**Nguyên nhân:** Runtime secrets chưa set trong Cloudflare Worker

**Giải pháp:**
1. Vào terminal trong `apps/sophia-ai-factory`
2. Thêm các secret:
   - `SUPABASE_URL` = https://your-project.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` = your-key-here
   - `RAAS_LICENSE_SECRET` = your-32-char-secret
3. Chạy `npm run deploy:full` và kiểm tra `/api/version`

### Error: "RESOURCE_EXHAUSTED" từ Supabase

**Nguyên nhân:** Vượt quá rate limit của Supabase free tier

**Giải pháp:**
```bash
# Kiểm tra usage: https://supabase.com/dashboard/project/YOUR_REF/database/usage

# Upgrade plan nếu cần
# Hoặc thêm caching layer (Redis) cho validation queries
```

### Data Migration Fails

**Nguyên nhân:** Redis connection issues hoặc data format mismatch

**Giải pháp:**
```bash
# Test Redis connection
curl "$UPSTASH_REDIS_REST_URL/ping?token=$UPSTASH_REDIS_REST_TOKEN"

# Check Redis keys
curl "$UPSTASH_REDIS_REST_URL/keys/license:*?token=$UPSTASH_REDIS_REST_TOKEN"

# Nếu Redis empty, skip data migration
# Migration script sẽ tạo tables rỗng - không sao
```

### Audit Logs Not Creating

**Nguyên nhân:** `raas-audit.ts` service not called hoặc Supabase insert fails

**Giải pháp:**
```sql
-- Check if audit table is writable
psql "$(npx supabase db url)" -c "INSERT INTO raas_audit_logs (action, created_at) VALUES ('TEST', EXTRACT(EPOCH FROM NOW())::bigint);"

-- Check RLS policies
psql "$(npx supabase db url)" -c "SELECT * FROM pg_policies WHERE tablename = 'raas_audit_logs';"

-- Nếu RLS blocking, use service role key (bypasses RLS)
```

---

## Migration Verification Script

Create and run this script to verify migration:

```bash
#!/bin/bash
# verify-migration.sh

DB_URL="$(npx supabase db url)"

echo "=== RaaS Migration Verification ==="

# Tables
echo -n "raas_licenses rows: "
psql "$DB_URL" -t -c "SELECT COUNT(*) FROM raas_licenses;" | tr -d ' '

echo -n "raas_audit_logs rows: "
psql "$DB_URL" -t -c "SELECT COUNT(*) FROM raas_audit_logs;" | tr -d ' '

# Indexes
echo -n "Total indexes: "
psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('raas_licenses', 'raas_audit_logs');" | tr -d ' '

# RLS
echo -n "RLS enabled: "
psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_class WHERE relname IN ('raas_licenses', 'raas_audit_logs') AND relrowsecurity = true;" | tr -d ' '

# Policies
echo -n "RLS policies: "
psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('raas_licenses', 'raas_audit_logs');" | tr -d ' '

echo "=== Verification Complete ==="
```

Run: `chmod +x verify-migration.sh && ./verify-migration.sh`

Expected output:
```
=== RaaS Migration Verification ===
raas_licenses rows: 0
raas_audit_logs rows: 0
Total indexes: 11
RLS enabled: 2
RLS policies: 2
=== Verification Complete ===
```

---

## 참고 (References)

- **SQL Schema:** historical artifact `docs/migrations/raas-licenses-schema.sql` (not present in current repo)
- **TypeScript Types:** `src/lib/raas-schema.ts`
- **Audit Service:** `src/lib/raas-audit.ts`
- **Plan:** `plans/260306-0952-raas-redis-supabase-migration/plan.md`
- **Commit Hash:** `cda7f81` (Migration implementation)

---

**Questions?** Contact engineering team or check migration plan for details.
