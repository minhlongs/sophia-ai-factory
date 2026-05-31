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

**Auto mode:** If a subagent times out, log the failure and proceed (do NOT silently continue, do NOT escalate — there is no user in auto mode).

## Timeout Handling Contract

```python
spawn → wait(max timeout_ms) → check result
IF timeout OR empty result:
  LOG: "[type] timed out after [ms]"
  IF first timeout: retry once (same prompt, same timeout)
  IF retry also times out OR auto mode:
    → ABORT phase
    → Write failure to phase-status.json: {"phase": N, "status": "timeout", "subagent": "[type]", "timestamp": "ISO8601"}
    → Skip to next phase (do NOT block entire workflow)
    → In interactive mode: report to user, offer retry/abort/skip
```

**CRITICAL:** In auto mode, NEVER "escalate to user" — there is no user. All failures write to phase-status.json and continue.

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


**STATUS post-parse validation:**
1. Consistency: if `error` is non-null → `success` MUST be false (if violated, log contradiction warning)
2. Artifact check for code agents (fullstack-developer, git-manager): if `success` is true AND `artifacts` is empty → WARN "possible silent failure"
3. For fullstack-developer: verify artifact paths exist (fs.exists or equivalent)
4. For git-manager: verify commit SHA in artifacts matches `git log -1 --format=%H`

## Parsing Rule

**Algorithm for extracting structured blocks from subagent responses:**

```python
def extractBlocks(response):
  blocks = []
  inCodeFence = False
  fenceChar = None
  currentBlock = None
  for line in response.split("\n"):
    # Track markdown code fences
    if line.strip().startswith("```"):
      inCodeFence = not inCodeFence
      fenceChar = line.strip()[3:]
      continue
    if inCodeFence:
      continue
    # Track --- delimiters (outside code fences)
    if line.strip() == "---":
      if currentBlock:
        blocks.append(currentBlock)
        currentBlock = None
      continue
    if currentBlock is not None:
      currentBlock += line + "\n"
    elif currentBlock is None and line.strip():
      currentBlock = line + "\n"
  # Don't forget last block (no trailing ---)
  if currentBlock:
    blocks.append(currentBlock)
  return blocks

def findBlock(blocks, blockType):
  matching = [b for b in blocks if b.startswith(blockType)]
  if not matching:
    return None  # PARSE_FAILURE
  return matching[-1]  # last occurrence if multiple
```

**Expected block types per subagent type:**

| Subagent | Expected Block |
|----------|---------------|
| code-reviewer | REVIEW_RESULT |
| tester | TEST_RESULT |
| All others | STATUS |

On PARSE_FAILURE: retry once with explicit instruction, then per retry policy.


**Post-parse validation (MANDATORY for all block types):**
1. Type check each field against expected type
2. Range check: score ∈ [0, 10], counts ∈ [0, ∞)
3. If validation fails → treat as malformed → retry once → if still failing, per retry policy

**Type coercion rules:**
- `score`: cast to float, clamp to [0, 10]
- `criticalCount`, `warnings`, `suggestions`: cast to int, floor at 0
- `passed`, `failed`, `total`: cast to int, floor at 0
- `success`: must be bool (not truthy string)
- `error`: must be str or null
- `artifacts`: must be list of strings

## Retry Policy

| Subagent | Max Retries | Backoff | Auto Mode Behavior |
|----------|------------|---------|-------------------|
| Researcher | 1 | immediate | On retry fail: log to phase-status.json, proceed without research |
| Scout | 1 | immediate | On retry fail: log, proceed with cached context |
| Planner | 0 (escalate) | — | Abort phase, log to phase-status.json |
| Fullstack Developer | 1 | immediate | On retry fail: abort phase, log |
| Tester | 2 | after fix | On retry fail: abort phase, log, proceed with warning |
| Debugger | 0 (escalate after 3 debug cycles) | — | Part of debug cycle limit (max 3 per failure, 9 per phase) |
| Code Reviewer | 1 | immediate | On retry fail: abort phase, log, approve with warning |
| Project Manager | 1 | immediate | On retry fail: log warning, continue (non-blocking) |
| Docs Manager | 0 (skip on failure) | — | Log warning, continue (non-blocking) |
| Git Manager | 1 (escalate to manual after) | — | On retry fail: log, skip auto-commit, proceed |

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

**TEST_RESULT consistency check:**
After parsing, verify: `total == passed + failed`.
If mismatch:
→ Log: "TEST_RESULT inconsistency: {passed}+{failed}!={total}"
→ Retry once with correction instruction
→ If retry fails: abort test phase, log to phase-status.json

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
```python
# Agent concurrency control (MANDATORY)
activeAgents = 0
MAX_CONCURRENT = 4

def spawnAgent(agentFn):
  global activeAgents
  WHILE activeAgents >= MAX_CONCURRENT:
    WAIT for any agent to complete (decrement activeAgents)
  activeAgents += 1
  spawn agent
  # On completion/timeout: activeAgents -= 1
```
- Launch multiple for parallel phases
- Include file ownership boundaries
- **MAX 4 concurrent agents** (applies to ALL agent types, M1 16GB constraint)
- Validate STATUS block from each before proceeding
- **Enforcement:** Track active agent count. Never exceed 4 concurrent regardless of agent type.
