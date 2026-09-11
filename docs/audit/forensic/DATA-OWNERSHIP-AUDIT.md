# FORENSIC AUDIT: DATABASE, MIGRATIONS & R2 DATA OWNERSHIP

**Target Platform:** Sophia AI Factory (apps/sophia-ai-factory)  
**Date:** 2026-09-10  
**Status:** COMPLETED  
**Auditor:** Senior SRE / Infrastructure Security Forensic Specialist (Lane D)  
**Evidence Level:** Forensic Source Code Analysis & Trace Proof (Zero Assumptions)

---

## 1. Executive Summary

A forensic audit of Cloudflare D1 migrations (`migrations/`), database access patterns across `src/`, and Cloudflare R2 storage bindings (`VIDEO_BUCKET`, `AUDIT_BUCKET`, `BACKUPS_BUCKET`) was performed to evaluate database integrity, tenant isolation, and data ownership lifecycles.

### Key Forensic Findings:
1. **HIGH RISK (P1 — Broken Migration Tracking in Deployment Automation):**  
   The script `scripts/apply-migrations.sh:103-108` queries `d1_migrations` via `SELECT COUNT(*) FROM d1_migrations WHERE name = ...` to determine if a migration has executed. However, `apply-migrations.sh` **never inserts newly applied migrations into `d1_migrations`**. The tracking table was populated only once up to migration 0117 via `0118_d1_migrations_baseline.sql`. Every migration from 0119 through 0272 is treated as unapplied by the script, relying solely on SQL error suppression (`grep -q "already exists"`) during automated deployments.
2. **HIGH RISK (P1 — Schema Non-Idempotency):**  
   Multiple migrations use raw `CREATE TABLE` without `IF NOT EXISTS` (e.g. `0201-memory-consolidation.sql`, `0078-webhooks.sql`, `0047-user-purchases-underpaid.sql`). Because D1 does not support transactional migrations, if a re-execution occurs, SQLite throws `table already exists`, aborting batch migration runs.
3. **HIGH RISK (P1 — Cascade Account Deletion Table Name Mismatch):**  
   In `src/land/account/cascade-delete.ts:76-86`, `fetchOrgId()` queries `SELECT org_id FROM user WHERE id = ? LIMIT 1`. However, the Better Auth schema in D1 defines the table as `users` (or `user` depending on migration version). If `fetchOrgId` throws or returns null, lines 207-209 set `bindValue = ''` (empty string) for all `org_id`-scoped tables. As a result, when an organization owner deletes their account, dependent records in `org_members`, `subscriptions`, `org_balances`, `missions`, `transactions`, and `raas_api_keys` **fail to delete**, leaving permanent orphaned tenant data in D1.
4. **MODERATE RISK (P2 — Orphaned R2 Storage on Deletion Failure):**  
   In `src/land/account/cascade-delete.ts:163-183`, `deleteR2Objects()` catches R2 deletion errors, logs them, and continues. No retry queue, tombstone record, or dead-letter queue is created for failed deletions. If Cloudflare R2 experiences transient 5xx errors during account teardown, raw video/audio media files remain permanently orphaned in R2 storage with no owner in D1.
5. **VERIFIED CONTROLS (Green):**  
   - Direct streaming route `GET /api/videos/[id]/url` strictly enforces ownership via `authorizeVideoAccess()` (`videos.user_id === user.id`) and verifies refund revocation (`access_revoked === 0`).
   - R2 object keys use cryptographic UUIDv4 identifiers, preventing sequential ID enumeration attacks.

---

## 2. D1 Migration Forensics (Phase 8)

### 2.1 Migration Inventory & Naming Inconsistency
A total of **238 migration files** exist under `apps/sophia-ai-factory/migrations/`.
- **Inconsistent Naming Convention:**
  - Migrations 0001 through 0253 use hyphenated prefixes (e.g., `0001-init.sql`, `0201-memory-consolidation.sql`).
  - Migrations 0254 through 0272 use underscore prefixes (e.g., `0254_signals_events.sql`, `0272_founder_bootstrap.sql`).
  - Lexicographical sorting in bash scripts (`sort -V`) handles numeric ordering correctly, but mixed naming syntax increases risk of execution order bugs across diverse build platforms.

### 2.2 Broken Migration Tracking (`scripts/apply-migrations.sh`)

