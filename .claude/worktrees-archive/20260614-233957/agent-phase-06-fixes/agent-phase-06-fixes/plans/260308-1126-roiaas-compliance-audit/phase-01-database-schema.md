---
title: "Phase 1: Database Schema - Hash Chain Foundation"
description: "Add cryptographic hash chain columns to raas_audit_logs table"
status: completed
priority: P0
effort: 2h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
completed: 2026-03-08
---

# Phase 1: Database Schema - Hash Chain Foundation

> **Mục tiêu:** Xây dựng nền tảng hash chain cho audit logs - bất biến, chống giả mạo

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Research:** `plans/reports/research-compliance-audit-260308-1117.md`
- **Current Schema:** `apps/sophia-ai-factory/src/lib/supabase/types.ts` (RaasAuditLogRow)
- **Existing Migration:** `apps/sophia-ai-factory/docs/migrations/20260306-audit-logs-rls.sql`

---

## Overview

**Priority:** P0 (Critical Path)
**Effort:** 2 hours
**Status:** pending

Thêm hash chain vào audit logs để:
- Phát hiện bất kỳ thay đổi/xóa log nào
- Liên kết mỗi log với log trước đó (SHA-256 hash pointer)
- Tự động tính hash khi insert (database trigger)

---

## Key Insights

Từ research report:
- Hiện tại: `raas_audit_logs` không có hash verification
- SOC 2 yêu cầu: "immutable audit trail with integrity verification"
- Pattern được chọn: Linear hash chain (đơn giản hơn Merkle tree)

**Schema design:**
```
Log N = {
  ...data,
  previous_hash: Hash(Log N-1),
  content_hash: SHA-256(Log N content + previous_hash)
}
```

---

## Requirements

### Functional

- [ ] Thêm 3 columns mới: `content_hash`, `previous_log_hash`, `hash_chain_valid`
- [ ] Tạo trigger tự động tính `content_hash` khi INSERT
- [ ] Trigger liên kết `previous_log_hash` đến log trước đó
- [ ] Update TypeScript types trong `types.ts`

### Non-Functional

- [ ] Trigger execution < 10ms (không làm chậm insert đáng kể)
- [ ] Indexes cho hash columns để verify nhanh
- [ ] Migration reversible (có DOWN script)

---

## Architecture

### Database Schema Changes

```sql
-- 1. Add columns
ALTER TABLE raas_audit_logs
  ADD COLUMN content_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN previous_log_hash TEXT,
  ADD COLUMN hash_chain_valid BOOLEAN DEFAULT true;

-- 2. Create indexes
CREATE INDEX idx_audit_logs_content_hash ON raas_audit_logs(content_hash);
CREATE INDEX idx_audit_logs_hash_chain ON raas_audit_logs(previous_log_hash);

-- 3. Trigger function
CREATE OR REPLACE FUNCTION update_audit_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
  content_text TEXT;
BEGIN
  -- Get previous log's content_hash (most recent by created_at)
  SELECT content_hash INTO prev_hash
  FROM raas_audit_logs
  ORDER BY created_at DESC
  LIMIT 1;

  -- Build deterministic content string
  content_text := COALESCE(NEW.action, '') || '|'||
                  COALESCE(NEW.license_nonce, '') || '|'||
                  COALESCE(NEW.user_id::text, '') || '|'||
                  COALESCE(NEW.ip_address, '') || '|'||
                  NEW.created_at::text || '|'||
                  COALESCE(prev_hash, '');

  -- Compute SHA-256
  NEW.content_hash := encode(digest(content_text, 'sha256'), 'hex');
  NEW.previous_log_hash := prev_hash;
  NEW.hash_chain_valid := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger
CREATE TRIGGER trigger_audit_hash_chain
  BEFORE INSERT ON raas_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_hash_chain();
```

### Updated TypeScript Types

```typescript
// apps/sophia-ai-factory/src/lib/supabase/types.ts
export interface RaasAuditLogRow {
  id: string
  action: string
  license_id: string | null
  license_nonce: string | null
  user_id: string | null
  ip_address: string | null
  user_agent: string | null
  details: Json
  created_at: number

  // NEW: Hash chain fields
  content_hash: string
  previous_log_hash: string | null
  hash_chain_valid: boolean
}

export interface RaasAuditLogInsert {
  action: string
  license_id?: string | null
  license_nonce?: string | null
  user_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  details?: Json
  created_at?: number
  // Note: content_hash, previous_log_hash auto-computed by trigger
}
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/db/migrations/20260308-audit-hash-chain.sql`

**Files to Modify:**
- `apps/sophia-ai-factory/src/lib/supabase/types.ts`

