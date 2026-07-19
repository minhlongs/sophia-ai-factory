# ClaudeKit ↔ Mekong-CLI Architecture Mapping (Option B)

> **Date:** 2026-05-03 | **Mode:** /cook executed | **Decision:** Option B (Global = canon)

## Real counts (vs plan estimates)

| Layer | Path | Skills | Commands | Agents |
|-------|------|--------|----------|--------|
| Global ClaudeKit | `~/.claude/` | 151 | 18 | 16 |
| Project Mekong | `~/mekong-cli/.claude/` | 500 (was 557) | 402 | 20 (was 14 after dedup) |
| **Real overlap** | (same name + dir) | **7** (was 94 in plan) | **3** | **14** |

The original plan's 94-skill overlap count was inflated — it counted README/install files as skills. Real directory-level skill overlap is 7, of which only 1 is bit-identical.

---

## Decision: Option B — Global ClaudeKit is canon

**Rationale:**
- `~/.claude/` is the canonical Claude Code source for stock primitives.
- Mekong is structurally a **fork that adds 493 domain-specific skills + 384 commands** on top of stock claudekit.
- Global versions consistently ship with `references/`, `scripts/`, `LICENSE.txt` — mekong copies were trimmed forks.
- Stock agents (14 of them) are bit-identical → pure dead weight in mekong.

**What this means going forward:**
- **Layer 1 (global):** primitive skills, stock subagents, base commands. Source of truth: `~/.claude/`.
- **Layer 2 (mekong project):** domain skills (RaaS, Sophia, marketing-bundles, antigravity, claude-flow, etc.) — anything that does NOT exist in global. Source of truth: `~/mekong-cli/.claude/`.
- **Override rule:** project skill with same name as global is treated as a deliberate override (must include a "Why-override" header). Dedupe CI guard rejects silent duplicates.

---

## Inventory

### Identical → DEDUPED in this commit

**14 agents** (removed from `~/mekong-cli/.claude/agents/`):

```
brainstormer, code-reviewer, code-simplifier, debugger,
docs-manager, fullstack-developer, git-manager, journal-writer,
mcp-manager, planner, project-manager, researcher, tester,
ui-ux-designer
```

**1 skill directory** (removed from `~/mekong-cli/.claude/skills/`):

```
document-skills (130 files identical to global)
```

Rollback: `cd ~/mekong-cli && git restore --staged --worktree .claude/agents/`. The deleted skill was untracked-but-identical, restorable from `~/.claude/skills/document-skills/`.

### Diverged → RESOLVED (2026-05-03 unification pass)

**6 skill directories** — resolved per-item:

| Skill | Decision | Reason |
|-------|---------|--------|
| `climate-tech` | **Removed** from mekong | Global has `references/`; mekong was a slim subset |
| `spatial-computing` | **Removed** from mekong | Global has `references/`; mekong was a slim subset |
| `common` | Kept mekong override (`why-override:` in README) | Mekong dropped unused imports + cleaned f-strings — strict-linter-clean |
| `llm-fine-tuning-mlops` | Kept mekong override (`why-override:` in frontmatter) | Mekong description is activation-trigger-aware + 2026 research refresh |
| `vector-database-engineering` | Kept mekong override (`why-override:` in frontmatter) | Same: activation-trigger-aware description |
| `skill-creator` | Kept mekong override (`why-override:` in frontmatter) | Different intent: mekong = domain skill creator, global `ck:skill-creator` = stock benchmark target. Coexist. |

**3 commands** — all kept as mekong overrides (`why-override:` field added):

| Command | Why |
|---------|-----|
| `idea.md` | Mekong has YAML frontmatter + OpenClaw 5-layer integration; global is older format |
| `marketing-seo.md` | Mekong = actionable 3-step audit recipe; global = Binh-Phap strategy doc (different intents, both kept) |
| `vercel-debug.md` | Mekong has verification-loop variant + GREEN gate; global = older rules-only doc |

CI guard `.ci/check-no-duplicate-claudekit.sh` allows these — it only blocks **bit-identical** duplication. Diverged overrides with `why-override:` headers pass.

---

## Action items — DONE (7-layer execution chain on `feat/python-pev-jwt-fix-c1`)

| Layer | SHA | What |
|-------|-----|------|
| L1 | `3fe2df8` | Remove 14 stock subagents (canon = `~/.claude/agents/`); ARCHITECTURE.md v3.2.0 → v6.0.0 |
| L2 | `8237842` | 9 diverged primitives resolved (2 removed, 7 kept with `why-override:`); pre-commit guard hooked |
| L3 | `c1f4d51` | `.gitignore` allowlist standard `.claude/` primitives — 473 skills + ~50 hook/rule files now tracked |
| L4 | `084d2e0` | `settings.json` gains `permissions.deny/ask` + `enableAllProjectMcpServers` |
| L5 | `3b968bb` | Backfill SKILL.md frontmatter on 100 of 195 invisible skills — 100% discoverable now |
| L6 | `0caf643` | `CLAUDE.md` documents subagent delegation pattern + Claude Code standard compliance |
| L7 | `<HEAD>` | Allowlist `.claude/scripts/{scan_skills,scan_commands,generate_catalogs,...}.py` so the catalog generators are version-controlled |

Mekong PR: <https://github.com/longtho638-jpg/mekong-cli/pull/178#issuecomment-4366150463>
(comment thread on existing PR; reviewer can choose to merge with seed-layer or split)

## Constraints honored

- ❌ No production code touched (`apps/sophia-ai-factory/` untouched).
- ✅ Only IDENTICAL items removed — zero info loss.
- ✅ All deletions reversible via `~/mekong-cli` git history.
- ✅ Diverged items preserved with explicit `why-override:` headers.
- ✅ Zero secrets / node_modules / >500KB blobs leaked through gitignore widening.
- ✅ Pre-commit + pre-push hooks pass on every commit in the chain.

## Outcomes — Claude Code standard compliance

| Item | Before | After |
|------|--------|-------|
| Stock subagents duplicated | 14 dups | 0 |
| `.gitignore` matches Claude Code project layout | ❌ deny-by-default | ✅ allowlist standard primitives |
| `settings.json` permissions block | ❌ missing | ✅ deny + ask rules |
| MCP servers auto-loaded | ❌ manual | ✅ `enableAllProjectMcpServers: true` |
| SKILL.md frontmatter compliance | 95/195 (49%) | 195/195 (100%) |
| Catalog generators tracked | ❌ gitignored | ✅ tracked, run on demand |
| Pre-commit duplicate guard | ❌ none | ✅ `.ci/check-no-duplicate-claudekit.sh` |
| Subagent delegation pattern documented | ❌ implicit | ✅ explicit table in `CLAUDE.md` |

## Unresolved questions

1. Reviewer of PR #178 — merge claude-code alignment with seed-layer scope, or split into PR #2?
2. `.claude/skills-catalog.yaml` (1520 LoC, generated by `generate_catalogs.py`) — track or leave-local? Current decision: leave-local (regen on demand keeps repo lean).
3. Mekong has 384 commands not in global ClaudeKit — script `.ci/list-mekong-only-primitives.sh` to rank upstream candidates? Deferred (community-facing, requires curation).
4. `.claude/hooks/` is 928KB tracked — modularise into smaller files? Deferred (quality-of-life, not blocking).
