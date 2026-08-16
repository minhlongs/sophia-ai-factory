---
title: "Phase 04 — BYOK Audit JSONL"
description: "Append-only JSONL audit trail for BYOK key rotations in R2 with admin query API."
status: TODO
priority: P1
effort: 4h
branch: main
tags: [byok, audit, jsonl, r2, security]
created: 2026-08-16
---

# Phase 04 — BYOK Audit JSONL

## Context Links

- BYOK store: `src/tree/byok/` directory
- Audit log route: `src/app/api/admin/audit-log/route.ts` (D1-based, existing)
- Audit log stats: `src/land/observability/audit-log-stats.ts` (`searchAuditLog`)
- Credential management: `src/tree/credentials/`
- Health seam: Phase 03 (`src/seed/health/component-probes.ts`)
- HeyGen health check pattern: `src/seed/health/heygen-health-check.ts` (KV-cached)

## Overview

**Priority:** P1
**Status:** TODO
**Description:** Create an append-only JSONL audit trail for BYOK key lifecycle events (create, rotate, revoke, use) stored in R2. This provides a tamper-evident log of all API key mutations without requiring database schema changes. The admin query API reads JSONL files and supports filtering by tenant, action, and time range. The existing D1-based audit log (`/api/admin/audit-log`) continues to work for other event types.

## Key Insights

- Current audit log is D1-based (`searchAuditLog` in `src/land/observability/audit-log-stats.ts`)
- BYOK keys are stored encrypted in D1 via `src/tree/byok/`
- JSONL append-only in R2 is tamper-evident: R2 objects are immutable once written
- Per-day JSONL files: `audit/byok/{YYYY-MM-DD}.jsonl` in R2 bucket
- Each line is a self-contained JSON object with timestamp, tenant, action, metadata
- No raw API keys in audit log — only key prefix (first 4 chars) and provider name
- R2 lifecycle: 90-day retention for compliance, auto-rotated
- `R2_BUCKET` binding available via `NEXT_INC_CACHE_R2_BUCKET` or dedicated `AUDIT_BUCKET`

## Requirements

### Functional
1. `appendByokAudit(event)` — append JSONL line to R2 for current day
2. Event types: `key.created`, `key.rotated`, `key.revoked`, `key.used`, `key.validation_failed`
3. Each event includes: `timestamp`, `tenantId`, `provider`, `keyPrefix` (4 chars), `action`, `metadata`
4. Admin query API: `GET /api/admin/byok-audit?tenantId=&action=&from=&to=&limit=`
5. Query reads JSONL files for date range, filters, returns matching events
6. Health check: `GET /api/admin/byok-audit/health` returns last event timestamp + file count

### Non-functional
1. Append latency < 50ms (R2 PUT is fast for small objects)
2. Query latency < 500ms for 7-day range
3. No raw API keys in any audit event
4. Append-only: no delete, no update operations
5. JSONL files are gzip-compressed in R2 (R2 handles this natively)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  appendByokAudit(event: ByokAuditEvent)          │
│  ├── Build JSONL line from event                  │
│  ├── R2 key: audit/byok/{YYYY-MM-DD}.jsonl       │
│  ├── R2 PUT (append via multipart or full replace)│
│  └── Return { ok, r2Key, eventCount }             │
├─────────────────────────────────────────────────┤
│  queryByokAudit(filters: ByokAuditFilters)       │
│  ├── Determine date range from filters            │
│  ├── List R2 objects matching audit/byok/ prefix  │
│  ├── GET + parse each JSONL file                  │
│  ├── Filter by tenantId, action, time range       │
│  └── Return matching events (limit, offset)       │
├─────────────────────────────────────────────────┤
│  GET /api/admin/byok-audit                       │
│  ├── requireAdmin() guard                         │
│  ├── Parse query params (Zod validated)           │
│  ├── Call queryByokAudit()                        │
│  └── Return JSON response                         │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Entry: BYOK store operations (create, rotate, revoke) call `appendByokAudit()`
- Transform: event → JSONL line → R2 PUT (append to daily file)
- Exit: admin query API reads R2, filters, returns JSON

