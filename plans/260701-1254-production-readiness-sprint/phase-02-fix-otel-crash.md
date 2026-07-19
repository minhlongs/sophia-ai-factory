# Phase 02 — Fix OTEL Crash + Enable Register Hook

**Priority:** P0 | **Effort:** 1h | **Status:** pending | **Depends on:** Phase 01

## Overview

Fix the Cloudflare Workers runtime crash in `opentelemetry-setup.ts` caused by browser-platform OTLP exporter imports. Then enable the `instrumentation.ts` register hook.

## Root Cause

```typescript
// CURRENT (crash in CF Workers):
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esm/platform/browser/OTLPTraceExporter';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/browser/OTLPMetricExporter';
```

Browser platform exporters reference `window`, `Blob`, `XMLHttpRequest` — unavailable in Cloudflare Workers runtime.

## Implementation Steps

### 1. Switch OTLP exporters to Node platform (~20 min)

**File:** `src/seed/telemetry/opentelemetry-setup.ts`

Replace browser platform imports with Node platform imports:

```typescript
// FIXED (uses fetch, available in Workers):
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esm/platform/node/OTLPTraceExporter';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/node/OTLPMetricExporter';
```

Also check the `SimpleSpanProcessor` — it's from `@opentelemetry/sdk-trace-base` which is platform-agnostic (no change needed).

Alternative if Node platform fails: use bare imports that resolve to platform-agnostic code:
```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
```

### 2. Re-enable register hook in instrumentation.ts (~10 min)

```typescript
import { initializeOTel } from '@/seed/telemetry/opentelemetry-setup';

export async function register(): Promise<void> {
  try {
    await initializeOTel();
  } catch (err) {
    // OTEL failure is non-fatal — app must still serve traffic
    console.error('[instrumentation] OTel init failed:', err);
  }
}
```

**Design decisions:**
- Import uses `@/seed/...` alias (works in Next.js instrumentation)
- `try/catch` ensures OTEL failure doesn't crash the app
- `console.error` is acceptable here (instrumentation.ts runs before logger is available)

### 3. Verify existing OTEL tests still pass (~10 min)

```bash
npx vitest run src/seed/telemetry/__tests__/opentelemetry-setup.test.ts
```
Must pass 5/5.

### 4. Verify Phase 01 TDD tests now pass (~10 min)

```bash
npx vitest run src/__tests__/instrumentation.test.ts
```
Expected: 3/3 pass (initializeOTel called, graceful failure, no-op baseline).

### 5. Build check (~10 min)

```bash
npm run build
```
Must succeed with 0 TypeScript errors. OpenNext build may surface ESM/CJS issues early.

## Success Criteria

- [ ] OTLP exporters switched from browser → Node platform (or bare import)
- [ ] `instrumentation.ts` register() calls `initializeOTel()` with try/catch
- [ ] Phase 01 tests: 3/3 pass (green)
- [ ] Existing OTEL tests: 5/5 pass
- [ ] `npm run build`: 0 errors, pages compile
- [ ] No regression: full test suite passes
