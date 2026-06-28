# Phase 05 — Docs Sync (Reflect New Single-Surface Structure)

**Status:** pending | **Assigned:** docs-manager agent (parallel with Phases 01-04)

## Context Links

- [plan.md](./plan.md)
- Predecessor: Phase 04 (delete) deployed and verified GREEN.
- Doc rules: `~/.claude/rules/documentation-management.md`

## Overview

- **Priority:** P3 (cleanup; non-blocking for FREE100 distribution)
- **Status:** pending
- **Effort:** ~30 min
- **Why:** Repo docs reference `apps/sophia-backend` and `apps/sophia-proposal` as if alive. Eliminate stale references and record consolidation in changelog so future agents don't re-discover the dead surfaces.

## Key Insights

- Three doc surfaces likely contain stale refs:
  1. Repo root `README.md`
  2. `apps/sophia-ai-factory/docs/codebase-summary.md`
  3. `apps/sophia-ai-factory/docs/system-architecture.md`
- `apps/sophia-ai-factory/docs/project-changelog.md` needs an entry for the consolidation.
- Sophia-proposal had its own `docs/` — those are deleted in Phase 04, no further action.

## Requirements

### Functional
- Zero references to `apps/sophia-backend` or `apps/sophia-proposal` in remaining docs (except in changelog/historical entries that explicitly call out the deletion).
- New changelog entry dated 2026-05-12 summarizing the consolidation.
- `codebase-summary.md` updated to reflect the single canonical app structure.
- `system-architecture.md` updated if it previously diagrammed three surfaces.

### Non-Functional
- No code mutations.
- Bilingual updates NOT required for internal docs (only client-facing UI is bilingual per `sophia-handover-rules.md`).

## Architecture

No system change. Pure documentation refresh.

## Related Code Files

### Modify
- `README.md` (repo root)
- `apps/sophia-ai-factory/docs/codebase-summary.md`
- `apps/sophia-ai-factory/docs/system-architecture.md`
- `apps/sophia-ai-factory/docs/project-changelog.md` (append entry)

### Possibly Modify
- `apps/sophia-ai-factory/CLAUDE.md` — if it referenced sophia-proposal or sophia-backend, prune.
- Repo root `CLAUDE.md` — same check.
- `TECH_DEBT_TRACKING.md` (root and/or app-level) — close any items that pointed at the now-gone dead surfaces.

### Delete
- None.

## Implementation Steps

1. **Grep audit** — find every doc that still references the deleted apps:
   ```bash
   cd /Users/macbook/projects/sophia-ai-factory
   grep -rn "apps/sophia-backend\|apps/sophia-proposal\|sophia-backend\|sophia-proposal" \
     --include="*.md" \
     . 2>/dev/null \
     | grep -v "node_modules" \
     | grep -v "/plans/" \
     | grep -v "\.next" \
     > /tmp/stale-doc-refs.txt
   cat /tmp/stale-doc-refs.txt | wc -l
   ```
   Output should drive targeted edits in steps 2-5. (Plans dir excluded — historical record is intentional.)
2. **Update root `README.md`** — if it lists the monorepo apps, drop the two deleted entries and note consolidation. Keep brief.
3. **Update `apps/sophia-ai-factory/docs/codebase-summary.md`** — sections describing `apps/*` layout. Replace 3-surface narrative with 1-surface narrative. Note prior consolidation history briefly.
4. **Update `apps/sophia-ai-factory/docs/system-architecture.md`** — if any diagram shows sophia-proposal as a separate service, rebuild diagram (mermaid) showing single Next.js Worker → D1.
5. **Append changelog entry** at top of `apps/sophia-ai-factory/docs/project-changelog.md`:
   ```markdown
   ## 2026-05-12 — Surface Consolidation

   - Removed `apps/sophia-backend/` (Python FastAPI, 1003 LOC, never integrated). Stack mismatch with canonical Next.js/D1. Backup tarball at `~/plans/260429-2040-sophia-consolidation/backups/sophia-factory-mekong-260429.tar.gz`.
   - Removed `apps/sophia-proposal/` (~10,459 LOC, 458 files). DEPRECATED since merge commit `045474da` (2026-03-27). Real gaps (proposals/generate, supporting libs, raas-sdk if applicable) ported into canonical prior to deletion. See `apps/sophia-ai-factory/plans/260512-0951-consolidate-proposal-surfaces/`.
   - Single canonical surface: `apps/sophia-ai-factory/`. Deploy via `npm run deploy:full` (CF-direct, since 2026-05-03).
   ```
6. **Prune CLAUDE.md files** if they reference the deleted surfaces. Keep historical merge note in `apps/sophia-ai-factory/CLAUDE.md` if it explains canon import paths (already there post-consolidation 2026-04-14).
7. **Re-grep** to confirm zero stale refs (exclude `/plans/` and changelog):
   ```bash
   grep -rn "apps/sophia-backend\|apps/sophia-proposal" --include="*.md" . \
     | grep -v "node_modules" | grep -v "/plans/" | grep -v "project-changelog"
   # Expected: 0 lines.
   ```
8. **Commit + push** (docs-only, no deploy needed):
   ```bash
   git add README.md apps/sophia-ai-factory/docs/ apps/sophia-ai-factory/CLAUDE.md CLAUDE.md TECH_DEBT_TRACKING.md 2>/dev/null
   git commit -m "docs: sync after sophia-backend + sophia-proposal removal

   - codebase-summary, system-architecture: 3-surface → 1-surface
   - project-changelog: append 2026-05-12 consolidation entry
   - Remove stale refs from root README + CLAUDE.md files"
   git push origin main
   ```

## Todo List

- [ ] Grep stale refs → `/tmp/stale-doc-refs.txt`
- [ ] Update root `README.md`
- [ ] Update `docs/codebase-summary.md`
- [ ] Update `docs/system-architecture.md`
- [ ] Append `docs/project-changelog.md` entry
- [ ] Prune CLAUDE.md / TECH_DEBT_TRACKING.md refs
- [ ] Re-grep → 0 stale refs (outside plans/changelog)
- [ ] Commit + push docs-only

## Success Criteria

- `grep -rn "apps/sophia-backend\|apps/sophia-proposal" --include="*.md" .` returns ONLY entries inside `plans/` or the new changelog entry.
- Changelog has a dated 2026-05-12 entry summarizing both deletions.
- No diagrams or tables in docs still show 3 surfaces.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Missed a doc file | Med | Step 1 grep covers all `.md`; step 7 re-grep validates |
| Diagram regen requires manual mermaid | Med | Time-box mermaid edits to 10 min; if more complex, ship text-only update and follow up |
| Plans dir refs deleted accidentally | Low | Step 1 excludes `/plans/` — historical record preserved |

## Security Considerations

- None. Docs-only phase.

## Next Steps

- Consolidation plan COMPLETE after Phase 05 commit pushed.
- Optional follow-up: schedule a tarball expiry for the Python backend backup at `~/plans/260429-2040-sophia-consolidation/backups/` — keep until 2026-08-12 (90 days post-removal), then delete.
- Optional follow-up: rotate any API keys that may have been exposed in the deleted Python source's git history (security task; only if Phase 01 step 0 surfaced anything).
