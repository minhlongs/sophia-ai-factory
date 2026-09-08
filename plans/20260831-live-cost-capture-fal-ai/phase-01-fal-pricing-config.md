# Phase 1 — Fal Pricing Config (seed)

## Overview
- Priority: HIGH
- Status: PENDING
- Description: Create a seed config module that maps fal.ai model IDs to
  their per-image cost in cents, with an env override for operator updates.

## Key Insights
- Fal.ai does NOT return cost in the API response body — cost must be
  computed client-side from the model ID.
- Published fal.ai pricing (as of 2026-08-31):
  - `fal-ai/flux-schnell`: $0.01/image (4 steps, fastest)
  - `fal-ai/flux/dev`: $0.025/image
  - `fal-ai/flux-pro`: $0.05/image
- These prices are operator-maintained; env override avoids deploys on
  price changes.

## Requirements
- **FR-1**: Map known model IDs → cost in cents (integer).
- **FR-2**: `FAL_PRICING_JSON` env var overrides/extends the static table
  at runtime (parsed once at module load).
- **FR-3**: Unknown models return `undefined` (→ UNKNOWN classification,
  NULL cost) — never throw, never guess.
- **FR-4**: Pure function `getFalModelPriceCents(modelId): number | undefined`.

## Architecture
```
seed/config/fal-pricing.ts
  FAL_MODEL_PRICING: Record<string, number>   // static fallback (cents)
  getFalModelPriceCents(modelId): number | undefined
      1. Check env FAL_PRICING_JSON (parsed once, cached)
      2. Fall back to static table
      3. Return undefined if not found
```

## Related Code Files
- **Create**: `src/seed/config/fal-pricing.ts`
- **Modify**: none
- **Delete**: none

## Implementation Steps
1. Create `src/seed/config/fal-pricing.ts` with:
   - `DEFAULT_FAL_PRICING` constant (flux-schnell: 1, flux/dev: 2.5→25
     wait, use integer cents: flux-schnell=1, flux/dev=25, flux-pro=50 —
     NO: $0.01 = 1 cent, $0.025 = 2.5 cents → must use integer. Round:
     flux-schnell=1, flux/dev=3, flux-pro=5 — document rounding).
     Actually: store as integer cents. $0.01=1¢, $0.025=2.5¢ → round to 3¢,
     $0.05=5¢. Document that fractional-cent prices are rounded UP.
   - Module-level cache for parsed env JSON.
   - `getFalModelPriceCents` pure function.
   - Zod schema for env parsing (defensive — malformed env → log warn,
     fall back to static).
2. Export from barrel if `seed/config/index.ts` exists (check first).

## Todo
- [ ] Create `seed/config/fal-pricing.ts`
- [ ] Add `getFalModelPriceCents` with env override
- [ ] Verify barrel export (if applicable)

## Success Criteria
- `getFalModelPriceCents('fal-ai/flux-schnell')` returns `1`.
- `getFalModelPriceCents('fal-ai/nonexistent')` returns `undefined`.
- Malformed `FAL_PRICING_JSON` → falls back to static, logs warning.
- No throw on missing/unknown model.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Fractional-cent prices | Round UP to nearest cent; document in module header. |
| Env parse failure | Zod validation → fallback to static, warn log. |
