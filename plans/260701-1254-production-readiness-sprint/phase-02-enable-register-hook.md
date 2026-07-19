# Phase 02 — Fix OTEL Crash + Enable Register Hook

**Priority:** P0 | **Effort:** 1h | **Status:** ✅ complete | **Depends on:** Phase 01

## Overview

Fixed the browser→Node platform import issue in `opentelemetry-setup.ts` and enabled the register() hook in `instrumentation.ts`.

## Implementation Steps

### 1. Fix platform imports in opentelemetry-setup.ts ✅
- Changed from browser platform paths to Node platform exports
- `@opentelemetry/exporter-trace-otlp-http` (Node-compatible, uses fetch)
- `@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/node`

### 2. Enable register() in instrumentation.ts ✅
- register() now calls `initializeOTel()` with try/catch
- OTEL failure is non-fatal (app must still serve traffic)

### 3. Verify TDD tests pass ✅
- All 3 instrumentation.test.ts tests pass
- `HONEYCOMB_API_KEY` configured in wrangler secrets

## Success Criteria

- [x] `instrumentation.ts` register() calls `initializeOTel()`
- [x] No "module factory edge crash" in CF Workers
- [x] 3/3 instrumentation tests pass
- [x] Build passes, 0 TypeScript errors
