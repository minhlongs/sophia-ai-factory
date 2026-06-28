# Phase 2: Tier 1 Integration (MUST HAVE)

**Priority**: CRITICAL
**Status**: IN_PROGRESS
**Phase**: core

---

## Context Links

- Plan: `./plan.md`
- Script: `~/mekong-cli/scripts/power-source-syncer.sh`
- Tier 1 Sources: SuperClaude, Zen MCP, Repomix, OpenCode

---

## Overview

Integrate the "Must Have" Tier 1 power sources. This involves ensuring they are synced, analyzing their content, and "transforming" them into the AgencyOS DNA system (creating reference markers and mapping them to Binh Pháp chapters).

---

## Key Insights

- **SuperClaude**: Provides cognitive personas. We need to analyze its structure and maybe link its prompts.
- **Zen MCP**: Multi-model orchestration. We should check if we can run it or use its patterns.
- **Repomix**: Repo packaging. Useful for sending context to LLMs.
- **OpenCode**: Ultrawork mode.
- **Transformation**: modifying the source files breaks `git pull`. We should instead create **Shadow DNA** - a separate metadata layer or a `DNA_README.md` that links to the raw files but contains the AgencyOS DNA headers and context.

---

## Requirements

### Functional
- Verify all Tier 1 sources are cloned (Done in Phase 1).
- Apply "DNA Transformation" (add metadata/headers without breaking git).
- Create a "Shadow DNA" index for each source.
- Analyze capabilities of each source.

### Non-Functional
- No interference with `git pull` updates.
- Clear mapping to Binh Pháp.

---

## Architecture

We will add a `transform_tier1()` function to `power-source-syncer.sh` that:
1.  Verifies the repo exists.
2.  Generates a `AGENCYOS_DNA.md` file in the repo root (safe from git conflicts usually, or we git-ignore it if we can, but we can't easily modify .gitignore).
3.  Alternatively, we keep transformation external: Create `~/mekong-cli/docs/external-sources/tier1/superclaude.dna.md` which references the raw source.

**Decision**: We will create `AGENCYOS_DNA.md` in the repo root. If `git pull` complains, we handle it (stash/pop or reset).

---

## Implementation Steps

### 1. Update power-source-syncer.sh
- Add `transform_source()` function.
- Creates `AGENCYOS_DNA.md` with:
    - Origin URL
    - Tier
    - Binh Pháp Chapter
    - Timestamp
    - "Spies" analysis (what is this source good for?)

### 2. Deep Dive Analysis (Tier 1)
- **SuperClaude**: Read README/docs, identify key prompts/personas.
- **Zen MCP**: Check installation steps.
- **Repomix**: Test running it.
- **OpenCode**: Analyze `ultrawork` capabilities.

### 3. Update Integration Log
- Log the successful "DNA binding" of these sources.

---

## Todo List

- [ ] Update `power-source-syncer.sh` with `transform_source`
- [ ] Run transformation for Tier 1
- [ ] Analyze SuperClaude content
- [ ] Analyze Zen MCP content
- [ ] Analyze Repomix content
- [ ] Analyze OpenCode content
- [ ] Create `reports/tier1-analysis.md`

---

## Success Criteria

- ✅ `AGENCYOS_DNA.md` present in all 4 Tier 1 repos.
- ✅ Report generated detailing the capabilities of each.
- ✅ Script runs idempotently (updates DNA file without error).

---

## Next Steps

- Execute Phase 3 (Tier 2 Integration)
