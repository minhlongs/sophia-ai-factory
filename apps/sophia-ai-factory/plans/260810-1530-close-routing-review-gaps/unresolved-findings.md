# Unresolved Findings & Decisions

## Documented Gaps (Not Changed)

### 1. Other Providers Lack Health Sources
**Finding**: Only HeyGen has a circuit-breaker (`src/seed/utils/circuit-breaker.ts`). OpenRouter, ElevenLabs, D-ID have no health API or circuit-breaker.

**Decision**: Keep `healthScore: 1` for these providers (assumed healthy if key exists). Do NOT invent new health infrastructure.

**Rationale**: 
- No-tech doctrine: Operator cannot manage third-party health monitoring
- BYOK model: Customer owns keys, customer should configure health if needed
- Future: Add health webhook configuration to Setup Wizard (customer-side)

**Code Comment** (to add in `provider-pool.ts`):
```typescript
// Health sources by provider:
// - heygen: KV-backed circuit-breaker (src/seed/utils/circuit-breaker.ts)
// - openrouter, elevenlabs, d-id: No health API available → assumed healthy (1.0)
//   Future: Customer-configurable health webhook via Setup Wizard (BYOK)
```

### 2. Circuit-Breaker Scope Limited to HeyGen
**Finding**: Circuit-breaker at `src/seed/utils/circuit-breaker.ts` is HeyGen-specific (key: `circuit:heygen`).

**Decision**: Scope Phase 03 to HeyGen only. Do not create generic circuit-breaker framework.

**Rationale**:
- YAGNI: Only HeyGen has production failure rate data (via fulfillment webhook)
- Other providers fail differently (rate limits, auth errors) — not suited for same circuit-breaker
- Adding generic framework = new infrastructure = violates no-tech doctrine

### 3. Strategy Selection Not Tested in Integration
**Finding**: `video-generate.test.ts` mocks `selectWithStrategy` — doesn't test real strategy logic.

**Decision**: Phase 01 adds direct unit tests. Integration test remains mocked (correct — tests Inngest flow, not strategy logic).

**Rationale**:
- Unit tests cover pure strategy logic (fast, deterministic)
- Integration test covers Inngest orchestration (async, complex)
- Separation of concerns: don't conflate

### 4. Progress Event Emission Pattern Inconsistent
**Finding**: Some Inngest functions define `emitProgress` locally (video-generate, video-scripting, video-tts, video-compose), not shared.

**Decision**: Keep local definitions. Do not extract to shared utility.

**Rationale**:
- Each function has different step names and progress semantics
- Local definition = explicit, no cross-function coupling
- DRY violation is intentional (bounded context)

## Rollback Plan

| Phase | Rollback Command |
|-------|------------------|
| 01 | `git checkout src/forest/quota/__tests__/routing-strategy.test.ts` (delete file) |
| 02 | `git checkout src/forest/inngest/functions/video-generate.ts` |
| 03 | `git checkout src/forest/quota/provider-pool.ts` |

## File Ownership (No Conflicts)

| File | Owner Phase |
|------|-------------|
| `src/forest/quota/__tests__/routing-strategy.test.ts` | Phase 01 (NEW) |
| `src/forest/inngest/functions/video-generate.ts` | Phase 02 |
| `src/forest/quota/provider-pool.ts` | Phase 03 |
| `src/seed/utils/circuit-breaker.ts` | Phase 03 (read-only) |

**No two phases touch the same file** — safe for parallel execution.

## Dependencies

```
Phase 01 ──────────► Independent (new test file)
Phase 02 ──────────► Independent (video-generate.ts only)
Phase 03 ──────────► Depends on circuit-breaker existing (verified)
       │
       └──► No dependency on Phase 01 or 02
```

All phases can run in parallel — no file conflicts.

## Definition of Done

| Checklist | Verification |
|-----------|--------------|
| [ ] Phase 01: 12+ strategy tests pass | `npx vitest run src/forest/quota/__tests__/routing-strategy.test.ts` |
| [ ] Phase 02: Bilingual progress on NoProvidersAvailableError | `npx vitest run src/forest/inngest/functions/video-generate.test.ts` + manual SSE check |
| [ ] Phase 03: HeyGen healthScore from circuit-breaker | `npx vitest run src/forest/inngest/functions/video-generate.test.ts` + type-check |
| [ ] All: 0 TypeScript errors | `npm run type-check` |
| [ ] All: No regressions (6,570+ tests) | `npm test` |
| [ ] All: Deploy verified (SHA match) | `npm run deploy:full` + SHA check |