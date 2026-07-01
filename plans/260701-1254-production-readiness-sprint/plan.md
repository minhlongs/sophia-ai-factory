---
title: "Production Readiness Sprint — OTEL Activation + BYOK Rotation Verification"
description: "Close out Q2 enterprise hardening: fix OTEL instrumentation.ts crash (browser→Node exporters), enable Honeycomb in prod, and verify BYOK key rotation end-to-end in staging."
status: pending
priority: P0
effort: 6h
branch: main
tags: [otel, honeycomb, byok, key-rotation, production-readiness, tdd]
created: 2026-07-01
brainstorm: plans/reports/brainstorm-260701-1254-production-readiness-sprint.md
---

# Production Readiness Sprint

**Goal:** Close the last 2 open Q2 enterprise hardening items (E3 OTEL, E4 BYOK Rotation). Both are 80-90% implemented but not production-verified.

## Current State

| Item | Code | Tests | Prod | Blocker |
|------|------|-------|------|---------|
| E3 OTEL | Full setup (126 LOC) + Inngest/API instrumentation | 5/5 pass (Node env) | Disabled | `instrumentation.ts` register() disabled — browser platform OTLP exporters crash in CF Workers |
| E4 BYOK Rotation | Admin API + Inngest re-encrypt (275 LOC) | 8/8 pass | Untested | No staging E2E verification |

## Root Cause (OTEL Crash)

`opentelemetry-setup.ts` imports from browser platform paths:
```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esm/platform/browser/OTLPTraceExporter';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/browser/OTLPMetricExporter';
```

Cloudflare Workers runtime lacks browser globals (`window`, `Blob`, `XMLHttpRequest`) that these browser-platform exporters expect. Fix: switch to Node platform or base package exports that use `fetch` (available in Workers).

## Dependency Graph

```
Phase 01 (TDD: instrumentation.ts tests)
 ├── Phase 02 (Fix OTEL crash + enable register hook) ── Phase 03 (Deploy OTEL to staging → Honeycomb verify)
 └── Phase 04 (TDD: BYOK rotation integration tests) ── Phase 05 (Staging E2E verification) ──┬── Phase 06 (Production deploy + verify)
```

**Parallel:** Track A (Phases 01-03) and Track B (Phases 04-05) have zero cross-dependency. Phase 06 gates on both.

## Phases

| # | Phase | Effort | Status | Blocks |
|---|-------|--------|--------|--------|
| 01 | TDD: instrumentation.ts tests | 1h | pending | — |
| 02 | Fix OTEL crash + enable register hook | 1h | pending | 01 |
| 03 | Deploy OTEL to staging, verify Honeycomb | 1h | pending | 02 |
| 04 | TDD: BYOK rotation integration tests | 1.5h | pending | — |
| 05 | Staging E2E verification | 1h | pending | 04 |
| 06 | Production deploy + verify both | 0.5h | pending | 03, 05 |

**Total: 6h**

## Quality Gates (per phase)

- TypeScript: 0 errors
- Tests: all pass + new TDD tests
- Build: succeeds
- Lint: clean
- No regression on existing 6694+ tests

## Success Criteria

1. `instrumentation.ts` register() calls `initializeOTel()` without crashing in CF Workers
2. Traces visible in Honeycomb staging UI
3. Production Honeycomb traces flowing at 1% samplerate
4. BYOK rotation API → Inngest → re-encrypt works E2E in staging
5. Audit log entries recorded for rotation events
6. Old key version retired after re-encryption completes
