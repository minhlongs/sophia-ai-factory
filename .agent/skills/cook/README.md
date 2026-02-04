# Cook Skill - Smart Feature Implementation

> v1.0.0 | Adapted from claudekit-engineer for CC CLI / Antigravity

## Quick Start

```bash
# Interactive mode (default) - stops at review gates
/cook "Add user authentication"

# Fast mode - skip research, quick implementation
/cook --fast "Fix login button styling"
/cook "Quick fix for the bug"

# Auto mode - no stops, auto-approve if score >= 9.5
/cook --auto "Implement the entire checkout flow"
/cook "Implement dashboard trust me"

# Execute existing plan
/cook path/to/implementation_plan.md

# Parallel mode (3+ features)
/cook "Implement auth, payments, notifications, and shipping"
```

## Modes

| Mode          | When to Use                                        |
| ------------- | -------------------------------------------------- |
| `interactive` | Default. Full workflow with review gates.          |
| `fast`        | Quick fixes, small changes. Skip research.         |
| `auto`        | Trust the agent. No review gates, auto-approve.    |
| `parallel`    | Multiple features (3+). Sequential implementation. |
| `no-test`     | UI-only changes that don't need tests.             |
| `code`        | Execute an existing implementation plan.           |

## Workflow

```
Step 0: Intent Detection
Step 1: Research (optional)
Step 2: Planning
Step 3: Implementation
Step 4: Testing (optional)
Step 5: Code Review
Step 6: Finalize
```

## Examples

### Example 1: Add a Feature

```
/cook "Add dark mode toggle to the settings page"
```

Output:

```
✓ Step 0: Mode interactive - default mode
✓ Step 1: Research complete - 3 sources analyzed
✓ Step 2: Plan created - 2 phases
✓ Step 3: Implemented 4 files
✓ Step 4: Tests 5/5 passed
✓ Step 5: Review 9.2/10 - User approved
✓ Step 6: Finalized - Committed
```

### Example 2: Quick Bug Fix

```
/cook --fast "Fix the login button not working on mobile"
```

Output:

```
✓ Step 0: Mode fast - explicit flag
✓ Step 2: Plan created - 1 phase
✓ Step 3: Implemented 1 file
✓ Step 4: Tests 3/3 passed
✓ Step 5: Review 9.5/10 - Approved
✓ Step 6: Finalized - Committed
```

### Example 3: Full Auto

```
/cook --auto "Implement entire user profile section"
```

Output:

```
✓ Step 0: Mode auto - explicit flag
✓ Step 1: Research complete
✓ Step 2: Plan created - 3 phases
✓ Step 3: Implemented 12 files
✓ Step 4: Tests 15/15 passed
✓ Step 5: Review 9.8/10 - Auto-approved
✓ Step 6: Finalized - Committed
```

## Vietnamese Support

The skill understands Vietnamese keywords:

- "nhanh" → fast mode
- "tin em" → auto mode
- "không test" → no-test mode

```
/cook "Sửa nhanh cái bug login"
→ Mode: fast
```

## References

- [SKILL.md](./SKILL.md) - Main skill definition
- [references/intent-detection.md](./references/intent-detection.md) - Detection logic
- [references/workflow-steps.md](./references/workflow-steps.md) - Step details
- [references/review-cycle.md](./references/review-cycle.md) - Review process
