# Execution Checklist — Migration Consolidation Phase 1

## Pre-flight (owner must do)
1. Confirm D1 database name and wrangler access.
2. Do NOT modify production D1 state during cleanup.
3. Baseline `d1_migrations` rows are source of truth.

## Phase 1 — Document + Archive Only (no renames yet)
- [ ] P1-1: Review `decision-matrix.md` and confirm keep/archive decisions.
- [ ] P1-2: Archive duplicate files to `migrations/_archive/YYYY-MM-DD-N/` preserving originals.
- [ ] P1-3: Update `apply-migrations.sh` verification registry for any renamed canonical files.
- [ ] P1-4: Run `apply-migrations.sh HEAD~1` against a **staging** D1; it should detect no new pending canonical migrations for duplicates.
- [ ] P1-5: Gate — require human review before moving to rename phase.

## Out of scope for now
- Renaming/moving any migration file that has a matching D1 applied state.
- Applying changes to production D1.
