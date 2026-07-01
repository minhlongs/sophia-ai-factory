# Phase 01 — TDD: instrumentation.ts Tests

**Priority:** P0 | **Effort:** 1h | **Status:** pending | **Depends on:** —

## Overview

Write tests for the instrumentation.ts register hook BEFORE fixing it. Current state: register() is a no-op (disabled). Tests lock in the current behavior so the fix is verified to not regress.

## Context

- `instrumentation.ts`: Next.js instrumentation hook — `register()` is called once at startup
- Current: `export async function register(): Promise<void> { /* Disabled */ }`
- Target: register() should call `initializeOTel()` from `@/seed/telemetry/opentelemetry-setup`

## Implementation Steps

### 1. Write test: register() is a no-op today (~15 min)

Create `src/__tests__/instrumentation.test.ts`:
```typescript
describe('instrumentation.ts', () => {
  it('exports register function (currently disabled)', async () => {
    const mod = await import('@/../instrumentation');
    expect(mod.register).toBeDefined();
    // Should not throw when called
    await expect(mod.register()).resolves.toBeUndefined();
  });
});
```

### 2. Write test: register() will call initializeOTel after fix (~20 min)

Mock `@/seed/telemetry/opentelemetry-setup` and verify register() calls `initializeOTel`:
```typescript
it('register() should call initializeOTel (post-fix expectation)', async () => {
  vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
    initializeOTel: vi.fn().mockResolvedValue(undefined),
    getTracer: vi.fn(),
    startSpan: vi.fn(),
  }));
  const { register } = await import('@/../instrumentation');
  await register();

  const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
  expect(initializeOTel).toHaveBeenCalled();
});
```
**Note:** This test will FAIL initially (register is disabled). That's intentional — TDD red phase.

### 3. Write test: register() handles initializeOTel failure gracefully (~15 min)

```typescript
it('register() should not throw if initializeOTel fails', async () => {
  vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
    initializeOTel: vi.fn().mockRejectedValue(new Error('No API key')),
  }));
  const { register } = await import('@/../instrumentation');
  // Should not throw — OTEL failure is non-fatal
  await expect(register()).resolves.toBeUndefined();
});
```

### 4. Run tests — confirm 2 pass, 1 fails (~10 min)

```bash
npx vitest run src/__tests__/instrumentation.test.ts
```
Expected: 2 pass (no-op test + graceful failure), 1 fail (initializeOTel not called)

## Success Criteria

- [ ] 3 new tests in `src/__tests__/instrumentation.test.ts`
- [ ] Tests run: 2 pass, 1 intentionally fails (TDD red)
- [ ] No existing test regression
- [ ] Build passes (`npm run build`)
