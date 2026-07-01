# Brainstorm: Production Readiness Sprint

**Date:** 2026-07-01 | **Flags:** --deep --parallel | **Decision:** Approved

## Problem

Q2 2026 enterprise hardening has 2 remaining open items (E3 OTEL, E4 BYOK Rotation) blocking full completion. Both are 80-90% implemented but not production-verified. Additionally, 3 committed plans have `status: pending` with mixed implementation states.

## Scout Summary

- **E3 OTEL:** Fully implemented (126 LOC setup + Inngest/API instrumentation), but `instrumentation.ts` register() is disabled due to "module factory edge crash". Deps installed. Honeycomb API key not yet in prod secrets.
- **E4 BYOK Rotation:** Admin API + Inngest re-encrypt function + tests all exist. Not yet tested end-to-end in staging.
- **3 pending plans:** Security fixes (P0, partially done), A/B Runner (P1, not started), Landing Pages (P2, core code shipped).

## Decision

**Production readiness first → then resume pending plans.**

Two independent parallel tracks, zero cross-dependency.

### Track A — OTEL Production Activation (~3h)

1. Fix `instrumentation.ts` crash — likely root cause: ESM/CJS mismatch in OTLP exporter browser platform import path (`build/esm/platform/browser/OTLPTraceExporter`). Switch to Node SDK or fix import.
2. Enable register hook → call `initializeOTel()`
3. Add `HONEYCOMB_API_KEY` to production secrets
4. Deploy staging → verify traces in Honeycomb UI
5. Deploy production with 1% samplerate

**Files:** `instrumentation.ts`, `opentelemetry-setup.ts`, `wrangler.toml`

### Track B — BYOK Rotation Staging Test (~3h)

1. Run and fix existing `key-rotation.test.ts`
2. Write integration test: create test keys → rotate API → verify re-encryption
3. Verify audit log entries
4. Document rotation runbook

**Files:** `key-rotation.test.ts`, `key-rotation-reencrypt.ts`, `keys/rotate/route.ts`

## Post-Production-Readiness

Resume 3 pending plans in P0→P1→P2 order:
1. **Security Audit Fixes** — Update status from "pending", ship remaining phases (Phases 2-7, ~14h after partial completion)
2. **A/B Runner + Credit Bar** — Implement from plan (phases 01-06, ~10h)
3. **Programmatic Landing Pages** — Verify shipped code, run remaining admin test phase (~4h)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OTEL crash is deeper than import path fix | Medium | High | Fallback: use `@opentelemetry/sdk-trace-node` instead of browser platform |
| BYOK re-encrypt touches live credentials | Low | Critical | Run only in staging first, verify with test keys |
| Honeycomb API key not provisioned | Medium | Medium | Track B can proceed independently; OTEL verify deferred |

## Success Criteria

1. `instrumentation.ts` register() enabled and not crashing
2. Traces visible in Honeycomb staging
3. BYOK rotation API → Inngest → re-encrypt works end-to-end in staging
4. Audit logs record rotation events
5. Both tracks deployed to production, verified

## Next Steps

→ `/ck:plan --tdd` (recommended — refactors existing OTEL + BYOK code)
