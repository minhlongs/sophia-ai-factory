# Phase 2: Symlink Recovery
**Priority:** High | **Status:** Ready

## Overview
5 broken symlinks in `.claude/rules/` point to `~/.claude/rules/` which has no target files. Additionally, `pilot.md` uses brace-expansion syntax in @file references that doesn't work. This phase creates the missing rule files and fixes the reference.

## Broken Symlinks
| Symlink | Target Status |
|---------|---------------|
| binh-phap-core.md | MISSING |
| binh-phap-cicd.md | MISSING |
| binh-phap-memory-practices.md | MISSING |
| binh-phap-quality.md | MISSING |
| binh-phap-workflow.md | MISSING |

## Files to Create (in ~/.claude/rules/)
1. `binh-phap-core.md` — Core strategic principles
2. `binh-phap-cicd.md` — CI/CD rules for Binh Phap pipeline
3. `binh-phap-memory-practices.md` — Memory/BRAIN integration
4. `binh-phap-quality.md` — Quality gate definitions per phase
5. `binh-phap-workflow.md` — Workflow orchestration patterns

## Files to Modify
- `.claude/commands/pilot.md` — Fix brace expansion on line 104

## Implementation Steps

### Step 1: Create ~/.claude/rules/binh-phap-core.md
Core principles: 4-phase lifecycle, subagent roles, parallel execution rules, YAGNI/KISS/DRY.

### Step 2: Create ~/.claude/rules/binh-phap-cicd.md
CF-direct deploy doctrine, quality gates, pre-commit rules, post-deploy verification.

### Step 3: Create ~/.claude/rules/binh-phap-quality.md
Quality gates per phase: plan (completeness), implement (build+test), verify (evidence), ship (SHA+HTTP).

### Step 4: Create ~/.claude/rules/binh-phap-workflow.md
Sequential chaining, parallel patterns, cross-layer rules (seed→tree→forest→land), state file format.

### Step 5: Create ~/.claude/rules/binh-phap-memory-practices.md
Session start/end protocols, decision recording, context preservation, memory digest usage.

### Step 6: Fix pilot.md line 104
Replace brace expansion:
```
binh-phap-{core,quality,cicd,workflow,memory-practices}.md
```
With explicit list:
```
- `.claude/rules/binh-phap-core.md`
- `.claude/rules/binh-phap-quality.md`
- `.claude/rules/binh-phap-cicd.md`
- `.claude/rules/binh-phap-workflow.md`
- `.claude/rules/binh-phap-memory-practices.md`
```

### Step 7: Verify all symlinks resolve
```bash
for f in .claude/rules/binh-phap-*.md; do
  target=$(readlink "$f")
  if [ ! -f "$target" ]; then
    echo "BROKEN: $f → $target"
    exit 1
  fi
done
echo "All symlinks resolve"
```

## Success Criteria
- [ ] All 5 symlinks resolve (`test -f` passes)
- [ ] Each file has substantive content (>100 lines)
- [ ] pilot.md line 104 uses explicit file list (no brace expansion)
- [ ] cross-layer-orchestration.md `binh-phap-quality.md` reference works
- [ ] No broken symlinks remain in `.claude/rules/`
