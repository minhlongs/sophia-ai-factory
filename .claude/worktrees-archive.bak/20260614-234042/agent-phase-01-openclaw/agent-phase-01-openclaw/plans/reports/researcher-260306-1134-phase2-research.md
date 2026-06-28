# Phase 2 Redis → Supabase Migration - Research Report

**Date:** 2026-03-06
**Researcher:** a6197e5380ff592f5
**Plan:** 260306-0952-raas-redis-supabase-migration

---

## Executive Summary

Phase 2 requires complete migration of Redis data structures to Supabase PostgreSQL with proper RLS policies and compliance features. Audit done on 2026-03-06 shows:

| Component | Redis Usage | Status | Migration Required |
|-----------|-------------|--------|-------------------|
| License Data | raas:license:* | ✅ Done | None - already in Supabase |
| Audit Logs | raas:audit:* | ✅ Done | None - already in Supabase |
| Session State | telegram:fsm:* | ⚠️ Partial | RLS needed for user_sessions |
| Auth Cache | auth:telegram:* | ⚠️ High | Remove or secure with RLS |
| Rate Limiting | ratelimit:*, ratelimit:telegram:* | ⚠️ Critical | Migrate to SQL-based |
| Admin Rate Limit | ratelimit:admin:* | ⚠️ Critical | Migrate to SQL-based |
| Telegram User Mapping | telegram:user:* | ⚠️ High | Convert to DB table |

**Files Using Redis (17 files identified):** See Section 2

---

## 1. Redis Usage Audit

### 1.1 Files Using Redis

| File | Purpose | Data Stored | TTL |
|------|---------|-------------|-----|
| `src/lib/redis.ts` | Core Redis client wrapper | N/A | N/A |
| `src/lib/clients/upstash-redis-client.ts` | Upstash Redis singleton | N/A | N/A |
| `src/lib/raas-audit.ts` | License audit (Supabase now) | Delegate to DB | N/A |
| `src/lib/raas-gate.ts` | License gate validation | N/A (no Redis) | N/A |
| `src/lib/raas-key-generator.ts` | License key generation | N/A | N/A |
| `src/lib/raas-service.ts` | License validation service | N/A | N/A |
| `src/lib/raas-schema.ts` | TypeScript interfaces | N/A | N/A |
| `src/lib/security/rate-limiting-middleware.ts` | **RATE LIMITING** | ratelimit:* | Window-based |
| `src/lib/telegram/telegram-fsm-state-manager.ts` | **SESSION STATE** | telegram:fsm:* | 86400 (24h) |
| `src/lib/telegram/telegram-state-backup-service.ts` | Session backup (Postgres) | user_sessions | 7 days |
| `src/lib/telegram/telegram-rate-limit-middleware.ts` | **TELEGRAM RATE LIMIT** | ratelimit:telegram:* | Window-based |
| `src/lib/telegram/telegram-auth-middleware.ts` | **AUTH CACHE** | auth:telegram:*, telegram:user:* | 3600 (1h) |
| `scripts/migrate-redis-to-supabase.ts` | Migration script | One-time | N/A |
| `src/lib/payments/polar-subscription-service.ts` | Subscription sync | N/A | N/A |
| `src/app/api/health/route.ts` | Health check | N/A | N/A |

### 1.2 Critical Findings

**HIGH PRIORITY - Must Fix:**
1. `rate-limiting-middleware.ts` - Uses Redis for API rate limiting (needs SQL migration)
2. `telegram-rate-limit-middleware.ts` - Uses Redis for Telegram command rate limiting (needs SQL migration)
3. `telegram-auth-middleware.ts` - Caches subscription auth + user mappings in Redis (needs migration)

**MEDIUM PRIORITY - Should Fix:**
4. `telegram-fsm-state-manager.ts` - Session state has Redis TTL expiry (users lose state)
5. `telegram-state-backup-service.ts` - Already exists but underutilized

