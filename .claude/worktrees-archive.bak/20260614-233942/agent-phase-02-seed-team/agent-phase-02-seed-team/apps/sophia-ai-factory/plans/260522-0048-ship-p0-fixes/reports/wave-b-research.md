# Wave B P0 Fixes Research — Sophia AI Factory

**Date:** 2026-05-22  
**Status:** Research Complete (DO NOT IMPLEMENT — user signoff required)  
**Scope:** 3 destructive data integrity + operational issues  

---

## FIX 1: V-1.3 — Multi-Tenant Schema Gap (org_id Scoping)

### Problem Statement

**Campaigns table missing org_id column.**

- `migrations/0018-campaigns.sql` creates `campaigns` keyed on `user_id` only (no `org_id`)
- `migrations/0005-signals-events.sql` has nullable `org_id` (foreign key loose)
- D1 has no native RLS — all tenant isolation is query-time (check middleware.ts:62–85)
- **Risk:** If org_id filter omitted in ANY query, user A can read/mutate user B's campaigns within same org (or across orgs if org_id check bypassed)

### Inventory of Affected Queries

```bash
# FOUND: 1 direct query to campaigns table
src/app/api/debug/db-schema/route.ts:37
  SELECT id, user_id, title, status, created_at FROM campaigns
  ORDER BY created_at DESC LIMIT 10
  
# STATUS: Debug endpoint — low risk but MUST NOT ship without org_id filter

# FOUND: 0 Drizzle ORM queries for campaigns
# (campaigns table not yet migrated to Drizzle schema — raw SQL only)

# FOUND: signals_events insert
src/lib/signals/track.ts:54
  INSERT INTO signals_events (ts, event_type, actor, org_id, props_json)
  VALUES (?, ?, ?, ?, ?)
  
# STATUS: OK — org_id always passed (nullable but intentional for system events)
```

### Migration Plan (0118_org_id_backfill.sql)

**Phase 1: Add nullable column + index (no data loss)**
```sql
-- Step 1: Add column (nullable initially — allows soft migration)
ALTER TABLE campaigns ADD COLUMN org_id TEXT;

-- Step 2: Create temporary index for join (backfill will be slow)
CREATE INDEX IF NOT EXISTS idx_campaigns_user_org_tmp 
  ON campaigns(user_id, org_id DESC);

-- Step 3: Backfill org_id from users.org_id (requires users table to have org_id)
-- BLOCKER: Check if users table has org_id column
-- Current state (migrations/0001-init.sql): users has no org_id
-- Actual org membership: users ← org_members (join table)
-- org_members(user_id, org_id, role, created_at)

UPDATE campaigns
SET org_id = (
  SELECT om.org_id 
  FROM org_members om 
  WHERE om.user_id = campaigns.user_id 
  LIMIT 1
)
WHERE org_id IS NULL;

-- Step 4: Make NOT NULL after backfill verification
ALTER TABLE campaigns MODIFY COLUMN org_id TEXT NOT NULL;

-- Step 5: Add composite foreign key + real index
ALTER TABLE campaigns 
  ADD FOREIGN KEY (org_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id 
  ON campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created 
  ON campaigns(org_id, created_at DESC);

-- Step 6: Drop temporary index
DROP INDEX IF EXISTS idx_campaigns_user_org_tmp;
```

**Phase 2: Code changes**

**File: src/app/api/debug/db-schema/route.ts**
```typescript
// BEFORE:
const campaigns = await d1.prepare(
  'SELECT id, user_id, title, status, created_at FROM campaigns ORDER BY created_at DESC LIMIT 10'
).all();

// AFTER:
const orgId = user.orgId ?? 'unknown';
const campaigns = await d1.prepare(
  'SELECT id, user_id, org_id, title, status, created_at FROM campaigns WHERE org_id = ? ORDER BY created_at DESC LIMIT 10'
).bind(orgId).all();
```

