---
title: "Phase 7: Tests & Verification"
description: "Comprehensive test suite and Phase 6 certification verification"
status: pending
priority: P0
effort: 0.5h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
---

# Phase 7: Tests & Verification

> **Mục tiêu:** Đảm bảo tất cả phases hoạt động correctly, ROIaaS Phase 6 certified

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **All Phases:** Phase 1-6 must be complete before Phase 7

---

## Overview

**Priority:** P0 | **Effort:** 0.5h | **Status:** pending

Phase 7 = verification phase, chạy sau khi Phase 1-6 complete.

**Activities:**
1. Run all unit tests (crypto, receipts, manifest)
2. Run integration tests (DB + API)
3. Run E2E tests (UI flows)
4. Verify Phase 6 certification checklist
5. Build + lint check
6. Production deploy verification

---

## Test Files

### Unit Tests

| File | Coverage Target |
|------|-----------------|
| `crypto-utils.test.ts` | 100% |
| `compliance-receipt.test.ts` | 100% |
| `manifest-generator.test.ts` | 90% |
| `audit-logger.test.ts` | 90% |

### Integration Tests

| File | Scope |
|------|-------|
| `audit-logger.integration.test.ts` | DB insert + hash chain + receipt |
| `receipt-api.test.ts` | API endpoints |
| `manifest-api.test.ts` | Manifest generation |

### E2E Tests

| File | Flow |
|------|------|
| `compliance-page.e2e.test.ts` | Dashboard UI |
| `receipt-verify.e2e.test.ts` | Receipt verification flow |

---

## Verification Checklist

### Phase 1: Database Schema

```bash
# Check columns exist
psql "$(npx supabase db url)" -c "\d raas_audit_logs"

# Expected: content_hash, previous_log_hash, hash_chain_valid columns

# Check trigger exists
psql "$(npx supabase db url)" -c "
  SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_audit_hash_chain';
"
# Expected: 1 row

# Check indexes
psql "$(npx supabase db url)" -c "
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'raas_audit_logs' AND indexname LIKE 'idx_audit%';
"
# Expected: idx_audit_logs_content_hash, idx_audit_logs_hash_chain
```

### Phase 2: Crypto Utility

```bash
# Run tests
cd apps/sophia-ai-factory
npm test -- crypto-utils.test.ts

# Expected: All pass, 100% coverage
```

### Phase 3: Compliance Receipt

```bash
# Run tests
npm test -- compliance-receipt.test.ts

# Test API endpoint
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/audit/receipt?logId=<uuid>"
# Expected: 200 OK with receipt JSON
```

### Phase 4: RaaS Gateway

```bash
# Trigger validation
curl -H "X-RaaS-License-Key: <test-key>" \
  "http://localhost:3000/api/protected-endpoint" \
  -v 2>&1 | grep "X-RaaS-Receipt"
# Expected: Receipt header present

# Check audit log created
psql "$(npx supabase db url)" -c "
  SELECT id, action, content_hash, receipt_signature
  FROM raas_audit_logs
  WHERE action = 'VALIDATE'
  ORDER BY created_at DESC LIMIT 1;
"
# Expected: 1 row with hash and signature
```

### Phase 5: Compliance UI

```bash
# Manual test
open http://localhost:3000/dashboard/compliance

# Expected:
# - Certificate view loads
# - Audit trail table shows data
# - Hash chain visualizer renders
# - Receipt verifier works
```

### Phase 6: Manifest Generator

```bash
# Test JSON manifest
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/audit/manifest?format=json" \
  -o manifest.json
# Expected: Valid JSON with all fields

# Test PDF manifest
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/audit/manifest?format=pdf" \
  -o manifest.pdf
# Expected: PDF file downloads
```

---

## Phase 6 Certification Checklist

```
ROIaaS Phase 6 Certification
═══════════════════════════════════════════════════════════

Database Schema (Phase 1)
[ ] content_hash column exists
[ ] previous_log_hash column exists
[ ] hash_chain_valid column exists
[ ] Trigger auto-computes hash on insert
[ ] Indexes created for performance

Cryptographic Utilities (Phase 2)
[ ] sha256() function works
[ ] hmacSha256() function works
[ ] verifyHashChain() detects tampering
[ ] timingSafeEqual() prevents timing attacks
[ ] Unit tests pass (100% coverage)

Compliance Receipts (Phase 3)
[ ] Receipt generation works
[ ] Receipt verification works
[ ] API endpoints protected
[ ] Receipts include all required fields

RaaS Gateway Integration (Phase 4)
[ ] Every validation creates audit log
[ ] Receipt attached to response
[ ] Hash chain links correctly
[ ] Performance overhead < 50ms

Compliance UI (Phase 5)
[ ] Dashboard page loads
[ ] Certificate view shows correct data
[ ] Audit trail table paginates
[ ] Hash chain visualizer renders
[ ] Receipt verifier functional

Manifest Generator (Phase 6)
[ ] JSON manifest generates
[ ] PDF manifest generates
[ ] Download works
[ ] Attestation signature valid

Final Verification
[ ] npm run build passes (0 errors)
[ ] npm run lint passes (0 warnings)
[ ] npm test passes (all tests)
[ ] CI/CD GREEN
[ ] Production HTTP 200

═══════════════════════════════════════════════════════════
ROIaaS Phase 6: CERTIFIED ✅
```

---

## Success Criteria

**Definition of Done:**

1. ✅ All unit tests pass
2. ✅ All integration tests pass
3. ✅ All E2E tests pass
4. ✅ Build passes (0 TypeScript errors)
5. ✅ Lint passes (0 warnings)
6. ✅ All Phase 6 checklist items checked
7. ✅ Production deploy successful (CI/CD GREEN)

---

## Unresolved Questions

1. **RFC 3161 Timestamp:** Có nên tích hợp external TSA service không? (chi phí vs benefit)
2. **Merkle Tree:** Linear chain đủ không, hay cần Merkle cho partial verification?
3. **Retention Period:** 90 days hiện tại có đủ cho SOC 2 compliance không?

---

_End of Phase 7 Plan_
_End of ROIaaS Compliance Audit Trail Implementation Plan_
