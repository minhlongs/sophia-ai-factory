# Phase 07: Documentation & Migration Guides

**Priority:** High  
**Duration:** 1 day  
**Owner:** Docs Manager + Architect  

## Context

After major architectural changes, documentation must be updated to reflect the new structure, provide migration guidance, and ensure future developers understand the layer boundaries.

## Architecture Goal

- Accurate, bilingual (VI/EN) documentation for all user-facing and developer-facing materials.
- Clear migration guides for the refactor sprint.
- Updated CLAUDE.md with final import rules and examples.

## Step-by-Step

### 1. Update `apps/sophia-ai-factory/CLAUDE.md`

Add a section summarizing the refactor outcomes:

```markdown
## Post-Refactor Structure (2026-06-19)

### land/video/
- `generation/` — AI pipeline (script → TTS → render)
- `assembly/` — FFmpeg, overlays
- `storage/` — R2 upload, canonical URL
- `publishing/` — 14 platform providers + execute.ts
- `templates/` — video templates

### forest/inngest/functions/
Thin wrappers only:
- `publish-execute.ts` → `land/video/publishing/execute.ts`
- `generate-campaign.ts` → `land/video/generation/campaign-orchestrator.ts`

### forest/missions/
Reorganized: `video/`, `campaign/`, `billing/`, `quota/`, `common/`
```

Also update "Canonical Import Paths" if new public APIs emerged.

### 2. Create Architecture Documentation

New files in `docs/architecture/`:

- `layer-migration-2606.md`: Before/after comparison, 4-layer rationale, feature checklist.
- `publishing-architecture.md`: Video publishing flow, provider pattern.
- `missions-architecture.md`: New missions structure, how to add handlers.

### 3. Write Migration Guides

In `docs/migration/`:

- `refactor-sprint-2606-summary.md`: High-level overview, impact, deprecation timeline.
- `updating-imports-guide.md`: Step-by-step with examples for updating old import paths.

### 4. Update READMEs

- Add `README.md` in `land/video/publishing/providers/` listing all providers.
- Add brief READMEs in `forest/missions/video/` and `campaign/`.

### 5. Bilingual Customer-Facing Docs

Review any customer-facing docs that mention technical architecture; ensure consistency.

### 6. Internal Developer Wiki

Update internal Confluence/Notion pages referencing old structure.

## Verification Commands

```bash
# Check CLAUDE.md updated
grep -q "Post-Refactor Structure" apps/sophia-ai-factory/CLAUDE.md

# Check new docs exist
test -f docs/architecture/layer-migration-2606.md
test -f docs/architecture/publishing-architecture.md
test -f docs/migration/refactor-sprint-2606-summary.md
test -f docs/migration/updating-imports-guide.md

# Optional: validate internal links in docs
grep -rn "\[.*\](" docs/ | grep -v "http" | wc -l
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docs out of sync with code | Medium | Update docs immediately after each code change; cross-check with git diff. |
| Missing migration info for a moved file | Low | Use grep to list all moved files and verify each appears in migration guide. |
| Overwhelming developers | Medium | Provide clear checklist; keep language concise. |

## Rollback

- Documentation changes are non-breaking; edit directly if errors found.
- Maintain `docs/archive/` for superseded docs rather than deleting.

---

**Deliverables Checklist**

- [ ] CLAUDE.md updated with new structure
- [ ] `docs/architecture/layer-migration-2606.md` created
- [ ] `docs/architecture/publishing-architecture.md` created
- [ ] `docs/architecture/missions-architecture.md` created
- [ ] `docs/migration/refactor-sprint-2606-summary.md` created
- [ ] `docs/migration/updating-imports-guide.md` created
- [ ] Provider READMEs added
- [ ] All verification commands pass
