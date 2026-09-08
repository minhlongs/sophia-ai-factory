# Live Cost Capture — Fal.ai Job Lifecycle

> Wire real provider cost, error category, retry count, and precise
> timestamps into the Fal.ai creative job lifecycle so the economic
> control loop (SUPREME COMMAND #9) sees real data instead of NULL.

## Status: PLAN — awaiting execution

## Context

SUPREME COMMAND #9 shipped the economic control loop (commit `0104cfdcf`,
migration 0269). The loop can answer 7 operational questions — but today
every `media_jobs` row for fal.ai has `provider_cost = NULL`,
`cost_classification = UNKNOWN`, `error_category = NULL`, `retry_count = NULL`,
and `requested_at = started_at` (no real processing-start split).

The loop is structurally complete but starved of real data.

This slice wires the actual Fal.ai job lifecycle so real cost flows in.

## Verified Starting State

- Local SHA: `38c0a890f` (commit on top of `0104cfdcf`)
- Working tree: dirty with concurrent-session work (R2 persist, credit
  deduction, usage tracking, `fal-image-fetch.ts` split). This plan
  builds ON TOP of that work — does not redo it.
- Migration 0269 already added economic columns to `media_jobs`.
- `error-category-mapper.ts` already maps `FailureKind → ErrorCategory`.
- `creative-job-economics.ts` already has `classifyCost`, `ErrorCategory`,
  `CostClassification`.
- `fal-image-fetch.ts` already exposes `classifyError`, `classifyHttpStatus`,
  `FailureKind`, `fetchWithRetry` (returns `{ result, attempts }`).

## User Decisions (confirmed this session)

1. **Cost model**: Static env-backed price table (no runtime pricing API).
2. **Failed jobs**: Record them (`status = 'failed'` + `error_category`),
   not just return `{ success: false }`.

## Architecture

```
FalImageProvider.generate()
  │
  ├─ resolve model price from FAL_MODEL_PRICING (seed config, env-overridable)
  ├─ record requestedAt (before circuit-breaker check)
  ├─ fetchWithRetry() → { result, attempts }
  │     └─ on throw: classify → FailureKind, capture retryCount
  ├─ compute costCents = modelPriceCents (METERED)
  ├─ return enriched ImageGenerationResult:
  │     costCents, costClassification, failureKind (on failure path),
  │     retryCount, requestedAt, startedAt
  │
  ├─ image-generate-action.ts (caller 1 — UI server action)
  │     └─ maps FailureKind→ErrorCategory, persists all economic columns
  │
  └─ route.ts (caller 2 — API route, Telegram bot / external clients)
        └─ maps FailureKind→ErrorCategory, persists all economic columns
```

### Key Design Rules

- **UNKNOWN cost stays NULL** — never numeric zero (Economic Truth Model).
- **METERED only when we have a price in the table** — otherwise UNKNOWN.
- **Gross margin stays NULL** — revenue attribution is not in this slice.
- **Failure recording is non-throwing** — a failed-D1-insert must not mask
  the original provider error response to the user.
- **No new runtime dependency** — price table is a seed config constant,
  overridable via `FAL_PRICING_JSON` env var.

## File Ownership

| Phase | Files | Owner |
|---|---|---|
| 1. Price table | `src/seed/config/fal-pricing.ts` (NEW) | this plan |
| 2. Provider enrichment | `src/seed/ai/providers/fal-image-provider.ts` | this plan |
| 3. Failure-result type | `src/seed/ai/image-generation-provider.ts` | this plan |
| 4. Persistence (2 callers) | `src/app/actions/image-generate-action.ts` AND `src/app/api/v1/creative-studio/images/generate/route.ts` | this plan |
| 5. Tests | `src/seed/ai/providers/__tests__/fal-image-provider.test.ts` + `src/seed/config/__tests__/fal-pricing.test.ts` | this plan |

**Two callers — both must be wired.** Verified by grep: `FalImageProvider.generate()` is called from
both `image-generate-action.ts:127` and `route.ts:97`. The route is the Telegram-bot / API-consumer
path and is live in production. Both share the same gap (NULL cost on success, no failure row),
so both get the same persistence fix. Wiring only the action would leave the economic loop
starved for half the fal.ai traffic.

No other phases touch these files concurrently.

## Phases

- [ ] Phase 1 — Fal pricing config (seed)
- [ ] Phase 2 — Provider lifecycle enrichment
- [ ] Phase 3 — Failure-result type extension
- [ ] Phase 4 — Action persistence (success + failure)
- [ ] Phase 5 — Tests + regression

## Success Criteria

- [ ] A successful fal.ai job writes `provider_cost` = model price (cents),
  `cost_classification = 'METERED'`, `cost_currency = 'USD'`.
- [ ] A failed fal.ai job writes a `media_jobs` row with
  `status = 'failed'`, `error_category` mapped from `FailureKind`,
  `retry_count`, `latency_ms`.
- [ ] `retry_count` reflects actual attempts (1 = no retry, 3 = exhausted).
- [ ] `requested_at` ≠ `started_at` in real usage (requested before
  circuit-breaker check, started before fetch).
- [ ] Unknown/unpriced models → `provider_cost = NULL`, classification
  `UNKNOWN` (never zero).
- [ ] `npm run build` 0 errors, `npm test` all pass.
- [ ] No provider secrets in errors or logs.

## Risks

| Risk | Mitigation |
|---|---|
| Dirty tree with concurrent work | Build on top of it; do not stash. Verify at end with full test suite. |
| Price table staleness | Env-overridable `FAL_PRICING_JSON`; documented update path. |
| Failure-insert masks original error | Insert is best-effort logged; original error still returned to user. |
| `ImageGenerationResult` shape change breaks other callers | TWO callers (`image-generate-action.ts` + `route.ts`); both wired in Phase 4. Optional fields keep other consumers safe. |
