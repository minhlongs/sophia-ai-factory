# Plan: 260722-01 Migration Consolidation — Audit Baseline + Safe Consolidation

## Goal
Produce an executable audit of `apps/sophia-ai-factory/migrations/` and a safe consolidation plan that:
1. surfaces **duplicate-prefix** migrations clearly,
2. references **existing script anchors** (`apply-migrations.sh`, `e2e-bootstrap-d1.sh`),
3. defines a **safe-by-default** do/undo contract that never touches live D1 state.

## Current known signal
- `apps/sophia-ai-factory/migrations/` contains multiple files sharing the same logical order/prefix.
- `scripts/apply-migrations.sh` already hardcodes verification SQL basenames (e.g. `0047-user-purchases-underpaid`, `0087-subscriptions-drop-user-id-fk`, …) which means renaming**carelessly is not safe.
- `wrangler.toml` already declares `migrations_dir = "migrations"`.

## Deliverables
1. `plans/260722-01-migration-consolidation/report.json` — machine-readable audit output.
2. `plans/260722-01-migration-consolidation/plan.md` — this document (accepted plan + execution logs).
3. Decision matrix: for each duplicate group, choose one of:
   - `KEEP` base, `ARCHIVE` duplicate (if D1 already applied base)
   - `MERGE` (only if neither is in D1 applied state)
   - `NEEDS_MANUAL_REVIEW`