In `apps/sophia-ai-factory/scripts/apply-migrations.sh:103-125`:
```bash
# Check tracking table if it exists
if [ "$TABLE_EXISTS" -gt 0 ]; then
  APPLIED=$(npx wrangler d1 execute "$DB_NAME" $WRANGLER_FLAGS \
    --command="SELECT count(*) as count FROM d1_migrations WHERE name = '$MIGRATION_NAME';" \
    2>&1 | grep -oE '"count":\s*[0-9]+' | grep -oE '[0-9]+' | head -1)

  if [ "$APPLIED" = "1" ]; then
    echo "  [SKIP] Already recorded in d1_migrations"
    continue
  fi
fi

# Apply migration
echo "  [APPLY] Executing $FILENAME..."
OUTPUT=$(npx wrangler d1 execute "$DB_NAME" $WRANGLER_FLAGS --file="$FILE" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "  [OK] Applied $FILENAME"
  # <-- CRITICAL DEFECT: NO INSERT INTO d1_migrations RECORDED HERE!
```
**Forensic Proof:**  
The script checks whether `$MIGRATION_NAME` is in `d1_migrations`. If not found, it runs `wrangler d1 execute --file="$FILE"`. Upon exit code 0, **it never executes `INSERT INTO d1_migrations (name, applied_at) VALUES (...)`**.
Only migrations up to `0117` exist in `d1_migrations` because they were hardcoded into `0118_d1_migrations_baseline.sql`. Consequently, every migration from `0119` through `0272` is permanently evaluated as `APPLIED=0` on every deployment.

### 2.3 Non-Idempotent Schema Migrations

SQLite lacks native transactional DDL and does not allow modifying existing constraints without table recreation. Several migrations lack `IF NOT EXISTS` guards:

1. `migrations/0201-memory-consolidation.sql:9`:
   ```sql
   CREATE TABLE conversation_summaries (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     ...
   ```
2. `migrations/0078-webhooks.sql:1`:
   ```sql
   CREATE TABLE webhook_endpoints (
     id TEXT PRIMARY KEY,
     ...
   ```
3. `migrations/0265_user_alerts_extend.sql:11`:
   ```sql
   CREATE TABLE user_alerts_new ( ... );
   INSERT INTO user_alerts_new SELECT ...;
   DROP TABLE user_alerts;
   ALTER TABLE user_alerts_new RENAME TO user_alerts;
   ```
**Risk:** If `apply-migrations.sh` re-runs `0201-memory-consolidation.sql`, SQLite fails immediately with:
`Error: table conversation_summaries already exists`.

---

## 3. Database Query Multi-Tenant Isolation

### 3.1 Cross-Tenant Data Leak Analysis
A search for raw SQL queries across `src/` was conducted to determine if tenant isolation (`user_id`, `org_id`, `tenant_id`) is strictly maintained.

#### Route Level Guards:
1. Public customer routes: Enforce `getCurrentUser()`.
2. Org-scoped operations (e.g. `src/land/creative-mission/actions.ts:136`, `240`, `306`):
   ```typescript
   const isMember = await db
     .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
     .bind(orgId, user.id)
     .first();
   if (!isMember) throw new Error('Unauthorized');
   ```
   **Verdict:** Properly enforces organization membership.

#### Flaw in Cascade Account Deletion (`cascade-delete.ts`):
In `src/land/account/cascade-delete.ts:76-86`:
```typescript
async function fetchOrgId(db: D1Database, userId: string): Promise<string | null> {
  try {
    const { results } = await db
      .prepare(`SELECT org_id FROM user WHERE id = ? LIMIT 1`)
      .bind(userId)
      .all<{ org_id: string | null }>();
    return results?.[0]?.org_id ?? null;
  } catch {
    return null;
  }
}
```
And in lines 207-210:
```typescript
case 'org_id':
  bindValue = orgId ?? '';
  break;
```
**Forensic Analysis:**
- In Better Auth migrations, the table name is `users` (plural) in standard D1 schema, while older migrations used `"user"`.
- If `fetchOrgId` throws due to table name resolution or schema mismatch, the `catch` block catches the exception and returns `null`.
- When `orgId` is null, `bindValue` defaults to `''` (empty string).
- The cascade delete runs `DELETE FROM subscriptions WHERE org_id = ''`, deleting 0 rows!
- The user's account row in `users` is deleted (`WHERE tenant_id = ?` or `WHERE id = ?`), but their organization, subscriptions, transactions, and API keys remain permanently orphaned in the database.

---

## 4. R2 Bucket Storage & Data Ownership (Phase 9)

### 4.1 R2 Bucket Bindings & Infrastructure

| Binding Name | Purpose | Access Policy |
|---|---|---|
| `VIDEO_BUCKET` | Stores raw generated video, audio, and visual assets | Private (accessed via Worker streaming route) |
| `AUDIT_BUCKET` | Stores JSONL append logs for security audit trails | Private (internal append-only) |
| `BACKUPS_BUCKET` | Stores daily automated D1 database dumps | Private (30-day lifecycle rotation) |
| `NEXT_INC_CACHE_R2_BUCKET` | OpenNext ISR / incremental cache bucket | Private (Cloudflare Worker runtime) |

### 4.2 Video Access Control & URL Guessability