**JSONL event schema:**
```json
{
  "ts": "2026-08-16T10:30:00.000Z",
  "tenantId": "t_abc123",
  "provider": "openrouter",
  "keyPrefix": "sk-o",
  "action": "key.rotated",
  "metadata": { "previousKeyPrefix": "sk-n", "reason": "scheduled" }
}
```

**R2 key layout:**
```
audit/byok/2026-08-16.jsonl
audit/byok/2026-08-15.jsonl
...
```

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `src/seed/utils/jsonl-append.ts` | Create | Generic JSONL append utility for R2 |
| `src/tree/byok/byok-audit-writer.ts` | Create | BYOK-specific audit event writer |
| `src/tree/byok/byok-store.ts` | Modify | Call `appendByokAudit()` on key mutations |
| `src/app/api/admin/byok-audit/route.ts` | Create | Admin query API |
| `src/app/api/admin/byok-audit/health/route.ts` | Create | Audit trail health check |

## Implementation Steps

1. Define `ByokAuditEvent` and `ByokAuditFilters` TypeScript interfaces
2. Create `src/seed/utils/jsonl-append.ts` — generic JSONL append to R2
3. Create `src/tree/byok/byok-audit-writer.ts` — BYOK-specific wrapper
4. Modify BYOK store: call `appendByokAudit()` on create, rotate, revoke
5. Create `src/app/api/admin/byok-audit/route.ts` — admin query API
6. Add Zod validation for query params
7. Create `src/app/api/admin/byok-audit/health/route.ts` — health check
8. Add R2 bucket binding check (ensure `AUDIT_BUCKET` is configured)
9. Write tests: append, query, health, empty date range, filter by tenant
10. Verify: `npm test` passes, `npm run type-check` clean

## Todo List

- [ ] Define `ByokAuditEvent` interface with all fields
- [ ] Define `ByokAuditFilters` interface
- [ ] Create `src/seed/utils/jsonl-append.ts` — generic R2 JSONL append
- [ ] Create `src/tree/byok/byok-audit-writer.ts` — BYOK wrapper
- [ ] Modify BYOK store to call `appendByokAudit()` on mutations
- [ ] Create admin query API route
- [ ] Add Zod validation for query params
- [ ] Create health check route for audit trail
- [ ] Write unit tests for append utility
- [ ] Write unit tests for query with filters
- [ ] Write integration tests for BYOK store + audit trail
- [ ] Run `npm test` — all pass
- [ ] Run `npm run type-check` — clean

## Success Criteria

- BYOK key rotation appends JSONL line to R2
- Admin can query audit events by tenant, action, date range
- No raw API keys in any audit event (only 4-char prefix)
- Append-only: no delete/update operations exposed
- Query returns results within 500ms for 7-day range
- Health check returns last event timestamp
- All existing BYOK tests still pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R2 PUT contention on same-day file | Medium | Medium | Unique key per append batch (timestamp + worker ID) |
| R2 bucket not configured | Low | High | Check binding at startup, log warning if missing |
| JSONL file grows large (high-traffic tenants) | Low | Low | R2 handles large objects; query uses streaming parse |
| Audit trail tampering via R2 delete | Negligible | High | R2 versioning enabled, bucket policy: no deletes |

## Security Considerations

- API keys never stored in audit log — only 4-char prefix + provider name
- Admin query API protected by `requireAdmin` guard
- R2 bucket policy: append-only, no delete operations
- Audit events contain no PII beyond tenant ID
- `HEALTH_TOKEN` gated health endpoint for audit trail status

## Next Steps

- Depends on: Phase 03 (health seam pattern)
- Blocks: Phase 06 (deploy checklist can verify audit trail health)
- Follow-up: Extend JSONL pattern to other audit events (payment, auth, admin actions)
