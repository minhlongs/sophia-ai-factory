# Unified Workflow Steps

All modes share core steps with mode-specific variations.

## Step 0: Intent Detection & Setup

1. Parse input with `intent-detection.md` rules
2. Log detected mode: `✓ Step 0: Mode [X] - [reason]`
3. If mode=code: detect plan path, set active plan
4. Use `TaskCreate` to create workflow step tasks (with dependencies if complex)
5. **Validate mode flags:** If `--auto` + `--parallel` both present, `--auto` wins (stronger autonomy signal). Log: `--parallel ignored, --auto takes precedence`

**Output:** `✓ Step 0: Mode [interactive|auto|fast|parallel|no-test|code] - [detection reason]`

## Step 1: Research (skip if fast/code mode)

**Interactive/Auto:**
- Spawn multiple `researcher` agents in parallel (max 2 if complex)
- Use `/scout:ext` or `scout` agent for codebase search
- Keep reports ≤150 lines
- **Minimum report check:** If report is empty or <50 chars, retry once then escalate

**Parallel:**
- Optional: max 2 researchers if complex

**Output:** `✓ Step 1: Research complete - [N] reports gathered`

### [Review Gate 1] Post-Research (skip if auto mode)
- Present research summary to user
- Use `AskUserQuestion` to ask: "Proceed to planning?" / "Request more research" / "Abort"
- **Auto mode:** Skip this gate. Do NOT call AskUserQuestion in auto mode.

## Step 2: Planning

**Interactive/Auto/No-test:**
- Use `planner` agent with research context
- Create `plan.md` + `phase-XX-*.md` files

**Fast:**
- Use `/plan:fast` with scout results only
- Minimal planning, focus on action

**Parallel:**
- Use `/plan:parallel` for dependency graph + file ownership matrix

**Code:**
- Skip - plan already exists
- Parse existing plan for phases

**Output:** `✓ Step 2: Plan created - [N] phases`

### [Review Gate 2] Post-Plan (skip if auto mode)
- Present plan overview with phases
- Use `AskUserQuestion` to ask: "Validate the plan or approve plan to start implementation?" - "Validate" / "Approve" / "Abort" / "Other" ("Request revisions")
- "Validate": run `/plan:validate` slash command
- "Approve": continue to implementation
- "Abort": stop the workflow
- "Other": revise the plan based on user's feedback
- **Auto mode:** Skip this gate. Do NOT call AskUserQuestion in auto mode.

## Step 3: Implementation

**IMPORTANT:**
- Read plan overview and all phases, use `TaskCreate` to create Claude Tasks for each unchecked item.
- Tasks must be broken down and defined their priority order.
- Tasks can be blocked by other tasks.

**All modes:**
- Use `TaskUpdate` to mark tasks as `in_progress` immediately.
- Execute phase tasks sequentially (Step 3.1, 3.2, etc.)
- Use `ui-ux-designer` for frontend
- Use `ai-multimodal` for image assets
- Run type checking after each file
  - **Lint check:** If `npm run lint` command fails, STOP and report. If lint command not found, report error and use `npx tsc --noEmit` as fallback. Never silently skip lint.

**Parallel mode:**
- Utilize all tools of Claude Tasks: `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList`
- Launch max **4** `fullstack-developer` agents concurrently (M1 16GB constraint)
- When agents pick up a task, use `TaskUpdate` to assign task to agent and mark tasks as `in_progress` immediately.
- **Pre-flight file ownership check:** Before spawning each agent, verify no other in-progress agent owns overlapping files. If overlap detected, serialize (run sequentially).
- Respect file ownership boundaries
- Wait for all parallel agents to complete (barrier sync) before proceeding

**Output:** `✓ Step 3: Implemented [N] files - [X/Y] tasks complete`

### [Review Gate 3] Post-Implementation (skip if auto mode)
- Present implementation summary (files changed, key changes)
- Use `AskUserQuestion` to ask: "Proceed to testing?" / "Request implementation changes" / "Abort"
- **Auto mode:** Skip this gate. Do NOT call AskUserQuestion in auto mode.

## Step 4: Testing (skip if no-test mode)

**All modes (except no-test):**
- Write tests: happy path, edge cases, errors
- Use `tester` agent (max 300s timeout)
- If failures: `debugger` → fix → repeat
  - **MAX 3 debug cycles per test failure.** After 3 cycles: escalate to user (auto mode: log and skip test, proceed with warning).
- **Forbidden:** fake mocks, commented tests, changed assertions

**Output:** `✓ Step 4: Tests [X/X passed]`

### [Review Gate 4] Post-Testing (skip if auto mode)
- Present test results summary
- Use `AskUserQuestion` to ask: "Proceed to code review?" / "Request test fixes" / "Abort"
- **Auto mode:** Skip this gate. Do NOT call AskUserQuestion in auto mode.

## Step 5: Code Review

**Interactive/Parallel/Code/No-test:**
- Use `code-reviewer` agent (180s timeout)
- Interactive cycle (max 3): see `review-cycle.md`
- Requires user approval
- **Parse REVIEW_RESULT block** from output. If missing/malformed, retry once then escalate.