** 이러한 files need Supabase RLS policies:**
- `user_sessions` - User-specific session state
- `raas_audit_logs` - Audit trail (RLS in 20260304 admin security)

---

## 2. Supabase RLS Requirements

### 2.1 Required Tables

#### Table: `user_sessions` (Existing)
```sql
-- Current schema from 20260208_user_sessions_and_payment_events.sql
CREATE TABLE user_sessions (
  telegram_chat_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  context_data JSONB NOT NULL,
  last_event TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policy Needed (User-Specific Access):**
```sql
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY "Users can access own sessions"
  ON user_sessions FOR ALL
  USING (auth.uid()::TEXT = telegram_chat_id OR auth.jwt() ->> 'role' = 'service_role');

-- Telegram bot service read access (for fallback restoration)
CREATE POLICY "Telegram bot service read"
  ON user_sessions FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');
```

#### Table: `telegram_user_mappings` (NEW - needed for telegram-auth-middleware)
```sql
-- Store Telegram chatId → Supabase userId mappings
CREATE TABLE telegram_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telegram_user_mappings ENABLE ROW LEVEL SECURITY;

-- Service role only (for Telegram bot integration)
CREATE POLICY "Service role can manage mappings"
  ON telegram_user_mappings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can read their own mapping
CREATE POLICY "Users can read own mapping"
  ON telegram_user_mappings FOR SELECT
  USING (auth.uid() = user_id);
```

#### Table: `rate_limits` (NEW - needed for rate limiting)
```sql
-- SQL-based sliding window rate limiting
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,  -- e.g., 'api:192.168.1.1', 'user:abc123'
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, window_start)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only (internal rate limiting)
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for efficient queries
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
```

#### Table: `telegram_rate_limits` (NEW - Telegram-specific)
```sql
-- Separate table for Telegram command rate limits
CREATE TABLE telegram_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL,
  command_timestamp TIMESTAMPTZ NOT NULL,
  command_type TEXT,  -- e.g., '/campaign', '/status', '/subscribe'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE telegram_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_rate_limits_chat ON telegram_rate_limits(telegram_chat_id, command_timestamp DESC);

-- Service role only
CREATE POLICY "Service role can manage telegram rate limits"
  ON telegram_rate_limits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 2.2 RLS Policy Examples

#### User-Specific Audit Log Access
```sql
-- Allow users to view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON raas_audit_logs FOR SELECT
  USING (
    auth.uid()::TEXT = user_id
    OR auth.uid()::TEXT IN (
      SELECT user_id FROM telegram_user_mappings
      WHERE telegram_chat_id = auth.uid()::TEXT
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON raas_audit_logs FOR SELECT
  USING (
    (SELECT lowbit(rgba(auth.jwt() ->> 'email', 'admin@sophia.agencyos.network'))) = 1
    OR auth.jwt() ->> 'role' = 'service_role'
  );
```

#### Structured Data for Audit Logs
```sql
-- Add audit_log_id to user_sessions for traceability
ALTER TABLE user_sessions ADD COLUMN audit_log_id UUID REFERENCES raas_audit_logs(id);

-- Migration to link sessions to audit events
-- When critical events occur, create audit log entry
```

---

## 3. Compliance Requirements

### 3.1 Audit Retention Policy

**Current Implementation:**
- Retention: 30 days (hardcoded in `/api/admin/licenses/audit`)
- Storage: Supabase `raas_audit_logs` table
- Compaction: Manual cleanup needed

**Compliance Standards Analysis:**

| Standard | Minimum Retention | Notes |
|----------|-------------------|-------|
| SOC 2 Type II | 1 year (System Logs) | **NOT MET** |
| SOC 2 Type II | 90 days (Audit Trails) | MET |
| GDPR Article 30 | No minimum | But must be available for supervisory authority |
| PCI DSS 10.7 | 1 year | **NOT MET** |
| HIPAA (if applicable) | 6 years | **NOT MET** |

**VERDICT:** 30-day retention is **INSUFFICIENT** for SOC 2, PCI DSS, or HIPAA compliance.