#### Direct Streaming Flow:
In `src/land/video/publishing/video-access-control.ts:79-105`:
```typescript
export async function authorizeVideoAccess(
  videoId: string,
  userId: string,
): Promise<
  | { granted: true; access: VideoAccessGranted }
  | { denied: true; reason: VideoAccessDeniedReason }
> {
  const row = await getVideoAccessRow(videoId)

  if (!row) {
    return { denied: true, reason: 'not_found' }
  }

  if (row.user_id !== userId) {
    logger.error('[VideoAccessControl] Ownership mismatch', undefined, { videoId, userId })
    return { denied: true, reason: 'unauthorized' }
  }

  if (row.access_revoked !== 0) {
    logger.error('[VideoAccessControl] Access revoked — refund applied', undefined, { videoId, userId })
    return { denied: true, reason: 'revoked' }
  }

  if (!row.r2_key) {
    return { denied: true, reason: 'not_ready' }
  }
  ...
```
And in `src/app/api/videos/[id]/url/route.ts:70-72`:
```typescript
// If bucket has a public base URL, redirect — no streaming overhead needed
if (publicBaseUrl) {
  return NextResponse.redirect(`${publicBaseUrl}/${r2Key}`, { status: 302 })
}
```
**Forensic Findings on Authorization & Guessability:**
1. **Private Streaming (Default):** If `publicBaseUrl` is null, the Worker route streams bytes directly: `new Response(object.body, { status: 200, headers })`. The caller never receives the R2 object URL. Access is strictly authenticated (`getCurrentUser()`) and authorized (`row.user_id === user.id`).
2. **Public CDN Bypass Risk:** If an operator configures `R2_PUBLIC_BASE_URL` (or Cloudflare custom domain) on the bucket, the route redirects to `${publicBaseUrl}/${r2Key}`. If the CDN does not enforce signed tokens, any user who obtains the 302 URL can share it publicly, bypassing `access_revoked` refund enforcement.
3. **Key Guessability:** R2 keys are constructed using UUIDv4 (e.g., `videos/${uuid}.mp4`). Entropy is 122 bits, rendering brute-force enumeration cryptographically infeasible.

### 4.3 Cascade Deletion & Orphaned Storage Risk

In `src/land/account/cascade-delete.ts:89-156`, R2 keys are collected prior to D1 row deletion:
```typescript
async function collectTenantR2Keys(db: D1Database, tenantId: string): Promise<string[]> {
  const keys = new Set<string>();
  // 1. Collect from video_jobs (audio_r2_key, visual_r2_key, final_r2_key)
  // 2. Collect from batch_jobs (input_r2_key)
  // 3. Collect from thumbnail_variants (r2_key, preview_r2_key)
  return [...keys];
}
```
And in lines 163-183:
```typescript
async function deleteR2Objects(bucket: R2Bucket, keys: string[]): Promise<number> {
  let deleted = 0;
  for (const key of keys) {
    try {
      await bucket.delete(key);
      deleted++;
    } catch (err) {
      logger.error(`[cascade-delete] R2 delete failed for key "${key}":`, ...);
      // continue deleting remaining keys — partial R2 failure is acceptable
    }
  }
  return deleted;
}
```

#### Deficiencies in R2 Cascade Deletion:
1. **Unmonitored Orphan Accumulation:**  
   If `bucket.delete(key)` fails (e.g. network timeout or rate limit), the error is merely logged. The D1 database rows referencing these keys are deleted in the next step. Once the D1 rows are deleted, there is **no remaining reference** in the database linking the orphaned R2 object to the deleted tenant. The file remains in R2 indefinitely, incurring unbilled storage costs.
2. **Omitted Tables:**  
   `collectTenantR2Keys` does not collect `r2_key` from the `videos` table directly (it only checks `video_jobs`), nor does it collect media assets referenced in `creative_memory` or `commerce_products.asset_ref`.

---

## 5. Summary Matrix & Remediation Roadmap

| Category | Finding | Risk Level | Action Required |
|---|---|---|---|
| Migrations | `apply-migrations.sh` never records applied migrations in `d1_migrations` | **P1 (High)** | Add `INSERT INTO d1_migrations (name, applied_at) VALUES ('$MIGRATION_NAME', datetime('now'))` after successful execution. |
| Migrations | Non-idempotent `CREATE TABLE` without `IF NOT EXISTS` | **P1 (High)** | Audit all migrations; ensure all DDL operations include `IF NOT EXISTS` or defensive guards. |
| Data Ownership | `fetchOrgId` table name mismatch in `cascade-delete.ts` | **P1 (High)** | Query `users` table safely or check both `users` and `"user"`. Guard against empty string `bindValue`. |
| R2 Storage | Orphaned files upon failed R2 deletion | **P2 (Med)** | Write failed deletions to a `storage_cleanup_queue` table for asynchronous retry. |
| R2 Storage | Public CDN redirect bypasses revocation | **P2 (Med)** | Disable public R2 custom domains for video storage; always proxy through authenticated Worker streaming. |

---
**Lane D Forensic Audit Report Signed:** Senior SRE / Infrastructure Security Audit Team
