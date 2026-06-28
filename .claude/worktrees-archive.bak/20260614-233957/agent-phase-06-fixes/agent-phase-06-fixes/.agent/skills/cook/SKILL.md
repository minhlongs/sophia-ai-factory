---
name: cook
description: Smart Feature Implementation - Tự động workflow cho mọi task implementation. ALWAYS activate before implementing features, plans, or fixes.
version: 1.0.0
---

# Cook - Smart Feature Implementation

End-to-end implementation with automatic workflow detection, adapted for CC CLI / Antigravity.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/cook <natural language task OR plan path>
```

**Optional flags:** `--fast`, `--parallel`, `--no-test`, `--auto`

Examples:

```
/cook "Add user authentication to the app"
/cook --fast "Quick fix for login bug"
/cook path/to/implementation_plan.md --auto
/cook "Implement auth, payments, notifications" --parallel
```

## Smart Intent Detection

| Input Pattern                       | Detected Mode | Behavior                            |
| ----------------------------------- | ------------- | ----------------------------------- |
| Path to `*.md` plan file            | code          | Execute existing plan               |
| Contains "fast", "quick", "asap"    | fast          | Skip research, quick implementation |
| Contains "trust me", "auto", "yolo" | auto          | Auto-approve all steps              |
| Lists 3+ features OR "parallel"     | parallel      | Multi-agent execution               |
| Contains "no test", "skip test"     | no-test       | Skip testing step                   |
| Default                             | interactive   | Full workflow with user input       |

See `references/intent-detection.md` for detection logic.

## Workflow Overview

```
[Intent Detection] → [Research?] → [Review] → [Plan] → [Review] → [Implement] → [Review] → [Test?] → [Review] → [Finalize]
```

**Default (non-auto):** Stops at `[Review]` gates for human approval before each major step.
**Auto mode (`--auto`):** Skips human review gates, implements all phases continuously.

| Mode        | Research | Testing | Review Gates                   | Phase Progression      |
| ----------- | -------- | ------- | ------------------------------ | ---------------------- |
| interactive | ✓        | ✓       | **User approval at each step** | One at a time          |
| auto        | ✓        | ✓       | Auto if score≥9.5              | All at once (no stops) |
| fast        | ✗        | ✓       | User approval at each step     | One at a time          |
| parallel    | Optional | ✓       | User approval at each step     | Parallel groups        |
| no-test     | ✓        | ✗       | User approval at each step     | One at a time          |
| code        | ✗        | ✓       | User approval at each step     | Per plan               |

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
- **Code Review:** User approval OR auto-approve (score≥9.5, 0 critical)
- **Finalize:** Update walkthrough.md, git commit

## Workflow Steps

| Phase          | Actions                                                               |
| -------------- | --------------------------------------------------------------------- |
| Research       | `search_web`, `grep_search`, `find_by_name` for codebase analysis     |
| Plan           | Create `implementation_plan.md` in brain artifacts                    |
| UI Work        | Use `generate_image` for mockups, `browser_subagent` for testing      |
| Implementation | `write_to_file`, `replace_file_content`, `multi_replace_file_content` |
| Testing        | `run_command` for npm test, build verification                        |
| Review         | Self-review with scoring, notify_user for approval                    |
| Finalize       | Git commit via `run_command`, update `walkthrough.md`                 |

## References

- `references/intent-detection.md` - Detection rules and routing logic
- `references/workflow-steps.md` - Detailed step definitions for all modes
- `references/review-cycle.md` - Interactive and auto review processes
