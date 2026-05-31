# Cook - Smart Feature Implementation

End-to-end implementation with automatic workflow detection.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/cook <natural language task OR plan path> [flags]
```

**IMPORTANT:** If no flag is provided, the skill will use the `interactive` mode by default for the workflow.

**Optional flags to select the workflow mode:**
- `--interactive`: Full workflow with user input (**default**)
- `--fast`: Skip research, scout→plan→code
- `--parallel`: Multi-agent execution
- `--no-test`: Skip testing step
- `--auto`: Auto-approve all steps (skips review gates, never prompts user)

**Example:**
```
/cook "Add user authentication to the app" --fast
/cook path/to/plan.md --auto
```

## Smart Intent Detection

| Priority | Signal | Detected Mode | Behavior |
|----------|--------|---------------|----------|
| 1 | `--fast` flag | fast | Skip research |
| 2 | `--parallel` flag | parallel | Multi-agent |
| 3 | `--no-test` flag | no-test | Skip testing |
| 4 | `--auto` flag | auto | Auto-approve, no stops |
| 5 | Path to `plan.md` or `phase-*.md` | code | Execute existing plan |
| 6 | "fast", "quick", "rapidly", "asap" | fast | Skip research |
| 7 | "trust me", "auto", "yolo", "just do it" | auto | Auto-approve, no stops |
| 8 | "no test", "skip test", "without test" | no-test | Skip testing |
| 9 | 3+ features OR "parallel" keyword | parallel | Multi-agent |
| 10 | Default | interactive | Full workflow |

**Conflict resolution:** Explicit flags (1-4) override keywords (6-9). `--auto` + `--parallel` → auto wins (stronger autonomy signal).

See `references/intent-detection.md` for detection logic.

## Workflow Overview

```
[Intent Detection] → [Research?] → [Review] → [Plan] → [Review] → [Implement] → [Review] → [Test?] → [Review] → [Finalize]
```

**Default (non-auto):** Stops at `[Review]` gates for human approval before each major step.
**Auto mode (`--auto`):** Skips human review gates, implements all phases continuously. NEVER prompts user.
**Claude Tasks:** Utilize all these tools `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` during implementation step.

| Mode | Research | Testing | Review Gates | Auto-Approve | Parallel Exec |
|------|----------|---------|--------------|--------------|---------------|
| interactive | ✓ | ✓ | **User approval at each step** | ✗ | ✗ |
| auto | ✓ | ✓ | **None (skips all)** | ✓ (score≥9.5) | ✓ (max 4 agents) |
| fast | ✗ | ✓ | **User approval at each step** | ✗ | ✗ |
| parallel | Optional | ✓ | **User approval at each step** | ✗ | ✓ (max 4 agents) |
| no-test | ✓ | ✗ | **User approval at each step** | ✗ | ✗ |
| code | ✗ | ✓ | **User approval at each step** | Per plan | Per plan |

## Step Output Format

```
✓ Step [N]: [Brief status] - [Key metrics]
```

## Blocking Gates (Non-Auto Mode)

Human review required at these checkpoints (skipped with `--auto`):
- **Post-Research:** Review findings before planning
- **Post-Plan:** Approve plan before implementation
- **Post-Implementation:** Approve code before testing
- **Post-Testing:** 100% pass + approve before finalize

**Always enforced (all modes):**
- **Testing:** 100% pass required (unless no-test mode)
- **Code Review:** User approval OR auto-approve (score≥9.5, 0 critical, parsed from structured output)
- **Subagent timeouts:** Every subagent spawn MUST include timeout_ms
- **Finalize (MANDATORY - never skip):**
  1. `project-manager` subagent → update plan/phase status (validate STATUS block)
  2. `docs-manager` subagent → update `./docs` if files outside `./docs/` were modified (non-blocking)
  3. `TaskUpdate` → validate all Claude Tasks complete via TaskList before marking
  4. Commit: auto mode auto-commits; all other modes ask user

## Required Subagents

| Phase | Subagent | Timeout | Notes |
|-------|----------|---------|-------|
| Research | `researcher` (parallel) | 120s | Max 2 if complex |
| Scout | `scout` | 60s | |
| Plan | `planner` | 180s | |
| UI Work | `ui-ux-designer` | 180s | |
| Implementation | `fullstack-developer` | 300s | Max 4 concurrent |
| Testing | `tester`, `debugger` | 300s/180s | Debugger max 3 cycles |
| Review | `code-reviewer` | 180s | Must return REVIEW_RESULT block |
| Finalize | `project-manager`, `docs-manager`, `git-manager` | 120s each | All return STATUS block |

**CRITICAL:** Finalize step is NON-OPTIONAL in ALL modes. You MUST spawn all finalize subagents before completing.

**CRITICAL:** Auto-commit is auto mode's commit behavior. All other modes must ask user.

## Auto Mode Safety Rules

1. **NEVER call AskUserQuestion** — auto mode has no user to answer
2. **NEVER auto-fix side-effects** — schema changes, data deletion, external calls → log + escalate
3. **ALWAYS parse structured output** — REVIEW_RESULT, TEST_RESULT, STATUS blocks
4. **ALWAYS include timeout_ms** on every subagent spawn
5. **Max 4 concurrent agents** — hardware constraint
6. **Debugger max 3 cycles** — prevent infinite fix loops
7. **Token budget check** — abort if <10% context remaining
8. **Phase termination** — STOP after last phase, present final report

## References

- `references/intent-detection.md` - Detection rules and routing logic
- `references/workflow-steps.md` - Detailed step definitions for all modes
- `references/review-cycle.md` - Interactive and auto review processes
- `references/subagent-patterns.md` - Subagent invocation patterns with timeouts and structured output
