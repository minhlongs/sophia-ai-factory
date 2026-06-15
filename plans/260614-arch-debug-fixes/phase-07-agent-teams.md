# Phase 07: Enable Agent Teams

**Priority:** P1 (Blocks Deploy)  
**Status:** Not Started  
**Estimated Duration:** 2 hours

---

## Context Links

- **Deep Research Report:** Section 3 — "Cấu hình Agent Teams/Harness cho Sophia AI Factory"
- **Deep Research Report:** Section 4 — "Kế hoạch triển khai thực tế" Phase 2
- **CLEO Protocol:** `~/.claude/rules/orchestration-protocol.md` — agent teams experimental flag
- **Subagent Definitions:** `.claude/agents/*.md` (existing C-Level agents)

---

## Overview

Enable Claude Code Agent Teams feature for parallel implementation tasks and verify subagent definitions are correctly sandboxed.

**Why this is needed:**
- CLEO orchestrator spawns C-Level agents for parallel work
- Agent teams allow multiple teammates to collaborate on complex tasks
- Subagent definitions provide reusable roles (CTO, CMO, CSO, COO, Mekong-CLI)
- Current: Experimental feature disabled by default

---

## Key Insights

**From Deep Research:**
- Agent teams are experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- Subagents run in parallel when called concurrently (no teams needed for simple parallelism)
- Teams add value when teammates need to communicate directly
- **No nested teams** — teammates CANNOT spawn sub-teams (design constraint)
- **Token cost:** Linear scaling (3-5 teammates = 3-5x tokens)
- **Worktree isolation:** Requires Node.js >= 24 (already covered in Phase 00)

**Current state:**
- `.claude/settings.json` may not have experimental flag
- `.claude/agents/` exists with C-Level agent definitions (verify)
- C-Level agents likely have correct sandbox (no Write/Bash)

**Target state:**
- `settings.json` includes `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"`
- All C-Level agents have `tools: [Read, Grep, Glob, Skill]` (NO Write/Bash)
- Worktree isolation functional for parallel tasks
- Test run confirms team spawning works

---

## Requirements

### Functional
1. Enable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`
2. Verify/create subagent definitions for:
   - `cto.md` — architecture, code quality, technical decisions
   - `cmo.md` — marketing, campaigns, analytics
   - `cso.md` — customer success, support, onboarding
   - `coo.md` — operations, processes, workflows
   - `mekong-cli.md` — CLI tool development
3. Ensure C-Level agents have NO `Write` or `Bash` tools (sandboxed)
4. Test with a simple parallel review task

### Non-Functional
1. No breaking changes to existing agent definitions
2. Backward compatible — single-agent sessions still work
3. Configuration documented in `docs/agent-teams.md` (if exists)
4. Token cost awareness — use teams only when collaboration needed

---

## Architecture

**Agent vs Team distinction:**

| Feature | Subagent (current) | Agent Team (new) |
|---------|-------------------|------------------|
| Context | Own window, returns to caller | Own window, independent |
| Communication | Report to main only | Teammates message each other |
| Coordination | Main agent manages | Shared task list |
| Nesting | Cannot spawn teams | Cannot spawn teams |
| Best for | Focused tasks | Complex collaboration |

**C-Level Structure (unchanged):**
```
Sophia-Orchestrator (lead, spawns C-Level)
├── CTO (sandbox: Read, Grep, Glob, Skill)
├── CMO (sandbox: Read, Grep, Glob, Skill)
├── CSO (sandbox: Read, Grep, Glob, Skill)
├── COO (sandbox: Read, Grep, Glob, Skill)
└── Mekong-CLI (sandbox: Read, Grep, Glob, Skill)
```

**Worktree Isolation:**
- Each agent gets isolated git worktree under `.claude/worktrees/`
- Changes merged back after completion (no conflicts if non-overlapping files)
- Requires Node.js >= 24 (Phase 00 dependency)

---

## Related Code Files

**Settings:**
- `~/.claude/settings.json` — global Claude Code configuration
- `.claude/agents/cto.md` — CTO agent definition (if exists)
- `.claude/agents/cmo.md` — CMO agent definition
- `.claude/agents/cso.md` — CSO agent definition
- `.claude/agents/coo.md` — COO agent definition
- `.claude/agents/mekong-cli.md` — Mekong-CLI agent definition

**Project-specific agents:**
- `.claude/commands/sophia.md` — Sophia-specific slash commands (may define agents)
- `.claude/agents/` directory in project root (if exists)

**Documentation:**
- `docs/agent-teams.md` or `docs/system-architecture.md` — may need update

---

## Implementation Steps

### Step 1: Enable experimental agent teams flag

Edit `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"
}
```

**If file doesn't exist:** Create with minimal content:
```bash
mkdir -p ~/.claude
cat > ~/.claude/settings.json << 'EOF'
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "in-process"
}
EOF
```

**Verify:** `cat ~/.claude/settings.json | grep CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` should output `"1"`.

### Step 2: Verify existing C-Level agent definitions

Check `.claude/agents/` in project root and home directory:

```bash
# Project-level
ls -la /Users/macbook/projects/sophia-ai-factory/.claude/agents/ 2>/dev/null || echo "No project agents"