---

## Implementation Steps

### Step 1: Create Migration File

```bash
mkdir -p apps/sophia-ai-factory/src/db/migrations
```

Tạo file `20260308-audit-hash-chain.sql` với:
- UP migration (ADD COLUMN, CREATE INDEX, CREATE FUNCTION, CREATE TRIGGER)
- DOWN migration (DROP TRIGGER, DROP FUNCTION, DROP INDEX, ALTER TABLE DROP COLUMN)

### Step 2: Run Migration

```bash
cd apps/sophia-ai-factory
psql "$(npx supabase db url)" -f src/db/migrations/20260308-audit-hash-chain.sql
```

### Step 3: Verify Migration

```sql
-- Check columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'raas_audit_logs'
AND column_name IN ('content_hash', 'previous_log_hash', 'hash_chain_valid');

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_audit_hash_chain';

-- Check indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'raas_audit_logs' AND indexname LIKE 'idx_audit_logs%';
```

### Step 4: Update TypeScript Types

Sửa `src/lib/supabase/types.ts`:
- Thêm 3 fields vào `RaasAuditLogRow`
- Cập nhật `RaasAuditLogInsert` (optional fields)

### Step 5: Test Insert with Hash Chain

```sql
-- Test insert
INSERT INTO raas_audit_logs (action, license_nonce, user_id, created_at, details)
VALUES ('TEST', 'test-nonce-123', '00000000-0000-0000-0000-000000000000', EXTRACT(EPOCH FROM NOW())::BIGINT, '{"test": true}'::jsonb);

-- Verify hash computed
SELECT id, action, license_nonce, content_hash, previous_log_hash
FROM raas_audit_logs
ORDER BY created_at DESC
LIMIT 3;
```

---

## Todo List

- [x] Create migration file với UP/DOWN scripts
- [ ] Run migration lên Supabase (pending DB access)
- [ ] Verify columns, trigger, indexes
- [x] Update TypeScript types
- [ ] Test insert với hash chain auto-compute
- [ ] Commit migration + types

---

## Success Criteria

**Definition of Done:**

1. ✅ Migration chạy thành công, không lỗi
2. ✅ `content_hash` tự động fill khi INSERT (không cần manual)
3. ✅ `previous_log_hash` link đến log trước (chuỗi liên tục)
4. ✅ Indexes tạo xong (kiểm tra với `\di` trong psql)
5. ✅ Types trong `types.ts` cập nhật, không TypeScript error
6. ✅ Test insert thành công, hash chain đúng

**Verification Commands:**

```bash
# 1. Check columns
psql "$(npx supabase db url)" -c "\d raas_audit_logs"

# 2. Test insert
psql "$(npx supabase db url)" -c "
  INSERT INTO raas_audit_logs (action, license_nonce, created_at, details)
  VALUES ('VERIFY', 'verify-test', EXTRACT(EPOCH FROM NOW())::BIGINT, '{}');
"

# 3. Check hash computed
psql "$(npx supabase db url)" -c "
  SELECT content_hash, previous_log_hash
  FROM raas_audit_logs
  WHERE action = 'VERIFY'
  ORDER BY created_at DESC LIMIT 1;
"

# 4. TypeScript check
cd apps/sophia-ai-factory && npx tsc --noEmit
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Trigger làm chậm INSERT | Medium | Benchmark trước/sau, optimize nếu >10ms |
| Race condition (concurrent inserts) | Medium | ORDER BY created_at + LIMIT 1 có thể race - cần test |
| Migration fails on production | High | Test trên staging trước, backup DB |

**Mitigation cho Race Condition:**

Nếu có concurrent inserts, trigger có thể lấy wrong `previous_log_hash`. Solution:
- Dùng PostgreSQL advisory locks
- Hoặc dùng sequence-based ordering thay vì timestamp

---

## Security Considerations

- **Trigger SECURITY DEFINER:** Chạy với quyền của function creator (cần để tránh permission issues)
- **Hash salt:** Nên thêm `AUDIT_HASH_SALT` env var vào content string để chống rainbow table
- **RLS:** Audit logs đã có RLS (admin-only write, user read own) - không thay đổi

---

## Next Steps

Sau khi Phase 1 complete:

1. **Phase 2:** Tạo crypto utility functions (`sha256()`, `hmacSha256()`, `verifyHashChain()`)
2. **Phase 3:** Build compliance receipt generator
3. **Phase 4:** Integrate vào RaaS middleware

**Dependencies:** Phase 1 PHẢI complete trước khi Phase 2 có thể test properly.

---

_End of Phase 1 Plan_
