# OpenMontage Patterns → Sophia AI Factory
**Source:** calesthio/OpenMontage (Python video pipeline)
**Target:** sophia-ai-factory (Next.js 16 + D1 + CF Workers)
**Mode:** `--port` — rewrite idiomatically for Sophia stack

## Phases

| # | Phase | Effort | Status | Depends |
|---|-------|--------|--------|---------|
| 01 | checkpoint-stepper | 3-5d | pending | — |
| 02 | delivery-promise | 2-3d | pending | 01 |
| 03 | provider-scoring | 4-6d | pending | 02 |

## Key Findings from Deep Research
- Sophia có `checkpoint_json` column (migration 0141) nhưng 0 code references
- `engine_missions` table thiếu checkpoint columns
- `compute-next.ts` là pure state machine — perfect cho checkpoint serialization
- LLM cost tracker in-memory only, resets on cold-start
- No delivery promise, no provider scoring
