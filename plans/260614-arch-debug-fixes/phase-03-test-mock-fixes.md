# Phase 03: Fix Test Mock Patterns

**Priority:** P1 (Buffer)  
**Status:** Not Started  
**Estimated Duration:** 3 hours

---

## Context Links

- **Quality gate failure:** Typecheck errors in test files (Promise mismatches)
- **Deep Research:** Buffer item — test infrastructure robustness
- **Phase 00 results:** 56 type errors, many from mock returns not matching expected Promise types

---

## Overview

Test mocks incorrectly return synchronous values where the code expects `Promise<T>`. This causes TypeScript errors and potential runtime issues.

**Common pattern:**
```typescript
// Wrong:
vi.fn().mockReturnValue({ data: null });  // returns plain object
// Expected: Promise<{ data: null }>
```

**Affected files (from Phase 00):**
- `src/tree/admin/synthetic-fulfillment-runner.test.ts` — 7 errors
- `src/tree/byok/user-api-key-store.test.ts` — missing `@cloudflare/d1` types
- `src/tree/handover/__tests__/auto-handover.test.ts` — 11 errors
- Others with similar patterns

---

## Requirements

### Functional
1. Fix all mock functions to return `Promise` where code under test expects async
2. Use `.mockResolvedValue()` instead of `.mockReturnValue()` for async functions
3. For chainable mocks, ensure each link returns correct Promise shape
4. Add missing type stubs if `@cloudflare/d1` types unavailable in test context

### Non-Functional
1. Maintain test readability — don't over-mock
2. Preserve existing test logic (only fix mock return types)
3. No changes to production code
4. All fixes should make typecheck errors disappear

---

## Implementation Steps

### Step 1: Identify pattern

Search for common anti-patterns:

```bash
# Find mocks returning non-Promise in test files
grep -rn "mockReturnValue({ data:" src/ --include="*.test.ts" | head
# Should be mockResolvedValue

# Find mocks missing Promise wrapper for functions that return Promise
grep -rn "mockReturnValue(vi.fn())" src/ --include="*.test.ts" | head
```

### Step 2: Fix synthetic-fulfillment-runner.test.ts

Open file. Likely pattern:
```typescript
vi.fn().mockReturnValue({ data: null }); // ❌
```

Change to:
```typescript
vi.fn().mockResolvedValue({ data: null }); // ✅
```

For chainable mocks:
```typescript
mockDb.select = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn(), // should return Promise
  }),
});
```

Fix:
```typescript
mockDb.select = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: null }),
  }),
});
```

### Step 3: Fix auto-handover.test.ts

Similar pattern. Also check for functions expecting `Promise<void>` — use `mockResolvedValue(undefined)`.

### Step 4: Fix user-api-key-store.test.ts

Error: `Cannot find module '@cloudflare/d1'`

**Option A:** Add type stub in test or `types/`:
```typescript
// types/cloudflare-d1.d.ts
declare module '@cloudflare/d1' {
  export interface Database { /* minimal */ }
  export class D1Database { /* stub */ }
}
```

**Option B:** Mock the module to return empty object (if types not used directly):
```typescript
vi.mock('@cloudflare/d1', () => ({}));
```

### Step 5: Re-run typecheck

After fixes, run:
```bash
npm run ci:typecheck 2>&1 | grep -E "error TS" | wc -l
```

Should be 0 or significantly reduced.

### Step 6: Run tests to ensure no regression

```bash
npm test -- src/tree/admin/synthetic-fulfillment-runner.test.ts src/tree/handover/__tests__/auto-handover.test.ts src/tree/byok/user-api-key-store.test.ts
```

---

## Related Code Files

- `src/tree/admin/synthetic-fulfillment-runner.test.ts`
- `src/tree/handover/__tests__/auto-handover.test.ts`
- `src/tree/byok/user-api-key-store.test.ts`
- Plus any other test file with mock return type errors

---

## Success Criteria

- `npm run ci:typecheck` exits 0 OR remaining errors unrelated to mock patterns
- No test file has `mockReturnValue` where `mockResolvedValue` expected
- All async function mocks return `Promise<T>`
- `@cloudflare/d1` type errors resolved

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Over-mocking breaks test logic | Low | Medium | Keep changes minimal; verify test behavior unchanged |
| Missing some mock patterns | Medium | Low | Grep comprehensively; run typecheck iteratively |
| Type stub conflicts with real types | Low | Low | Use `declare module` with minimal surface; ensure no production impact |

---

## Commands Reference

```bash
# Find files to fix
grep -rn "mockReturnValue({ data:" src/ --include="*.test.ts" -l

# Fix: replace mockReturnValue with mockResolvedValue for async returns
# Also ensure .single, .maybeSingle, .first return Promises

# Typecheck
npm run ci:typecheck

# Test specific files
npm test -- <file1> <file2>
```

---

**END OF PHASE 03**
