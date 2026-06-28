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
4b. **Pre-commit safety check (auto mode):** Before git-manager spawns, run `git status --porcelain`. IF any files are staged from a PREVIOUS phase (check git log for last phase's commit SHA), stash or reset them. Only commit files modified since last commit. Parse STATUS block for commit SHA, verify with `git log -1 --name-only` that only current phase files are included.
5. **Dirty-tree check (auto mode):** After git-manager completes, run `git status --porcelain`. If uncommitted changes exist, those are new files from the current phase — verify they belong to the current phase only. Do NOT proceed to next phase with a dirty tree.

## Required Subagents

| Phase | Subagent | Timeout | Notes | Auto Mode Behavior |
|-------|----------|---------|-------|-------------------|
| Research | `researcher` (parallel) | 120s | Max 2 if complex | On timeout: 1 retry → skip research, log |
| Scout | `scout` | 60s | | On timeout: 1 retry → proceed with cached context |
| Plan | `planner` | 180s | | On timeout: abort phase, log |
| UI Work | `ui-ux-designer` | 180s | | On timeout: 1 retry → skip UI, log |
| Implementation | `fullstack-developer` | 300s | Max 4 concurrent | On timeout: 1 retry → abort phase, log |
| Testing | `tester`, `debugger` | 300s/180s | Debugger max 3 cycles | Tester timeout: 2 retries → abort, log. Debugger: part of cycle limit |
| Review | `code-reviewer` | 180s | Must return REVIEW_RESULT block | On timeout/parse fail: 1 retry → abort phase, log |
| Finalize | `project-manager`, `docs-manager`, `git-manager` | 120s each | All return STATUS block | PM: 1 retry. Docs: skip on fail. Git: 1 retry → skip commit |

**CRITICAL:** Finalize step is NON-OPTIONAL in ALL modes. You MUST spawn all finalize subagents before completing.

**CRITICAL:** Auto-commit is auto mode's commit behavior. All other modes must ask user.

## Auto Mode Safety Rules

1. **NEVER call AskUserQuestion** — auto mode has no user to answer
2. **NEVER auto-fix side-effects** — schema changes, data deletion, external calls → log + escalate
3. **ALWAYS parse structured output** — REVIEW_RESULT, TEST_RESULT, STATUS blocks
4. **ALWAYS include timeout_ms** on every subagent spawn
5. **Max 4 concurrent agents** — hardware constraint. Track with counter: increment on spawn, decrement on completion/timeout. Before spawning: IF count >= 4, WAIT for completion. Applies to ALL agent types (not just fullstack-developer). The M1 16GB constraint caps total concurrent subagents at 4.
6. **Debugger max 3 cycles** — prevent infinite fix loops
7. **Token budget check** — abort if <10% context remaining
8. **Phase termination** — STOP after last phase, present final report
9. **Subagent timeout in auto mode = ABORT phase, write to phase-status.json, skip to next phase.** NEVER "escalate to user" in auto mode — there is no user. All failures write to phase-status.json and continue.
10. **Structured output parsing — mandatory retry with fallback.** Every subagent result must contain a structured output block (REVIEW_RESULT/TEST_RESULT/STATUS). If missing or malformed: retry once with explicit block instruction. If retry fails: treat as subagent failure per rule 9.

## Structured Output Parsing Rules

Every subagent result MUST be parsed for structured output:

- `code-reviewer` → `REVIEW_RESULT` block
- `tester` → `TEST_RESULT` block
- all others → `STATUS` block

**Parsing algorithm:**

1. Find ALL `---` delimited blocks in response (ignore blocks inside markdown code fences)
2. Scan each for expected block type
3. If multiple blocks of same type: use the LAST one
4. If no matching block: PARSE_FAILURE → retry once → if still failing, per timeout rule (rule 9)

**Field validation (MANDATORY after JSON parse):**

- `REVIEW_RESULT`: `score` must be number in [0,10] (cast float, reject string/missing), `criticalCount` must be int >= 0 (floor at 0)
- `TEST_RESULT`: `total` must equal `passed` + `failed` (consistency check), all fields int >= 0
- `STATUS`: if `error` is non-null → `success` MUST be false. If `success=true` and `artifacts` empty for code agents → WARN

**Type coercion:** Always cast before comparison: score→float, counts→int, success→bool.

## References

- `references/intent-detection.md` - Detection rules and routing logic
- `references/workflow-steps.md` - Detailed step definitions for all modes
- `references/review-cycle.md` - Interactive and auto review processes
- `references/subagent-patterns.md` - Subagent invocation patterns with timeouts and structured output
