# Code Review — L1 logger.info Noise Sweep

**Date:** 2026-04-27
**Reviewer:** code-reviewer subagent
**Scope:** 4 hot-path API route files (quota, overage, usage, usage/batch)
**Diff size:** +5 / -15 LOC across 4 files
**Baseline:** 931f5259 (T3 cosmetic batch)
**Decision:** ✅ **APPROVE — Score 9.7/10 — auto-merge cleared**

---

## Files Reviewed

| File | Change | Risk |
|------|--------|------|
| `src/app/api/v1/overage/[tenantId]/route.ts` | 1 demote info→debug + 1 misleading comment removed | None |
| `src/app/api/v1/quota/[tenantId]/route.ts` | 1 demote info→debug + 1 misleading comment removed | None |
| `src/app/api/v1/usage/batch/route.ts` | 1 remove (received) + 2 demote (processing, complete) | None |
| `src/app/api/v1/usage/route.ts` | 1 remove (received) + 1 demote (complete) | None |

**Net:** 4 demote (info→debug), 2 remove, 2 stale-comment removals.

---

## Verification — Required Focus Areas

### 1. Audit/Security Logs Untouched ✅
Inspected ALL `logger.*` calls in 4 modified files:
- `[Overage API] JWT validation failed` → **warn** (preserved)
- `[Overage API] Cross-tenant access attempt blocked` → **warn** (preserved)
- `[Overage API] No active license found for tenant` → **warn** (preserved)
- `[Overage API] Failed to fetch overage events` → **error** (preserved)
- `[Quota API] JWT validation failed` → **warn** (preserved)
- `[Quota API] Cross-tenant access attempt blocked` → **warn** (preserved)
- `[Quota API] No active license found for tenant` → **warn** (preserved)
- `[Batch Ingest API] Authentication failed` → **warn** (preserved)
- `[Batch Ingest API] Invalid request body` → **warn** (preserved)
- `[Batch Ingest API] Critical error` → **error** (preserved)
- `[Batch Ingest API] Error validating API key` → **error** (preserved)

Zero security/audit log demoted. Demoted sites are pure happy-path success summaries.

### 2. Removed Logs Truly Redundant ✅
- `usage/route.ts` "Received batch ingestion request" — duplicates info that the subsequent "complete" log carries (userId + recordCount → already in `result.total`). Removed cleanly.
- `usage/batch/route.ts` "Received request" — redundant with downstream "Processing batch" (now demoted to debug). RequestId still flows through downstream `warn`/`error` if anything fails.

No ops-dashboard load-bearing log removed (these were per-request happy-path noise, not aggregated metrics).

### 3. Response Shape Unchanged ✅
- `git diff` confirms ONLY logger calls + 2 misleading comments touched.
- `NextResponse.json(...)` bodies, headers, status codes, and error response shapes ALL untouched.
- Read-endpoint contract preserved (overage + quota return identical payloads).

### 4. Misleading Comment Cleanup ✅
- `// Step 7: Log audit event` was technically incorrect — `logger.info` ≠ audit log. Confirmed via grep: zero `audit_logs` writes occur in these route files. Real audit handled by `src/lib/audit/audit-query-logger.ts`. Removing the comment prevents future-dev misreading.

### 5. Sophia-Specific Standards ✅
- Zero new `:any` types — production routes clean (existing `:any` only in test-mock helpers, untouched)
- TS=0 maintained (`npx tsc --noEmit` passes silently)
- 1398/1429 tests pass — exact baseline match (31 skipped are pre-existing intentional)
- No `console.log` introduced
- File size: all 4 files remain under 200 LOC budget
- Cloudflare Workers cost model: ✅ less log egress = direct cost reduction

---

## Issue Severity Breakdown

### Critical
None.

### High
None.

### Medium
None.

### Low
- (Style only) Some demoted `logger.debug` calls retain useful operational context (rate-limit remaining, eventCount). Could consider adding a project-level `LOG_LEVEL` env hint in `docs/code-standards.md` so future devs know "happy-path summaries → debug" is the convention. Non-blocking.

---

## Edge Case Scout

| Risk | Status |
|------|--------|
| Log-level filter accidentally hiding security events in prod | ✅ N/A — security paths still warn/error |
| Removed log breaking grep-based ops dashboard | ✅ Clear — these were per-request noise, not aggregated |
| Response payload regression | ✅ Verified — only logger lines + comments changed |
| RequestId trace continuity in batch route | ✅ Preserved — requestId still in warn/error logs |
| TypeScript inference change from logger signature | ✅ N/A — same `logger.*` import, same arg shape |
| Test mocks expecting `logger.info` to be called | ✅ Test suite green — no test asserted these specific calls |

---

## Positive Observations

1. **Surgical scope discipline** — only hot-path read/ingest endpoints touched; billing/state-machine/audit untouched per stated scope.
2. **Comment hygiene** — removing the misleading `// Step 7: Log audit event` comments is a quiet quality win (fewer cargo-cult "Step N" comments to mislead future devs).
3. **Cloudflare Workers cost alignment** — log egress from per-request handlers is a known CF Workers cost driver; demoting to `debug` (typically suppressed in prod) directly reduces invoice line items.
4. **Test parity preserved** — 1398/1429 baseline match confirms no behavioral coupling.
5. **Tester report exists** — `tester-260427-l1-logger-sweep.md` provides clean handover proof.

---

## Metrics

- TS errors: 0 (target: 0) ✅
- Tests: 1398 pass / 31 skip / 0 fail (target: match baseline) ✅
- New `:any`: 0 (target: 0) ✅
- New `console.log`: 0 (target: 0) ✅
- Files >200 LOC introduced: 0 ✅
- Audit/security log demotions: 0 (target: 0) ✅
- Net LOC delta: -10 (less code = less surface) ✅

---

## Recommended Commit Message

```
refactor(logger): L1 noise sweep — demote 4 hot-path summary logs, remove 2 redundant

- src/app/api/v1/quota/[tenantId]/route.ts: success summary info→debug
- src/app/api/v1/overage/[tenantId]/route.ts: success summary info→debug
- src/app/api/v1/usage/route.ts: drop redundant "received" + completion info→debug
- src/app/api/v1/usage/batch/route.ts: drop redundant "received" + processing/complete info→debug
- Remove misleading "Step 7: Log audit event" comments (no audit_logs write at these sites)

Audit/security/state-machine logs untouched. Real audit handled by
src/lib/audit/audit-query-logger.ts.

Tests: 1398/1429 pass (baseline parity). TS=0.
Cloudflare Workers cost: reduced per-request log egress.
```

---

## Decision

**✅ APPROVE — Score 9.7/10 — auto-merge cleared (≥9.5 threshold met)**

Rationale:
- All 5 review-focus checks passed
- Zero risk to security/audit observability
- Zero response-shape regression
- Test baseline preserved exactly
- Aligns with Cloudflare Workers cost model (Sophia stack)
- Conventional commit format suggested

Lost 0.3 only for the (subjective) low-priority docs nudge — not a blocker.

---

## Unresolved Questions

None. Batch is clean. Proceed to Task #113 (PM sync + git + GREEN verify).
