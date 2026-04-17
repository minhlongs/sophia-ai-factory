# Phase B — Customer BYOK Adapter + Provider Router

**Status:** deferred (next iteration) | **Priority:** P1 | **Effort:** 2d | **Depends:** Phase A

> **DEFERRED — DO NOT IMPLEMENT THIS ITERATION.** Hydrate from this skeleton next session after Phase A burn-in.

## Goal
Generalize Phase A's env-var single-tenant adapter into a per-user opt-in BYOK provider stored in D1, gated by a KV feature flag for percentage rollout.

## Architecture Sketch
```
User row in D1.users
  ├── local_mode_endpoint (TEXT, nullable)
  └── local_mode_bearer_encrypted (TEXT, nullable, AES-GCM ciphertext from Phase C)

KV flag `local_mode_rollout` (0-100): % of eligible users routed locally.

Provider router (lib/byok/index.ts or new lib/byok/provider-router.ts):
  enum BYOKProvider { 'openrouter' | 'elevenlabs' | 'd-id' | 'local-mekongd' }
  callAIProvider(provider, prompt, userConfig)
    └── if 'local-mekongd' → callLocalMekongd(...) [Phase A adapter, generalized to take config not env]
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/byok/provider-router.ts` (≤120 LOC)
- `apps/sophia-ai-factory/src/lib/byok/provider-router.test.ts` (≥6 tests)
- `apps/sophia-ai-factory/migrations/NNNN_local_mode_columns.sql` — adds 2 columns to `users`

### Modify
- `apps/sophia-ai-factory/src/lib/byok/local-mekongd-adapter.ts` — accept config object (endpoint/bearer/model) instead of reading env (Phase A used env)
- `apps/sophia-ai-factory/src/lib/discovery/affiliate-openrouter-niche-enhancer.ts` — call provider-router instead of env-var branch
- All other LLM call-sites (proposal generation, agent loops) — switch to provider-router

## Effort Estimate
- Migration + D1 column: 0.5d
- Provider router + tests: 1d
- Wire ≥3 call-sites + tests: 0.5d

## Open Questions
- Should provider router cache the user's local_mode_endpoint per request, or hit D1 on every call? (Lean: per-request lookup, D1 is fast at edge.)
- Which call-sites get migrated in Phase B vs later? (Lean: niche-enhancer only; others deferred.)