# Home-level (if any)
ls -la ~/.claude/agents/ 2>/dev/null || echo "No home agents"
```

**Expected files:** `cto.md`, `cmo.md`, `cso.md`, `coo.md`, `mekong-cli.md` (at least one location)

**If missing:** Create minimal definitions following format:

```markdown
---
name: cto
description: CTO agent for architecture, code quality, technical decisions
model: opus
tools: [Read, Grep, Glob, Skill]
---
System prompt: You are the CTO of Sophia AI Factory...
```

### Step 3: Verify sandbox — NO Write/Bash tools

For each agent definition, check `tools:` array:

```bash
grep -h "tools:" ~/.claude/agents/*.md /Users/macbook/projects/sophia-ai-factory/.claude/agents/*.md 2>/dev/null
```

**Must NOT include:** `Write`, `Bash`, `Edit`, `TaskCreate`, `TaskUpdate` (only orchestrator should have these)

**Allowed:** `Read`, `Grep`, `Glob`, `Skill`, `AskUserQuestion` (read-only operations)

**If Write/Bash found:** Remove them from tools list; C-Level agents should be advisory only.

### Step 4: Test agent teams with simple parallel task

Start Claude Code with teammate mode:

```bash
# From project root
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
claude --teammate-mode in-process
```

In the session, issue:

```
Create a team with 3 teammates to review the billing module.
One focused on security, one on performance, one on test coverage.
Provide findings as a bullet list.
```

**Expected behavior:**
- Team spawns with 3 teammates
- Each teammate reads code independently
- Teammates can message each other (internal)
- Final report synthesized by lead

**If team fails to spawn:** Check settings JSON; verify flag active; restart Claude session.

### Step 5: Document configuration

Update `docs/agent-teams.md` (create if missing):

```markdown
# Agent Teams Configuration

## Enablement

Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`.

## C-Level Agents

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| CTO | Architecture, code quality, technical decisions | Read, Grep, Glob, Skill | opus |
| CMO | Marketing, campaigns, analytics | Read, Grep, Glob, Skill | opus |
| CSO | Customer success, support, onboarding | Read, Grep, Glob, Skill | opus |
| COO | Operations, processes, workflows | Read, Grep, Glob, Skill | opus |
| Mekong-CLI | CLI tool development | Read, Grep, Glob, Skill | opus |

## Usage

- Orchestrator spawns C-Level agents via `/sophia` slash command or explicit `--agent` flag
- Parallel work uses agent teams when collaboration needed
- Worktree isolation enabled (Node.js >= 24 required)

## Constraints

- No nested teams (teammates cannot spawn sub-teams)
- Token costs scale linearly with team size
- Single team active at a time
```

---

## Todo List

- [ ] Check `node --version` >= 24 (Prerequisite from Phase 00)
- [ ] Backup current `~/.claude/settings.json`
- [ ] Add `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to settings
- [ ] Set `teammateMode: "in-process"`
- [ ] Verify `.claude/agents/` exists (project or home)
- [ ] Check each C-Level agent tools array excludes Write/Bash
- [ ] Create missing agent definitions if needed
- [ ] Restart Claude session (if running)
- [ ] Test: spawn team with 3 teammates for billing review
- [ ] Document results in `phase-07-results.md`
- [ ] Update `docs/agent-teams.md` if applicable

---

## Success Criteria

**Definition of Done:**
- `~/.claude/settings.json` has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- All C-Level agent definitions present and sandboxed (no Write/Bash)
- Test team spawns successfully and produces collaborative output
- Configuration documented in `docs/agent-teams.md`

**Validation methods:**
1. `cat ~/.claude/settings.json | grep CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` → outputs `"1"`
2. For each agent: `grep "tools:" .claude/agents/*.md` → `[Read, Grep, Glob, Skill]` only
3. Run test team command → exits 0, output shows 3 teammates working
4. `ls docs/agent-teams.md` → file exists with configuration documented
5. `claude --version` still works; no warnings about invalid config

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent teams experimental instability | Medium | Medium | Test thoroughly before production use; have fallback to single-agent mode |
| Token cost overrun with teams | Medium | Low | Limit team size to 3-5; monitor usage in first week |
| Worktree isolation fails on Node 24 | Low | Medium | Verify Phase 00 succeeded; check `~/.local/share/cleo/worktrees/` created |
| C-Level agent accidentally has Write tool | Low | High | Audit all agent definitions; enforce via pre-commit hook if needed |
| Settings JSON syntax error breaks Claude | Low | Medium | Validate JSON with `jq . ~/.claude/settings.json` before restart |

---

## Security Considerations

- **Sandbox enforcement:** C-Level agents without Write/Bash cannot modify code directly — they only advise
- **Orchestrator privilege:** Only Sophia-Orchestrator has spawn rights (already enforced)
- **Worktree boundaries:** Isolated worktrees prevent cross-agent file conflicts
- **No credential exposure:** Agents run with user's environment; ensure no secrets in prompts

---

## Next Steps

1. After Phase 07 complete → notify Phase 08 (Deploy) ready to proceed
2. Monitor token usage in first team session (track cost vs value)
3. If instability encountered, fallback to single-agent mode (remove flag)
4. Train CEO on when to use teams vs single agent

---

**END OF PHASE 07**