**Auto:**
- Auto-approve if score≥9.5 AND 0 critical (parsed from REVIEW_RESULT block)
- Auto-fix critical (max 3 cycles) — NEVER auto-fix side-effects
- Escalate to user after 3 failed cycles (write to phase-status.json)
- **If REVIEW_RESULT block missing:** Treat as failure, retry once, then abort phase

**Fast:**
- Simplified review, no fix loop
- User approves or aborts

**Output:** `✓ Step 5: Review [score]/10 - [Approved|Auto-approved|Failed]`

## Step 6: Finalize

**All modes:**
1. Spawn `project-manager` subagent → update plan & phase status
   - **Validate completion:** Check returned STATUS block shows `success: true`
   - On failure: retry once, then log warning and continue
2. Spawn `docs-manager` subagent → update `./docs` if changes warrant
   - **Trigger:** Run if any files outside `./docs/` were modified (check git diff)
   - On failure: log warning, continue (non-blocking)
3. `TaskUpdate` → mark all Claude Tasks complete
   - **Validation:** Call `TaskList` and verify all tasks for this phase show `completed`. If any remain `in_progress` or `pending`, mark them complete only if Step 3 output confirms [X/Y] == total tasks.
4. **Git commit (mode-dependent):**
   - **Auto mode:** Auto-commit via `git-manager` subagent (NO user prompt). Parse STATUS block for commit SHA. Verify with `git log -1`.
   - **All other modes:** Ask user if they want to commit via `git-manager` subagent.
5. **Onboarding check (informational):** Log required env vars for project. Do NOT block on missing vars.

**Auto mode:** After Step 6, validate completion before next phase:
```
IF git-manager failed OR project-manager failed OR tasks not all complete:
  → LOG: "Phase [N] incomplete — [reason]"
  → Continue to next phase anyway (do NOT block pipeline)
  → Accumulate warnings for end-of-run report
```

**Others:** Ask user before next phase

**Output:** `✓ Step 6: Finalized - Status updated - Committed` OR `⚠ Step 6: Partial - [details]`

## Mode-Specific Flow Summary

Legend: `[R]` = Review Gate (human approval required)

```
interactive: 0 → 1 → [R] → 2 → [R] → 3 → [R] → 4 → [R] → 5(user) → 6
auto:       0 → 1 → 2 → 3 → 4 → 5(auto) → 6 → validate → next phase (NO stops)
fast:       0 → skip → 2(fast) → [R] → 3 → [R] → 4 → [R] → 5(simple) → 6
parallel:   0 → 1? → [R] → 2(parallel) → [R] → 3(multi-agent≤4) → [R] → 4 → [R] → 5(user) → 6
no-test:    0 → 1 → [R] → 2 → [R] → 3 → [R] → skip → 5(user) → 6
code:       0 → skip → skip → 3 → [R] → 4 → [R] → 5(user) → 6
```

**Key difference:** `auto` mode is the ONLY mode that skips all review gates.
**Auto mode safety:** Auto mode never calls AskUserQuestion. All escalations write to log/phase-status.json and continue.

## Phase Progression Rules (Auto Mode)

```
FOR each phase in plan:
  Run Steps 0-6
  AFTER Step 6:
    - Check if more phases exist
    - IF last phase: run end-of-run report (accumulated warnings, failures)
    - IF not last: proceed to next phase Step 3
  NO phase runs more than once
  IF all phases complete: STOP, present final report
```

**Termination:** After last phase's Step 6, output final report and STOP. Do NOT attempt to start a non-existent Phase N+1.

## Error Propagation Rules

```
subagent failure → log → apply retry policy
  IF retries exhausted:
    auto mode: log to phase-status.json, continue with degraded functionality
    interactive: report to user, offer retry/abort/skip

Step failure (cannot proceed):
  auto mode: log to phase-status.json, skip to next phase
  interactive: AskUserQuestion: retry/skip/abort
```

## Token Budget

```
Before spawning parallel agents:
  IF contextRemaining < 20% of max:
    → WARN: "Token budget low ([X]% remaining)"
    → Reduce parallel agents to 1
  IF contextRemaining < 10% of max:
    → ABORT: "Token budget exhausted"
    → Write partial results, stop workflow
```

## Critical Rules

- Never skip steps without mode justification
- Use `TaskCreate` to create Claude Tasks for each unchecked item with priority order and dependencies.
- Use `TaskUpdate` to mark Claude Tasks `in_progress` when picking up a task.
- Use `TaskUpdate` to mark Claude Tasks `complete` immediately after finalizing the task.
- All step outputs follow format: `✓ Step [N]: [status] - [metrics]`
- **Auto mode NEVER calls AskUserQuestion.** All decisions are deterministic.
- **Every subagent spawn MUST include timeout_ms.**
- **Every subagent result MUST be parsed for structured output block.**
- **Max 4 concurrent fullstack-developer agents** (hardware constraint).
- **Debugger max 3 cycles per test failure** (prevents infinite loops).
