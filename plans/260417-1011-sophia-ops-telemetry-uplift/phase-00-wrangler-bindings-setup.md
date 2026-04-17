# Phase 0 — Wrangler Bindings Setup (LEAD ONLY)

## Context Links
- `apps/sophia-ai-factory/wrangler.toml`
- Reports: `plans/reports/synthesis-260417-1011-sophia-claudekit-mekong-mapping.md`

## Overview
- **Priority:** P0 BLOCKER (must finish before Phases 1/4 start)
- **Status:** complete
- **Owner:** lead (NOT a parallel task)
- **Effort:** 0.5h
- Single sequential touch on `wrangler.toml` — eliminates parallel-edit conflict between Phase 1 (D1) and Phase 4 (KV).

## Key Insights
- D1 binding `DB` (sophia-raas-db, id 78bd1961-…) ALREADY exists. No change needed for Phase 1.
- `EXPERIMENT_KV` namespace ALREADY exists (id c3857792…). Phase 4 reuses this — **no new KV namespace required**.
- Cron block already has 9 entries; Phase 3 reuses existing Mon 06:00 UTC slot (do NOT add a new cron — extend the route handler instead).

## Requirements
- Confirm bindings present; add ONLY missing pieces.
- Add `[[migrations]]` block reference for new D1 migration in Phase 1 (place file in `apps/sophia-ai-factory/migrations/`, NOT `.wrangler/migrations/` — Sophia convention per `migrations/0001-init.sql`).
- Document binding inventory in this file (post-execution) for downstream agents.

## Architecture
Single config file edit, committed atomically before parallel split.

## Related Code Files
- **Modify:** `apps/sophia-ai-factory/wrangler.toml` (only if missing bindings — likely no-op)
- **Create:** none
- **Delete:** none

## Implementation Steps
1. Read `apps/sophia-ai-factory/wrangler.toml` end-to-end.
2. Verify `DB` D1 binding present → confirmed (existing).
3. Verify `EXPERIMENT_KV` KV binding present → confirmed (existing).
4. If both present: commit a NO-OP touch comment block `# === ITER-260417-1011-BINDINGS-VERIFIED ===` to mark synchronization point, OR skip the commit entirely and just unblock downstream phases.
5. Post message in plan.md status: "Phase 0 verified — Phases 1/2/4/5 cleared to start parallel."

## File Ownership (Parallel Mode)
- **Owns exclusively:** `apps/sophia-ai-factory/wrangler.toml`
- After Phase 0 completes, NO other phase touches this file.

## Dependencies
- **Blocks:** Phase 1, 2, 3, 4, 5
- **Blocked by:** none

## Todo List
- [x] Read `wrangler.toml` and audit bindings
- [x] Confirm D1 `DB` binding
- [x] Confirm KV `EXPERIMENT_KV` binding
- [x] Mark phase complete + signal downstream

## Success Criteria
- All required bindings exist; no merge conflicts possible on `wrangler.toml` from parallel phases.

## Risk Assessment
- Low: read-only verify in best case. Worst: 1-line append + commit.

## Security Considerations
- No secret values in `wrangler.toml`. Secrets live in CF env / GH Actions secrets.

## Next Steps
- Signal Phases 1/2/4/5 to start in parallel.
