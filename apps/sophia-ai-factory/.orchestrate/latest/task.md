# TASK — SOPHIA CREATIVE CELL V1

> Source: user request via `/orchestrate` (Principal Architect instruction).
> This pipeline replaces the completed READ-ONLY CEO HANDOVER ARCHITECTURE AUDIT.

## Authoritative input (read and obey)

- `docs/CEO_HANDOVER_AUDIT.md`
- `plans/reports/sophia-architecture.md`
- `plans/reports/hermes-architecture.md`
- `plans/reports/ship-report.md`

The CEO HANDOVER AUDIT is the source of truth for repository paths and extension points.

## Mission

Implement **SOPHIA CREATIVE CELL V1**. Initial capability: `image.generate`.

Flow: Sophia Mission → existing Sophia orchestration → Creative Cell → Provider Adapter → Image Result → existing Sophia asset/result flow → existing Result Gate → Ship.

## Non-negotiable architecture

Sophia remains **CONTROL PLANE**. Sophia owns: mission lifecycle, workflow orchestration, state, events, billing, user identity, budgets, quality/result gates, shipping.

Creative providers are **EXECUTION PLANE**.

DO NOT:
- create a second mission engine
- create a second queue system
- create a second event bus
- create a parallel state machine if an existing state system can be extended
- modify auth
- modify billing
- modify unrelated video pipelines

## Steps (STEP 0–12)

- STEP 0 — Re-read audit; locate actual extension points; print implementation map (EXISTING FILE → CHANGE / NEW FILE → RESPONSIBILITY). STOP if audit and repo disagree.
- STEP 1 — Create Creative domain primitives (CreativeJob, CreativeAsset, CreativeConstraints) using existing seed/tree/forest/land conventions. No new validation framework.
- STEP 2 — Implement `image.generate` capability integrating into existing mission/event architecture.
- STEP 3 — Minimal provider abstraction: `ImageGenerationProvider` with `generate()`, `capabilities()`, `health()`. Allow future providers. No speculative providers.
- STEP 4 — `MockImageGenerationProvider` (mandatory): SUCCESS / FAILURE / TIMEOUT, deterministic fixtures. Works without Google OAuth, Hermes OAuth, external credentials, production API calls.
- STEP 5 — Use existing event system; add minimum new events following existing naming conventions.
- STEP 6 — Integrate CreativeAsset into existing asset/storage/result system (no competing asset DB). Metadata: mission/job ID, provider, generation timestamp, prompt hash, status. No secrets.
- STEP 7 — Result gate: minimal deterministic gate through existing verification architecture. Verify result exists, asset ref valid, MIME is image, size/metadata constraints, provider status successful. No subjective AI aesthetic scoring in V1.
- STEP 8 — Failure handling via existing retry/error conventions: provider failure, timeout, invalid result, idempotency. Never infinite retry. Never silently swallow provider errors.
- STEP 9 — Tests per existing conventions: success, provider failure, timeout, invalid provider result, result gate rejection, idempotent duplicate, event lifecycle, mission integration. All via Mock provider. No external credentials in CI.
- STEP 10 — Regression protection: run targeted new tests + relevant existing tests + applicable existing quality gates. Do NOT disable tests. Do NOT weaken existing gates.
- STEP 11 — Documentation: `docs/CREATIVE_CELL_V1.md` (Architecture, Capability contract, Extension points, Mock provider, Testing, Future provider integration). Explicitly document Hermes is NOT integrated in Phase 1.
- STEP 12 — Ship report: `plans/reports/creative-cell-v1-ship-report.md` (IMPLEMENTED, NOT IMPLEMENTED, FILES CHANGED, FILES ADDED, TEST RESULTS, REGRESSION RESULTS, KNOWN LIMITATIONS, NEXT PHASE).

## Definition of Done

PASS only if:
- ✓ image.generate works end-to-end
- ✓ uses existing Sophia architecture
- ✓ uses existing event system
- ✓ Mock provider works
- ✓ result gate executes
- ✓ failures are handled
- ✓ idempotency works
- ✓ tests pass
- ✓ no auth/billing regression
- ✓ no production deployment
- ✓ no secrets added

## Constraints

- DO NOT IMPLEMENT HERMES IN THIS PHASE.
- No production deployment.
- No secrets added.