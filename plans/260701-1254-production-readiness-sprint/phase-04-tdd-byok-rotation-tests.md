# Phase 04 — TDD: BYOK Rotation Integration Tests

**Priority:** P0 | **Effort:** 1.5h | **Status:** ✅ complete | **Depends on:** —

## Overview

BYOK key rotation integration tests written and verified.

## Implementation Steps

### 1. Write integration test: full rotation pipeline ✅
- File: `src/tree/byok/key-rotation-integration.test.ts`
- Tests: API → Inngest → re-encrypt → retire → audit

### 2. Write test: rotation is idempotent ✅
### 3. Write test: re-encrypt handles empty tables ✅
### 4. Run integration tests ✅ — 10/10 pass (0 skipped/mocked)

## Success Criteria

- [x] 10 integration tests pass
- [x] Full pipeline test passes
- [x] Idempotency test passes
- [x] Empty table test passes
- [x] Existing unit tests still pass
- [x] No regression: full test suite passes