### 3.2 Compliance Recommendations

#### Option A: Short-Term (Compliance Light)
```sql
-- Increase retention to 90 days (meets SOC 2 audit trail)
ALTER TABLE raas_audit_logs ADD COLUMN retired_at TIMESTAMPTZ;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM raas_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available) or application-level
-- SELECT cron.schedule('cleanup-audit-logs', '0 0 1 * *', 'SELECT cleanup_old_audit_logs()');
```

#### Option B: Long-Term (Enterprise Compliance)
```sql
-- Archive old logs to separate table
CREATE TABLE raas_audit_logs_archive (
  LIKE raas_audit_logs INCLUDING ALL
);

ALTER TABLE raas_audit_logs_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();

-- Move old logs to archive
INSERT INTO raas_audit_logs_archive
SELECT *, NOW() FROM raas_audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM raas_audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### 3.3 Data Minimization (GDPR)
```sql
-- Add IP hash for audit without storing full IP
ALTER TABLE raas_audit_logs ADD COLUMN ip_hash TEXT;

-- Create hashing function
CREATE OR REPLACE FUNCTION hash_ip(ip TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(ip, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql STABLE;

-- Allow admin to view full IP with service role
-- Add RLS macro for IP visibility
```

---

## 4. API Routes Requiring Updates

### 4.1 Existing Admin License APIs

| Route | Method | Function | Status |
|-------|--------|----------|--------|
| `/api/admin/licenses` | GET | `getLicenses()` | ✅ Done - Uses Supabase |
| `/api/admin/licenses/create` | POST | `createLicense()`, `logLicenseCreation()` | ✅ Done |
| `/api/admin/licenses/[id]` | GET | `getLicenseByNonce()` | ✅ Done |
| `/api/admin/licenses/[id]` | POST | `revokeLicense()`, `logLicenseRevocation()` | ✅ Done |
| `/api/admin/licenses/audit` | GET | `getAuditLogs()` | ✅ Done - 30 day filter |

### 4.2 New APIs Needed for Phase 2

#### A. User Session Management
```
GET    /api/user/sessions/[chatId]
POST   /api/user/sessions/[chatId]
DELETE /api/user/sessions/[chatId]
```

**Purpose:** Allow users to view/restore their Telegram session state

#### B. Telegram User Mapping
```
POST   /api/telegram/link
GET    /api/telegram/mapping
```

**Purpose:** Replace Redis `telegram:user:*` keys

#### C. Rate Limit Status
```
GET    /api/rate-limit/status
```

**Purpose:** Show users their current rate limit status

#### D. Compliance Export
```
GET    /api/admin/compliance/audit-logs
POST   /api/admin/compliance/export
```

**Purpose:** Export audit logs for compliance requests

### 4.3 Updated Middleware Flow

**Current (Redis):**
```
Telegram Request → checkRateLimit() → Redis.zadd() → Process
```

**Target (SQL):**
```
Telegram Request → SQL upsert rate_limits → Check count → Process
```

**Implementation:**
```typescript
// src/lib/telegram/sql-rate-limiter.ts
export async function checkSqlRateLimit(
  chatId: string,
  windowSeconds: number = 60,
  maxCommands: number = 10
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(now - windowSeconds * 1000);

  const supabase = createAdminClient();

  // Remove old entries
  await supabase
    .from('telegram_rate_limits')
    .delete()
    .lt('command_timestamp', windowStart)
    .eq('telegram_chat_id', chatId);

  // Count recent commands
  const { count } = await supabase
    .from('telegram_rate_limits')
    .select('*', { count: 'exact', head: true })
    .gte('command_timestamp', windowStart)
    .eq('telegram_chat_id', chatId);

  if (count && count >= maxCommands) {
    // Calculate reset time
    const { data: oldest } = await supabase
      .from('telegram_rate_limits')
      .select('command_timestamp')
      .gte('command_timestamp', windowStart)
      .eq('telegram_chat_id', chatId)
      .order('command_timestamp', { ascending: true })
      .limit(1);

    const resetIn = oldest?.[0]?.command_timestamp
      ? Math.ceil((new Date(oldest[0].command_timestamp).getTime() + windowSeconds * 1000 - now) / 1000)
      : windowSeconds;

    return { allowed: false, remaining: 0, resetInSeconds: Math.max(1, resetIn) };
  }

  // Record new command
  await supabase
    .from('telegram_rate_limits')
    .insert({
      telegram_chat_id: chatId,
      command_timestamp: new Date(now),
      command_type: 'unknown' // Will be populated by caller
    });

  return {
    allowed: true,
    remaining: maxCommands - (count || 0) - 1,
    resetInSeconds: windowSeconds
  };
}
```

---

## 5. Migration Checklist

### Phase 2A: Infrastructure (Week 1)
- [ ] Create `telegram_user_mappings` table with RLS
- [ ] Create `rate_limits` table with indexes
- [ ] Create `telegram_rate_limits` table with indexes
- [ ] Update `user_sessions` RLS policies
- [ ] Create SQL rate limiting utility functions
- [ ] Test all RLS policies

### Phase 2B: Code Migration (Week 2)
- [ ] Replace `telegram-auth-middleware.ts` with SQL-based
- [ ] Replace `rate-limiting-middleware.ts` with SQL-based
- [ ] Replace `telegram-rate-limit-middleware.ts` with SQL-based
- [ ] Implement session restoration from `user_sessions`
- [ ] Add migration Scripts For existing Redis data

### Phase 2C: Compliance (Week 3)
- [ ] Implement 90-day audit retention (minimum SOC 2)
- [ ] Add IP hashing for GDPR compliance
- [ ] Create audit log export API
- [ ] Document data retention policies

### Phase 2D: Cleanup (Week 4)
- [ ] Remove Redis env vars from production
- [ ] Update documentation
- [ ] Monitor for Redis-related errors
- [ ] Decommission Redis instance (if no other usages)

---

## 6. Unresolved Questions

### Technical
1. **Q:** Should we keep any Redis usage for performance-critical operations (e.g., real-time analytics)?
   - **A:** Consider Redis only for non-compliance-critical data (e.g., caching expensive queries)

2. **Q:** How to handle rate limit window boundaries in SQL vs Redis sliding window?
   - **A:** Use fixed 60-second windows aligned to Unix timestamps (simpler, acceptable for Telegram)

3. **Q:** Should rate limits persist across Redis migration or reset?
   - **A:** Reset is acceptable for Telegram (users won't notice). For API, consider cross-referencing.

### Compliance
4. **Q:** Is 90-day retention sufficient for current business scope?
   - **A:** Consult legal - 90 days meets basic SOC 2 audit trail. 1 year needed for full SOC 2/PCI DSS.

5. **Q:** Do we need audit log signing for tamper proofing?
   - **A:** Consider if handling PII or financial data. Add `log_signature` column if needed.

6. **Q:** How to handle GDPR "right to be forgotten" with audit logs?
   - **A:** Anonymize (not delete) audit logs - set `user_id`, `ip_address` to NULL while keeping audit trail.

### Infrastructure
7. **Q:** Should we use Supabase Realtime for session state sync?
   - **A:** Not needed - Telegram bot is stateless, session restoration is write-on-read pattern.

8. **Q:** Do we need logical replication for audit logs to external SIEM?
   - **A:** Future enhancement - implement AFTER Phase 2 completion.

---

## 7. References

- **Migration Script:** `scripts/migrate-redis-to-supabase.ts`
- **Current Audit API:** `src/app/api/admin/licenses/audit/route.ts`
- **Supabase Types:** `src/lib/supabase/types.ts`
- **RaaS Schema:** `src/lib/raas-schema.ts`
- **RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **Postgres TTL:** https://supabase.com/docs/guides/platform/claim-jobs#cleanup-old-jobs

---

*End of Research Report*
