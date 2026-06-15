# Unified Workflow Steps

All modes share core steps with mode-specific variations. Adapted for CC CLI / Antigravity.

## Step 0: Intent Detection & Setup

1. Parse input with `intent-detection.md` rules
2. Log detected mode: `✓ Step 0: Mode [X] - [reason]`
3. If mode=code: detect plan path, set active plan
4. Create `task.md` in brain artifacts to track progress

**Output:** `✓ Step 0: Mode [interactive|auto|fast|parallel|no-test|code] - [detection reason]`

## Step 1: Research (skip if fast/code mode)

**Interactive/Auto:**

- Use `search_web` for external research
- Use `grep_search`, `find_by_name` for codebase analysis
- Keep reports ≤150 lines

**Parallel:**

- Optional: focused research if complex

**Output:** `✓ Step 1: Research complete - [N] sources analyzed`

### [Review Gate 1] Post-Research (skip if auto mode)

- Present research summary via `notify_user`
- Wait for user: "Proceed to planning?" / "Request more research" / "Abort"
- **Auto mode:** Skip this gate

## Step 2: Planning

**Interactive/Auto/No-test:**

- Create `implementation_plan.md` in brain artifacts
- Include: goal, proposed changes, verification plan

**Fast:**

- Minimal planning, focus on action
- Small inline plan in task.md

**Parallel:**

- Create dependency graph for parallel execution
- File ownership matrix to prevent conflicts

**Code:**

- Skip - plan already exists
- Parse existing plan for phases

**Output:** `✓ Step 2: Plan created - [N] phases`

### [Review Gate 2] Post-Plan (skip if auto mode)

- Present plan via `notify_user` with `PathsToReview`
- Wait for user: "Approve plan?" / "Request revisions" / "Abort"
- **Auto mode:** Skip this gate

## Step 3: Implementation

**All modes:**

- Execute using `write_to_file`, `replace_file_content`, `multi_replace_file_content`
- Use `browser_subagent` for UI verification
- Use `generate_image` for mockups/assets
- Run type checking after each file

**Parallel mode:**

- Multiple implementation blocks in sequence (no true multi-agent in CC CLI)
- Respect file ownership boundaries

**Output:** `✓ Step 3: Implemented [N] files - [X/Y] tasks complete`

### [Review Gate 3] Post-Implementation (skip if auto mode)

- Present implementation summary via `notify_user`
- Wait for user: "Proceed to testing?" / "Request changes" / "Abort"
- **Auto mode:** Skip this gate

## Step 4: Testing (skip if no-test mode)

**All modes (except no-test):**

- Run `npm run build` for build verification
- Run `npm test` for unit tests
- Use `browser_subagent` for E2E tests
- If failures: analyze, fix, repeat
- **Forbidden:** fake mocks, commented tests, changed assertions

**Output:** `✓ Step 4: Tests [X/X passed]`

### [Review Gate 4] Post-Testing (skip if auto mode)

- Present test results via `notify_user`
- Wait for user: "Proceed to review?" / "Request fixes" / "Abort"
- **Auto mode:** Skip this gate

## Step 5: Code Review

**Interactive/Parallel/Code/No-test:**

- Self-review with checklist (see `review-cycle.md`)
- Interactive cycle (max 3): present findings, get approval
- Requires user approval via `notify_user`

**Auto:**

- Auto-approve if score≥9.5 AND 0 critical
- Auto-fix critical (max 3 cycles)
- Escalate to user after 3 failed cycles

**Fast:**

- Simplified review, no fix loop
- User approves or aborts

**Output:** `✓ Step 5: Review [score]/10 - [Approved|Auto-approved]`

## Step 6: Finalize

**All modes:**

1. Create/update `walkthrough.md` in brain artifacts
2. Git commit via `run_command`: `git add . && git commit -m "feat: ..."`
3. Update `task.md` with completion status

**Auto mode:** Continue to next phase automatically
**Others:** Ask user before next phase

**Output:** `✓ Step 6: Finalized - Walkthrough updated - Committed`

## Mode-Specific Flow Summary

Legend: `[R]` = Review Gate (human approval required)

```
interactive: 0 → 1 → [R] → 2 → [R] → 3 → [R] → 4 → [R] → 5(user) → 6
auto:        0 → 1 → 2 → 3 → 4 → 5(auto) → 6 → next phase (NO stops)
fast:        0 → skip → 2(fast) → [R] → 3 → [R] → 4 → [R] → 5(simple) → 6
parallel:    0 → 1? → [R] → 2(parallel) → [R] → 3(sequential) → [R] → 4 → [R] → 5(user) → 6
no-test:     0 → 1 → [R] → 2 → [R] → 3 → [R] → skip → 5(user) → 6
code:        0 → skip → skip → 3 → [R] → 4 → [R] → 5(user) → 6
```

**Key difference:** `auto` mode is the ONLY mode that skips all review gates.

## Critical Rules

- Never skip steps without mode justification
- Update `task.md` to mark tasks complete immediately
- All step outputs follow format: `✓ Step [N]: [status] - [metrics]`
- Use `notify_user` for all review gates (non-auto modes)