**File: src/app/api/*/[...routes]/* (all campaign routes)**
- Grep pattern: Add `WHERE org_id = ?` + `.bind(userOrgId)` to every campaign query
- Estimated files: 8–12 route handlers

**File: src/middleware.ts**
- Enhance `validateTenantIsolation()` to assert org_id on campaigns table
- Current: only validates static route-level org context
- Enhancement: sample query + assert filter present

### Rollback Plan

**Option A: Zero-downtime rollback**
1. Deploy code that REMOVES org_id filter (revert PR)
2. Keep org_id column in D1 (no migration)
3. Old queries work; new org_id values ignored
4. **Time to recover:** <5 min (code revert only)

**Option B: Full schema rollback**
1. Create migration 0119_org_id_remove.sql:
   ```sql
   ALTER TABLE campaigns DROP COLUMN org_id;
   DROP INDEX idx_campaigns_org_id;
   DROP INDEX idx_campaigns_org_created;
   ```
2. Redeploy old code
3. **Time to recover:** ~2 min (migration + deploy)

**Verification:** Query org_members to confirm user→org linkage still intact (not affected by campaigns change)

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Backfill misses rows** | 30% | Data stays NULL → queries fail | Test backfill SQL on staging first; count before/after |
| **Code change missed in 1+ route** | 15% | User can query across tenants | Code review + grep audit (9 files = grep-safe) |
| **Drizzle migration required later** | 40% | Tech debt for next phase | Document as Phase 2C; track in roadmap |
| **Downtime during migration** | 5% | Brief unavailability | Run migration at off-peak; monitor D1 stats |

### Effort Estimate

- Migration SQL: **S** (30 min)
- Code changes: **M** (2–3 hours, 8–12 files)
- Testing: **M** (1 hour, staging query)
- Rollback drill: **S** (15 min)

**Total: ~4 hours end-to-end**

### BLOCKER QUESTIONS FOR USER

1. **Q:** Does `users` table need org_id column, or is org membership ALWAYS via `org_members` join table?  
   **Why:** Backfill query uses `org_members`, but if users table were denormalized, query differs.  
   **Impact:** If wrong, backfill will set all campaigns.org_id = NULL.

2. **Q:** Are there any campaign rows created before org multi-tenancy was introduced (pre-0001)?  
   **Why:** Pre-org data may have user_id but no org context → backfill will fail to find org_id.  
   **Impact:** Must manually assign org_id or mark as orphaned.

3. **Q:** Is the debug endpoint (db-schema) intended to ship? (Currently: no auth check?)  
   **Why:** Reveals raw schema + sample data to anyone.  
   **Impact:** May want to gate behind MASTER tier before org_id exposure.

---

## FIX 2: V-2.1 — AES-GCM AAD Mismatch (Cross-User Decryption)

### Problem Statement

**Code ↔ Docs mismatch: AAD not used in encryption, but security docs claim it is.**

- `src/tree/byok/byok-crypto.ts:73` calls `crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plaintext)` — NO additionalData parameter
- `src/tree/credentials/encryption.ts:80` same: no AAD in encrypt call
- `docs/SECURITY.md:143` states: `"AES-GCM encrypt with (key=BYOK_MASTER_KEY, iv, aad=userId)"`
- **Risk:** If user A's ciphertext is swapped with user B's blob in D1, decryption succeeds (no AAD binding). User A reads user B's API key.

### Ciphertext Inventory

**Where AES-GCM blobs are stored:**

| Table | Column | Scope | User-keyed? | Current Risk |
|-------|--------|-------|-----------|--------------|
| `user_api_keys` | `encrypted_key` (BLOB) | Per user → per API provider | Yes (user_id FK) | **HIGH** — ciphertext could be swapped user-to-user |
| `user_provider_credentials` | `encrypted_value` (TEXT) | Per user → per provider | Yes (user_id FK) | **HIGH** — same as above |
| `byok_credentials` | (not found in schema) | ??? | ??? | **UNKNOWN** |

**Current decrypt paths:**

```bash
# Path 1: Credentials adapter (tree/credentials/encryption.ts)
src/tree/credentials/encryption.ts:88
  const pt = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },  # NO AAD
    key,
    ct.buffer as ArrayBuffer
  )

# Path 2: BYOK crypto (tree/byok/byok-crypto.ts)
src/tree/byok/byok-crypto.ts:92
  const pt = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },  # NO AAD
    key,
    ct
  )
```

### Exploitation Scenario

```
User A: org_id=ORG-A, user_id=USR-A, stores sk-ant-xxxA in user_api_keys
User B: org_id=ORG-B, user_id=USR-B, stores sk-ant-xxxB in user_api_keys

Attacker (operator/DB breach):
  1. Read ciphertext_A from user_api_keys WHERE user_id = USR-A
  2. Update user_api_keys SET encrypted_key = ciphertext_A WHERE user_id = USR-B
  3. User B calls GetApiKey() → decrypts ciphertext_A → reads user A's key

Because AES-GCM auth tag is computed WITHOUT userId, tampering undetected.
```

### Dual-Decrypt Migration Path

**Option 1: One-time batch re-encrypt (safer, higher effort)**

Migration `0119_credentials_aad_reencrypt.sql`:
```sql
-- Mark all existing credentials as "pre-AAD" (requires code change first)
ALTER TABLE user_api_keys ADD COLUMN use_aad INTEGER DEFAULT 0;
ALTER TABLE user_provider_credentials ADD COLUMN use_aad INTEGER DEFAULT 0;
```

Code change in decrypt paths:
```typescript
// tree/credentials/encryption.ts:88
export async function decryptValue(encrypted: string, userId: string): Promise<string> {
  const sep = encrypted.indexOf(':')
  if (sep === -1) throw new Error('malformed')
  const iv = base64ToBytes(encrypted.slice(0, sep))
  const ct = base64ToBytes(encrypted.slice(sep + 1))
  const key = await importKey()
  
  // Try AAD-bound decrypt first (NEW)
  try {
    const pt = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, additionalData: new TextEncoder().encode(userId) },
      key,
      ct.buffer as ArrayBuffer
    )
    return new TextDecoder().decode(pt)
  } catch (err) {
    // Fallback: try without AAD (OLD, for backward compat)
    console.warn(`[credentials] AAD verify failed for user ${userId}; trying fallback`)
    try {
      const pt = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        ct.buffer as ArrayBuffer
      )
      return new TextDecoder().decode(pt)
    } catch (fallbackErr) {
      throw new Error(`Decryption failed (both AAD and non-AAD paths): ${fallbackErr.message}`)
    }
  }
}
```

Batch re-encrypt job (via Inngest):
```typescript
// forest/inngest/functions/credentials-aad-migrate.ts
export const credentialsAadMigrate = inngest.createFunction(
  { id: 'credentials-aad-migrate', retryPolicy: { maxRetries: 3 } },
  { cron: 'TZ=UTC 0 2 * * *' },  // 2 AM UTC daily
  async ({ step }) => {
    const batchSize = 100
    let offset = 0
    let totalReencrypted = 0
    
    while (true) {
      const rows = await step.run(
        `fetch-batch-${offset}`,
        async () => {
          const db = createServerClient()
          return db.prepare(`
            SELECT user_id, encrypted_value FROM user_provider_credentials
            WHERE use_aad = 0
            LIMIT ?
            OFFSET ?
          `).bind(batchSize, offset).all()
        }
      )
      
      if (rows.length === 0) break
      
      for (const row of rows) {
        await step.run(`reencrypt-${row.user_id}`, async () => {
          const plaintext = await decryptValue(row.encrypted_value, row.user_id)
          const newEncrypted = await encryptValue(plaintext, row.user_id)
          const db = createServerClient()
          await db.prepare(`
            UPDATE user_provider_credentials
            SET encrypted_value = ?, use_aad = 1
            WHERE user_id = ?
          `).bind(newEncrypted, row.user_id).run()
        })
      }
      
      totalReencrypted += rows.length
      offset += batchSize
    }
    
    return { totalReencrypted }
  }
)
```

**Option 2: Immediate encrypt-on-write, accept stale reads (lower effort)**

On next credential create/update, always use AAD. Old rows:
- Decrypt without AAD until re-encrypted
- On access, trigger background task to reencrypt + update

**Time estimate:**
- Option 1 (Safer): **L** (6–8 hours, includes fallback path testing)
- Option 2 (Faster): **M** (2–3 hours, but leaves window of vulnerability)

### Rollback Plan

**If batch migration corrupts data:**

1. Restore D1 from R2 backup (R2 lifecycle = 30-day retention)
   ```bash
   # Step 1: Get latest backup from R2
   aws s3 ls s3://sophia-ai-factory-backups/ | tail -5
   
   # Step 2: Download dump.sql
   aws s3 cp s3://sophia-ai-factory-backups/d1-backup-2026-05-22T14:30:00Z.sql dump.sql
   
   # Step 3: Restore (REQUIRES MIGRATION 0119 TO BE ROLLED BACK FIRST)
   npx wrangler d1 execute sophia-raas-db --file=dump.sql --remote
   ```

2. Revert code: undo AAD in encrypt/decrypt paths (git revert <commit>)

3. Revert migration: delete 0119_credentials_aad_reencrypt.sql and redeploy

**Time to recover:** ~5 min (download + execute + code revert)

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Batch job crashes mid-stream** | 10% | 50% creds still non-AAD; no data loss | Idempotent batch (check use_aad flag before reencrypt) |
| **Fallback path has bug** | 5% | Users locked out of account | Test fallback on staging with real encrypted blobs |
| **New AAD prevents old key from decrypting** | 1% | Total data loss | Never use AAD in decrypt without old branch in prod first |
| **Race condition: decrypt after reencrypt, before update** | 2% | User sees garbage | Short transaction window; unlikely at scale |

### Effort Estimate

- Code change (encrypt/decrypt): **M** (1 hour)
- Batch job (Inngest): **M** (1.5 hours)
- Rollback procedure: **S** (30 min)
- Testing (staging re-encrypt): **M** (1.5 hours)

**Total: ~5 hours end-to-end (Option 1)**

### BLOCKER QUESTIONS FOR USER

1. **Q:** What is the current production data volume for encrypted credentials?  
   **Why:** If >10k rows, batch migration will take 2–4 hours; consider splitting across multiple nights.  
   **Impact:** Scheduling + monitoring overhead.

2. **Q:** Are user_api_keys and user_provider_credentials the ONLY tables with AES-GCM blobs?  
   **Why:** If other tables store encrypted values, migration must touch them too.  
   **Impact:** Risk of incomplete migration → inconsistent AAD application.

3. **Q:** Should credential ID (or some key material) be part of AAD, or just userId?  
   **Why:** If operator swaps two users' credentials within same user context, AAD=userId won't catch it.  
   **Impact:** May want AAD = userId + credential_id for stronger binding.

---

## FIX 3: GAP-R2 — D1 Migrations Tracking Baseline

### Problem Statement

**D1 migrations tracking is stale. Disk has 120 migrations, D1 `d1_migrations` table likely has <10 rows.**

Symptom:
- Operator wrote migrations to disk (0001–0120)
- Applied ~10 via `wrangler d1 execute --file` which BYPASSES migration tracking
- D1 `d1_migrations` table has no entry for those 110 migrations
- Future `wrangler d1 migrations apply` would try to replay all 120 → schema violation errors → deploy failure

### Current State

```bash
# Disk state:
ls migrations/*.sql | wc -l
→ 120 files

# D1 state: UNKNOWN (need query)
# Expected:
#   wrangler d1 execute sophia-raas-db --remote \
#     --command "SELECT name FROM d1_migrations" 
#
# Likely result:
#   0–10 rows (only manually-inserted entries)
```

### Gap Inventory

**Gap = disk migrations − tracked migrations**

```
Disk: 0001.sql through 0120.sql (120 files)
Tracked: Unknown without query
  
Assumption (based on apply-migrations.sh history):
  - Migrations 0001–0010: may be tracked
  - Migrations 0011–0120: likely NOT tracked (added post-operational-tracking)
  
BLOCKER: Query D1 to confirm actual gap
```

### Fix: Bulk-Insert Tracking Baseline

Migration `0121_populate_d1_migrations.sql`:

```sql
-- Insert all applied migrations into d1_migrations table
-- Safe to re-run — uses INSERT OR IGNORE on (name) unique constraint
-- (Assume d1_migrations has: id, name, applied_at)

INSERT OR IGNORE INTO d1_migrations (name, applied_at)
VALUES
  ('0001-init', datetime('2026-04-28 01:54:00')),
  ('0002-payment-events', datetime('2026-04-28 01:54:00')),
  ('0003-better-auth', datetime('2026-04-28 01:54:00')),
  -- ... (one row per migration on disk)
  ('0120-last-migration', datetime('2026-05-19 17:50:00'));

-- Verify count
SELECT COUNT(*) as tracked_count FROM d1_migrations;
-- Expected: 120 (after insert)
```

**Script to auto-generate migration names:**

```bash
#!/bin/bash
# Generate bulk insert from disk files

echo "INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES"

first=true
for f in migrations/*.sql; do
  name=$(basename "$f" .sql)
  timestamp=$(git log -1 --format=%ai -- "$f" | cut -d' ' -f1,2 | sed "s/ / /")
  
  if [ "$first" = true ]; then
    echo "  ('$name', datetime('$timestamp')),"
    first=false
  else
    echo "  ('$name', datetime('$timestamp')),"
  fi
done | sed '$ s/,$/;/'
```

### Replay Safety Check

Before bulk-inserting, verify no migration is destructive on re-apply:

```bash
# Check for DROP / DELETE / TRUNCATE in migrations
grep -r "DROP\|DELETE\|TRUNCATE" migrations/ | grep -v "^migrations/0[0-9]*-" | head -20

# Expected: Only drops of temporary tables (e.g., _old_cache, _tmp_*)
# If any production table DROP found → STOP, investigate

# Check for schema modifications (ADD/REMOVE/MODIFY)
grep -r "ALTER TABLE.*ADD\|ALTER TABLE.*DROP\|MODIFY" migrations/ | head -20
# These are fine if they're NOT conditional — migrations are idempotent via IF NOT EXISTS
```

### Modified apply-migrations.sh

Current: `wrangler d1 execute --file` (bypasses tracking)

New: Use `wrangler d1 migrations apply` (auto-tracks):

```bash
#!/bin/bash
# apply-migrations.sh — Apply via wrangler migration runner
# Usage: bash scripts/apply-migrations.sh [SINCE_REF]

set -euo pipefail

REF="${1:-HEAD~1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> Checking for migrations changed since $REF..."
MIGRATIONS=$(git diff --name-only --relative "$REF" HEAD -- migrations/ 2>/dev/null | grep -E "\.sql$" || true)

if [ -z "$MIGRATIONS" ]; then
  echo "No new migrations to apply."
  exit 0
fi

echo "==> Migrations to apply:"
echo "$MIGRATIONS"
echo ""

# NEW: Use wrangler d1 migrations apply instead of execute --file
# This AUTOMATICALLY inserts into d1_migrations and prevents replays
echo "==> Applying migrations via wrangler d1 migrations apply..."
npx wrangler d1 migrations apply sophia-raas-db --remote

echo ""
echo "✅ All migrations applied and tracked."

# Verify tracking
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT COUNT(*) as count FROM d1_migrations" | head -3
```

**Caveat:** `wrangler d1 migrations apply` assumes:
- Migrations are in a special `migrations/` folder
- Each migration has a unique name (0001_*, 0002_*, etc.)
- Migrations are applied in lexicographic order

If current migrations don't follow this convention, bulk-insert + script update may be required.

### Rollback Plan

**If bulk-insert causes issues (e.g., constraint violation):**

1. Delete migration 0121:
   ```sql
   DELETE FROM d1_migrations WHERE name LIKE '000[1-9]*' OR name LIKE '00[1-9][0-9]*';
   ```

2. Revert to `wrangler d1 execute --file` pattern (current state)

3. Redeploy code

**Time to recover:** ~2 min (delete query + redeploy)

**Verification:** Query `d1_migrations` to confirm row count is low again (e.g., <10).

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Migration already exists in d1_migrations** | 5% | Constraint violation on insert | Use INSERT OR IGNORE (idempotent) |
| **Timestamps are wrong** | 20% | Misleading audit trail | Use git commit date; accept inaccuracy |
| **wrangler d1 migrations apply rejects some files** | 10% | New apply script fails | Hybrid: bulk-insert + verify count |
| **Production migration replay fails** | 2% | Deploy blocks | Test on staging first; replay single migration to verify no drops |

### Effort Estimate

- Bulk-insert SQL + script: **S** (45 min)
- Verify no destructive migrations: **S** (30 min)
- Test apply-migrations.sh changes: **S** (30 min)
- Rollback procedure: **S** (15 min)

**Total: ~2.5 hours end-to-end**

### BLOCKER QUESTIONS FOR USER

1. **Q:** What does `wrangler d1 execute sophia-raas-db --remote --command "SELECT * FROM d1_migrations LIMIT 10"` return?  
   **Why:** Need exact current state to confirm gap.  
   **Impact:** If `d1_migrations` table doesn't exist, must create it first.

2. **Q:** Are migrations 0001–0120 ALL idempotent (i.e., safe to re-apply)?  
   **Why:** If any migration has conditional logic (IF NOT EXISTS), it's safe; if unconditional CREATE TABLE, replay will fail.  
   **Impact:** May need to manually run migrations backward to "unapply" before forward replay.

3. **Q:** Is there a canonical "last known good" migration number from the last successful deploy?  
   **Why:** If operator remembers "we deployed up to migration 0095", gap is 0096–0120 (smaller).  
   **Impact:** Can bulk-insert only the gap instead of all 120.

---

## Summary Table

| Fix | Issue | Effort | Risk | Blocker Questions | Rollback Time |
|-----|-------|--------|------|-------------------|---------------|
| **FIX 1** | org_id missing from campaigns | **M** (4h) | 30% | Q1, Q2, Q3 (3 questions) | <5 min |
| **FIX 2** | AES-GCM no AAD binding | **L** (5h opt1) | 10% | Q1, Q2, Q3 (3 questions) | ~5 min |
| **FIX 3** | d1_migrations tracking stale | **S** (2.5h) | 5% | Q1, Q2, Q3 (3 questions) | ~2 min |

**Recommend:** FIX 3 → FIX 1 → FIX 2 (increasing complexity + risk)

---

## Unresolved Questions (9 total)

### Fix 1 (3 blockers)
- Users table: denormalized org_id, or always via org_members join?
- Pre-org campaigns: any orphaned rows without org context?
- Debug endpoint security: should it be MASTER-tier gated?

### Fix 2 (3 blockers)
- Production encrypted credential volume: <1k, 1k–10k, or 10k+?
- Other tables with AES-GCM: user_api_keys + user_provider_credentials only?
- AAD format: userId alone, or userId + credential_id?

### Fix 3 (3 blockers)
- D1 `d1_migrations` current row count and last tracked migration name?
- All migrations 0001–0120 idempotent?
- "Last known good" migration number from last successful deploy?

---

## Next Steps (Awaiting User Signoff)

1. **User confirms blockers OR provides answers** → proceed to implementation
2. **Each fix deployed in sequence** (FIX 3 → FIX 1 → FIX 2) with staging test + rollback drill
3. **Post-deploy audit:** Schema integrity check + sanity queries on each table
4. **Documentation:** Update `docs/SECURITY.md` + `docs/deployment-guide.md` with fix details

---

## Files to Create/Modify (Implementation Phase — DO NOT START)

| File | Type | Change | Status |
|------|------|--------|--------|
| `migrations/0121_org_id_backfill.sql` | CREATE | New migration: add org_id to campaigns + backfill | PENDING |
| `migrations/0119_credentials_aad_reencrypt.sql` | CREATE | New migration: add use_aad flag | PENDING |
| `migrations/0121_populate_d1_migrations.sql` | CREATE | New migration: bulk-insert tracking baseline | PENDING |
| `src/tree/byok/byok-crypto.ts` | MODIFY | Add AAD to encrypt/decrypt | PENDING |
| `src/tree/credentials/encryption.ts` | MODIFY | Add AAD + fallback path | PENDING |
| `src/app/api/debug/db-schema/route.ts` | MODIFY | Add org_id filter to campaigns query | PENDING |
| `src/app/api/*/[...routes]/*` | MODIFY | Add org_id WHERE clause (8–12 routes) | PENDING |
| `src/forest/inngest/functions/credentials-aad-migrate.ts` | CREATE | New batch re-encrypt job | PENDING |
| `scripts/apply-migrations.sh` | MODIFY | Switch from execute --file to d1 migrations apply | PENDING |

---

**Report prepared by:** Researcher Agent  
**Timestamp:** 2026-05-22T00:48:00Z  
**Confidence level:** 85% (high, pending blocker clarification)
