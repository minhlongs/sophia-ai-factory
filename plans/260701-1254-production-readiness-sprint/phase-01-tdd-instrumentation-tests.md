# Phase 01 — TDD: instrumentation.ts Tests

**Priority:** P0 | **Effort:** 1h | **Status:** ✅ complete | **Depends on:** —

## Overview

Wrote tests for the instrumentation.ts register hook BEFORE fixing it. Tests lock in the current behavior so the fix is verified to not regress.

## Implementation Steps

### 1. Write test: register() is a no-op today ✅
### 2. Write test: register() will call initializeOTel after fix ✅
### 3. Write test: register() handles initializeOTel failure gracefully ✅
### 4. Run tests — confirm 2 pass, 1 fails ✅

## Success Criteria

- [x] 3 new tests in `src/__tests__/instrumentation.test.ts`
- [x] Tests run: 2 pass, 1 intentionally fails (TDD red) — later all 3 pass after Phase 02 fix
- [x] No existing test regression
- [x] Build passes (`npm run build`)

## Result

All 3 tests pass. File: `src/__tests__/instrumentation.test.ts` (67 lines, @vitest-environment node).
