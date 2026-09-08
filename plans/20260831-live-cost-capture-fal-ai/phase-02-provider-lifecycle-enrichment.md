# Phase 2 — Provider Lifecycle Enrichment

## Overview
- Priority: HIGH
- Status: PENDING
- Description: Enrich `FalImageProvider.generate()` to compute real cost,
  capture retry count, split requested/started timestamps, and expose
  error classification on the failure path.

## Key Insights
- `generate()` currently returns `costCents: undefined` — the insertion
  point.
- `fetchWithRetry()` already returns `{ result, attempts }` — `attempts`
  IS the retry count (1 = no retry).
- `classifyError`/`classifyHttpStatus` already produce `FailureKind`.
- `mapFailureKindToErrorCategory` (tree layer) maps to `ErrorCategory`.
  BUT the provider is seed layer — it CANNOT import from tree. So the
  provider must expose the `FailureKind` in its result and let the action
  (land) do the mapping. See architecture.

## Architecture — Layer Boundary Decision

The provider (seed) cannot import `mapFailureKindToErrorCategory` (tree).
Two options:

**Chosen: provider exposes raw economic signals; action maps.**

- `ImageGenerationResult` gets new OPTIONAL fields:
  - `costCents?: number`
  - `costClassification?: CostClassification`
  - `failureKind?: FailureKind` (seed-layer type, no tree import)
  - `retryCount?: number`
  - `requestedAt?: number` (epoch seconds)
  - `startedAt?: number` (epoch seconds)
- The action (land) imports `mapFailureKindToErrorCategory` (tree) and
  converts `failureKind → errorCategory` at persistence time.

This keeps seed→tree→land import direction intact.

## Requirements
- **FR-1**: On success, `costCents` = model price, `costClassification`
  = METERED.
- **FR-2**: On success with unknown model, `costCents` = undefined,
  `costClassification` = UNKNOWN.
- **FR-3**: `retryCount` = `attempts` from `fetchWithRetry`.
- **FR-4**: `requestedAt` captured BEFORE circuit-breaker check,
  `startedAt` captured RIGHT BEFORE `fetchWithRetry` (real processing
  start).
- **FR-5**: On failure, `failureKind` is exposed so the action can map
  it to `errorCategory`.
- **FR-6**: `latencyMs` = total wall time (requested→now), unchanged.

## Related Code Files
- **Modify**: `src/seed/ai/providers/fal-image-provider.ts`
- **Modify**: `src/seed/ai/image-generation-provider.ts` (add optional
  fields to `ImageGenerationResult`)
- **Read**: `src/seed/config/fal-pricing.ts` (Phase 1)
- **Read**: `src/seed/types/creative-job-economics.ts` (CostClassification)

## Implementation Steps
1. In `image-generation-provider.ts`, extend `ImageGenerationResult`
   with optional economic fields: `costCents?`, `costClassification?`,
   `failureKind?`, `retryCount?`, `requestedAt?`, `startedAt?`.
   All OPTIONAL — existing tests don't break.
2. In `fal-image-provider.ts` `generate()`:
   a. Capture `requestedAt = Math.floor(Date.now() / 1000)` at the
      very top (after circuit-breaker check — that's part of the
      request lifecycle).
   b. Resolve `priceCents = getFalModelPriceCents(this.model)`.
   c. Capture `startedAt` right before `fetchWithRetry`.
   d. On success return: `costCents: priceCents`,
      `costClassification: classifyCost(priceCents, false)`,
      `retryCount: attempts`, `requestedAt`, `startedAt`.
   e. On failure (catch block around `fetchWithRetry`): capture
      `failureKind` from the thrown `ImageGenerationError.code` (which
      is a `FailureKind`), plus `retryCount` and timestamps. Re-throw
      an enriched error OR return a failure result. **Decision: enrich
      the thrown `ImageGenerationResult` is not possible (throw aborts
      return). Instead, the action's catch block reads
      `ImageGenerationError.code` (already FailureKind) — so the
      provider does NOT need to change its throw shape. The provider
      just needs to expose `retryCount` and timestamps on success, and
      the action reads `.code` from the caught error for failures.**

   **Simplified**: Provider only enriches the SUCCESS path. The action
   already catches `ImageGenerationError` which carries `.code`
   (FailureKind) and `.retryable`. For retry count on failure, the
   action cannot know attempts from the error alone — so the provider
   MUST expose retryCount even on failure.

   **Final design**: Provider wraps generate() in try/catch internally.
   On failure, instead of re-throwing plain, it throws an
   `ImageGenerationError` (unchanged) BUT the action needs retryCount.
   Add `retryCount` to `ImageGenerationError` as an optional field.
   Provider sets it when constructing the error in `fetchWithRetry`
   (already there) — actually `fetchWithRetry` throws before setting
   it. Cleanest: provider catches, attaches retryCount to the error
   via a new optional property, re-throws. Action reads it.

   **Actual final**: Add optional `retryCount?: number` to
   `ImageGenerationError`. In `fal-image-provider.generate()`, wrap
   `fetchWithRetry` in try/catch; on catch, if
   `err instanceof ImageGenerationError`, set `err.retryCount = lastAttempts`
   (track last attempt count in the provider). Re-throw. This keeps
   the error contract stable while exposing retry count.

## Todo
- [ ] Extend `ImageGenerationResult` with optional economic fields
- [ ] Add optional `retryCount` to `ImageGenerationError`
- [ ] Capture `requestedAt`, `startedAt` in `generate()`
- [ ] Compute `costCents` + `costClassification` on success
- [ ] Attach `retryCount` to thrown error on failure
- [ ] Import `getFalModelPriceCents` from `seed/config/fal-pricing`

## Success Criteria
- Success path returns `costCents = 1` for flux-schnell.
- Success path returns `costClassification = 'METERED'` for known model.
- Success path returns `costClassification = 'UNKNOWN'` for unknown model.
- `retryCount` = number of attempts (1–3).
- `requestedAt` ≤ `startedAt` ≤ `requestedAt + 1` (realistic).
- Failure path: caught error has `retryCount` and `code` (FailureKind).
- Existing tests still pass (optional fields don't break).

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Layer boundary violation (seed→tree) | Provider exposes FailureKind only; action maps. Verified by grep after. |
| `ImageGenerationError` shape change | Add optional field only — all existing `new ImageGenerationError(...)` calls unchanged. |
| Timestamp granularity | Use epoch SECONDS (matches `requested_at` column, other media_jobs rows). |
