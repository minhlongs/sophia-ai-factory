# Architecture Debug Fixes — Plan

## Overview
Ship Sophia AI Factory to CEO following Deep Research Synthesis Report. YAGNI/KISS approach — minimal changes, maximum impact.

## Phases

| Phase | Title | Status | Files |
|-------|-------|--------|-------|
| 0 | Foundation: Node.js 24+ + Quality Gates | pending | `.nvmrc`, CI scripts |
| 1 | Fix OpenClaw fleet executor stub | pending | `spawn-agent-fleet-executor.ts` |
| 2 | Seed default team (QA/Ops/Marketing) | pending | `seed-default-team.ts`, `prompts.ts` |
| 3 | Unify D1 binding access | pending | `client.ts`, callers |
| 4 | Deduplicate multi-agent types | pending | `multi-agent.ts`, `agents-yaml-parser.ts` |
| 5 | Fix NOWPayments IPN secrets | pending | `route.ts` |
| 6 | Verify + review | pending | — |
| 7 | Enable Agent Teams | pending | `.claude/settings.json`, `agents/*.md` |
| 8 | Production Deploy + CEO Handover | pending | `deploy-with-sha.sh`, `wrangler.toml` |

## Batch Strategy

**Critical Path (sequential):**
- Batch 0: Phase 0 (Foundation) — blocks everything
- Batch 1: Phase 7 (Agent Teams) — requires Phase 0 complete
- Batch 2: Phase 8 (Deploy) — requires Phase 0-7 complete

**Parallel work (after Phase 0):**
- Batch A (parallel): Phases 1, 2, 3 — independent buffer fixes
- Batch B (parallel): Phases 4, 5 — independent buffer fixes
- Batch C: Phase 6 — verification after all buffer fixes done
- Batch D: Phase 7 — agent teams config (can overlap with buffer if Phase 0 done)
- Batch E: Phase 8 — deploy + handover (final)

**Dependency graph:**
```
Phase 0 → Phase 7 → Phase 8 (critical path)
   ↓
Phase 1,2,3,4,5 → Phase 6 (buffer fixes)
```

## Key Constraints
- No new files unless necessary
- Update existing files directly
- Maintain backward compatibility
- No breaking changes to public contracts
- Follow existing patterns (4-layer architecture, canonical imports)
- **Ship deadline:** Within 2 days after Phase 0 complete
- **CEO handover:** Simple commands only (deploy, mekong, /sophia)
