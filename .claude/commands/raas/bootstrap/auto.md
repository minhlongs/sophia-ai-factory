---
description: 🤖 AUTO Bootstrap — zero-prompt sequential mode for CTO injection
argument-hint: [optional-task-description]
---

**Think harder AUTO mode** — zero human input required.

<requirements>$ARGUMENTS</requirements>

**IMPORTANT:** AUTO mode = NEVER ask questions. Decide and execute immediately.
**IMPORTANT:** Activate needed skills. YAGNI, KISS, DRY. Tiếng Việt output.

## AUTO Protocol

1. **NEVER** ask "Bạn muốn làm gì?" — scan and decide
2. **NEVER** present options — pick best and execute
3. **NEVER** wait for confirmation — commit and continue

## Workflow

### 1. Context (5s)
- Read `./CLAUDE.md`, scan `plans/`, check git status

### 2. Auto-Select Task
If $ARGUMENTS → use as task.
If empty → find highest-impact work:
  1. Failing tests → fix
  2. Build errors → fix
  3. Lint warnings → fix
  4. Pending plan → implement
  5. Tech debt → address

### 3. Implement
- Use `fullstack-developer` agent
- Run type check after changes
- Auto-fix if errors

### 4. Verify
```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

### 5. Auto-Commit (if green)
```bash
git add -A && git commit -m "feat: <message>"
```

### 6. Report (compact)
- Changes, test results, next task
