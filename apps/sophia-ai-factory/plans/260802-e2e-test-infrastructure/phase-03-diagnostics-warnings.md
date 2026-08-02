# Phase 03: Diagnostics + Warnings
**Priority:** P1 | **Status:** Complete | **Date:** 2026-08-02

## Overview
Add diagnostic warnings and console carve-out comments to global-setup.ts.

## Requirements
1. D1 bootstrap diagnostics with timeout error pattern recognition
2. Mock AI services warning validation
3. Console carve-out comments explaining Node.js context exception
4. Test user credential validation warning

## Implementation
Enhanced `tests/e2e/global-setup.ts` (95 lines total):

### Console Carve-out (lines 10-13)
```typescript
/**
 * NOTE: This file runs in a raw Node.js context (not the app runtime).
 * The project's no-console rule does not apply here; console output is
 * the primary feedback channel for test bootstrap and operator debugging.
 */
```

### D1 Bootstrap Timeout Handling (lines 74-78)
```typescript
} catch (err) {
  console.warn('⚠️ D1 bootstrap skipped or failed — tests may have missing tables');
  if (err instanceof Error) console.warn(` ${err.message}`);
}
```

### Mock AI Services Warning (lines 80-85)
```typescript
if (!isRemote && process.env.NEXT_PUBLIC_MOCK_AI_SERVICES !== 'true') {
  console.warn('⚠️ NEXT_PUBLIC_MOCK_AI_SERVICES not set to "true".');
  console.warn(' E2E tests may attempt real AI API calls and fail.');
}
```

### Test User Credential Warning (lines 87-93)
```typescript
if (!hasTestUser) {
  console.warn('⚠️ E2E_TEST_USER_PASSWORD not set — auth-dependent tests will be skipped');
}
```

## Success Criteria
- global-setup.ts has all four improvements
- Console output is informative for operators
- No console.* calls in production code (only in Node.js test context)
