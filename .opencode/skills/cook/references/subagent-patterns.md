# Subagent Patterns

Standard patterns for spawning and using subagents in cook workflows.

## Task Tool Pattern

```
Task(subagent_type="[type]", prompt="[task description]", description="[brief]", timeout_ms: [ms])
```

**ALL subagent spawns MUST include `timeout_ms`.** Recommended values:
- Researcher: 120_000 (2 min)
- Scout: 60_000 (1 min)
- Planner: 180_000 (3 min)
- UI/UX Designer: 180_000 (3 min)
- Fullstack Developer: 300_000 (5 min)
- Tester: 300_000 (5 min)
- Debugger: 180_000 (3 min)
- Code Reviewer: 180_000 (3 min)
- Project Manager: 120_000 (2 min)
- Docs Manager: 120_000 (2 min)
- Git Manager: 120_000 (2 min)

**Auto mode:** If a subagent times out, log the failure and escalate to user (do NOT silently continue).

## Timeout Handling Contract

```
spawn → wait(max timeout_ms) → check result
  IF timeout OR empty result:
    LOG: "[type] timed out after [ms]"
    IF auto mode: ABORT phase, write failure to phase-status.json, skip to next phase
    IF interactive: report to user, offer retry/abort
```

## Structured Output Contract

**code-reviewer** MUST return machine-parseable block at end of response:

```
---
REVIEW_RESULT: {"score": 8.5, "criticalCount": 0, "warnings": 2}
---
```

- `score`: number 0-10
- `criticalCount`: integer
- `warnings`: integer
- `suggestions`: integer (optional)

**tester** MUST return:

```
---
TEST_RESULT: {"passed": 142, "failed": 0, "total": 142}
---
```

**All other subagents** MUST return:

```
---
STATUS: {"success": true, "artifacts": ["path/to/file.ts"], "error": null}
---
```

- `success`: boolean
- `artifacts`: array of file paths written
- `error`: string|null

**Parsing rule:** Extract JSON between `---` markers. If missing or malformed, treat as failure.

## Retry Policy

| Subagent | Max Retries | Backoff |
|----------|------------|---------|
| Researcher | 1 | immediate |
| Scout | 1 | immediate |
| Planner | 0 (escalate) | — |
| Fullstack Developer | 1 | immediate |
| Tester | 2 | after fix |
| Debugger | 0 (escalate after 3 debug cycles) | — |
| Code Reviewer | 1 | immediate |
| Project Manager | 1 | immediate |
| Docs Manager | 0 (skip on failure) | — |
| Git Manager | 1 (escalate to manual after) | — |

## Research Phase

```
Task(subagent_type="researcher", prompt="Research [topic]. Report ≤150 lines.", description="Research [topic]", timeout_ms=120_000)
```
- Use multiple researchers in parallel for different topics
- Keep reports ≤150 lines with citations
- If empty report returned → retry once, then escalate

## Scout Phase

```
Task(subagent_type="scout", prompt="Find files related to [feature] in codebase", description="Scout [feature]", timeout_ms=60_000)
```
- Use `/scout:ext` (preferred) or `/scout` (fallback)

## Planning Phase

```
Task(subagent_type="planner", prompt="Create implementation plan based on reports: [reports]. Save to [path]", description="Plan [feature]", timeout_ms=180_000)
```
- Input: researcher and scout reports
- Output: `plan.md` + `phase-XX-*.md` files
- If planner fails → escalate, do NOT proceed

## UI Implementation

```
Task(subagent_type="ui-ux-designer", prompt="Implement [feature] UI per ./docs/design-guidelines.md", description="UI [feature]", timeout_ms=180_000)
```
- For frontend work
- Follow design guidelines

## Testing

```
Task(subagent_type="tester", prompt="Run test suite for plan phase [phase-name]", description="Test [phase]", timeout_ms=300_000)
```
- Must achieve 100% pass rate
- Parse TEST_RESULT block from output
- On failure: invoke debugger (max 3 cycles) then retry tester

## Debugging

```
Task(subagent_type="debugger", prompt="Analyze failures: [details]", description="Debug [issue]", timeout_ms=180_000)
```
- Use when tests fail
- Provides root cause analysis
- **MAX 3 CYCLES per test failure.** After 3 cycles: escalate to user.

## Code Review

```
Task(subagent_type="code-reviewer", prompt="Review changes for [phase]. Check security, performance, YAGNI/KISS/DRY. MUST return REVIEW_RESULT block with score/criticalCount. Return score (X/10), critical, warnings, suggestions.", description="Review [phase]", timeout_ms=180_000)
```
- MUST return structured `REVIEW_RESULT` block
- Parse score and criticalCount for auto-approve threshold

## Project Management

```
Task(subagent_type="project-manager", prompt="Update plan status in [path]. Mark [phase] as DONE. Update roadmap. Return STATUS block.", description="Update plan", timeout_ms=120_000)
```
- Validate STATUS block shows `success: true` before proceeding

## Documentation

```
Task(subagent_type="docs-manager", prompt="Update docs for [phase]. Changed files: [list]. Return STATUS block.", description="Update docs", timeout_ms=120_000)
```
- Return STATUS block
- On failure: log warning, continue (docs update is non-blocking)

## Git Operations

```
Task(subagent_type="git-manager", prompt="Stage and commit changes with conventional commit message. Auto mode: commit without asking. Return STATUS block with commit SHA.", description="Commit changes", timeout_ms=120_000)
```
- Parse STATUS block for `success: true`
- On failure: retry once, then escalate
- Auto mode: commit without user prompt (override SKILL.md "ask user")

## Parallel Execution

```
Task(subagent_type="fullstack-developer", prompt="Implement [phase-file] with file ownership: [files]. Return STATUS block.", description="Implement phase [N]", timeout_ms=300_000)
```
- Launch multiple for parallel phases
- Include file ownership boundaries
- **MAX 4 concurrent agents** (M1 16GB constraint)
- Validate STATUS block from each before proceeding
