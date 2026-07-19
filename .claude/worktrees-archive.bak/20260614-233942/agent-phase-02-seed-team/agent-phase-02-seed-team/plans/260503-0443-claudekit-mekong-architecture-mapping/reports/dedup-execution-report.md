# Dedup Execution Report

> Date: 2026-05-03 | Decision: Option B (global ClaudeKit canon)

## What ran

| Step | Action | Status |
|------|--------|--------|
| 1 | Audit duplicates: real counts | ✅ 7 skills (1 identical, 6 diverged), 3 commands (all diverged), 14 agents (all identical) |
| 2 | Remove 14 identical stock subagents from `~/mekong-cli/.claude/agents/` | ✅ via `git rm` |
| 3 | Remove identical `document-skills/` (untracked, 130 files) from `~/mekong-cli/.claude/skills/` | ✅ filesystem rm (untracked) |
| 4 | Update `~/mekong-cli/ARCHITECTURE.md` v3.2.0 → v6.0.0 with layered model | ✅ |
| 5 | Ship CI guard `~/mekong-cli/.ci/check-no-duplicate-claudekit.sh` | ✅ — clean run verified |
| 6 | Commit mekong changes (no push — user controls remote) | ✅ commit `3fe2df889` |

## Files changed in mekong-cli

```
M  ARCHITECTURE.md
A  .ci/check-no-duplicate-claudekit.sh
D  .claude/agents/{14 stock agents}.md
D  .claude/skills/document-skills/ (untracked; rm via filesystem)
```

Net delta: +86 lines (CI guard), -1567 lines (deleted stock copies).

## Files NOT touched (deliberate)

- `apps/` — private customer projects; mekong CLAUDE.md forbids commits there.
- `mekong/daemon/` — internal CTO brain; secrets boundary.
- 6 diverged skills + 3 diverged commands — left for manual review.

## Rollback

```bash
cd ~/mekong-cli
git revert 3fe2df889   # restores stock duplicates
```

After revert, CI guard at `.ci/check-no-duplicate-claudekit.sh` will re-fail
until either the duplicates are deleted again OR the canonical files are
moved out of `~/.claude/`.

## Diverged items (action required next sprint)

| Item | Type | Both files differ in |
|------|------|---------------------|
| `climate-tech` | skill | global has `references/`, mekong only `SKILL.md` |
| `common` | skill | `api_key_helper.py` + `api_key_rotator.py` content drift |
| `llm-fine-tuning-mlops` | skill | `SKILL.md` content drift |
| `skill-creator` | skill | global has LICENSE + scripts + references; mekong has `assets/` |
| `spatial-computing` | skill | global has `references/` |
| `vector-database-engineering` | skill | `SKILL.md` content drift |
| `idea.md` | command | content drift |
| `marketing-seo.md` | command | content drift |
| `vercel-debug.md` | command | content drift |

For each, decide: (a) merge into global (claudekit absorbs improvements),
(b) keep mekong override with `Why-override:` header, or (c) revert mekong
to global. Document the choice in the skill/command frontmatter.

## CI guard usage

```bash
# Local pre-commit check
bash .ci/check-no-duplicate-claudekit.sh

# Auto-remove identical duplicates
bash .ci/check-no-duplicate-claudekit.sh --fix

# Add to .husky/pre-commit:
#   bash .ci/check-no-duplicate-claudekit.sh
```

## Unresolved questions

1. Should `.husky/pre-commit` invoke the new CI guard automatically?
2. The 14 stock subagents that were identical — were they ever modified
   inside mekong's lifetime, or just copied at fork time? `git log` per
   file would tell us if any historical override is being lost.
3. Mekong has 384 commands not in global — any candidates worth
   upstreaming into ClaudeKit so other users benefit?
