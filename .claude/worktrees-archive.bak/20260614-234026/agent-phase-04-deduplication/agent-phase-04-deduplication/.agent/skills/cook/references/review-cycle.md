# Code Review Cycle

Interactive review-fix cycle for the cook workflow. Adapted for CC CLI / Antigravity.

## Self-Review Checklist

Before presenting to user, perform self-review on:

1. **Security**
   - [ ] No hardcoded secrets/API keys
   - [ ] Input validation present
   - [ ] No XSS/SQL injection vulnerabilities
   - [ ] OWASP Top 10 checked

2. **Performance**
   - [ ] No obvious bottlenecks
   - [ ] Efficient algorithms
   - [ ] Proper cleanup (event listeners, timers)
   - [ ] No memory leaks

3. **Architecture**
   - [ ] Follows existing patterns
   - [ ] Proper separation of concerns
   - [ ] No tight coupling

4. **Principles**
   - [ ] YAGNI: No unnecessary features
   - [ ] KISS: Simple solutions preferred
   - [ ] DRY: No code duplication

5. **Code Quality**
   - [ ] TypeScript types correct
   - [ ] No `any` types without justification
   - [ ] Proper error handling
   - [ ] Consistent naming

## Scoring

| Score  | Meaning                     |
| ------ | --------------------------- |
| 9.5-10 | Auto-approve eligible       |
| 8-9.4  | Good, minor suggestions     |
| 6-7.9  | Acceptable, has warnings    |
| 4-5.9  | Needs work, has issues      |
| 0-3.9  | Critical problems, must fix |

## Interactive Cycle (max 3 cycles)

```
cycle = 0
LOOP:
  1. Perform self-review → score, critical_count, warnings, suggestions

  2. PRESENT FINDINGS via notify_user:
     ┌─────────────────────────────────────────┐
     │ Code Review Results: [score]/10         │
     ├─────────────────────────────────────────┤
     │ Summary: [what implemented], tests      │
     │ [X/X passed]                            │
     ├─────────────────────────────────────────┤
     │ Critical Issues ([N]): MUST FIX         │
     │  - [issue] at [file:line]               │
     │ Warnings ([N]): SHOULD FIX              │
     │  - [issue] at [file:line]               │
     │ Suggestions ([N]): NICE TO HAVE         │
     │  - [suggestion]                         │
     └─────────────────────────────────────────┘

  3. User response options:
     IF critical_count > 0:
       - "Fix critical issues" → fix, re-run tests, cycle++, LOOP
       - "Fix all issues" → fix all, re-run tests, cycle++, LOOP
       - "Approve anyway" → PROCEED
       - "Abort" → stop
     ELSE:
       - "Approve" → PROCEED
       - "Fix warnings/suggestions" → fix, cycle++, LOOP
       - "Abort" → stop

  4. IF cycle >= 3 AND user selects fix:
     → "⚠ 3 review cycles completed. Final decision required."
     → Present: "Approve with noted issues" / "Abort workflow"
```

## Auto-Handling Cycle (for auto modes)

```
cycle = 0
LOOP:
  1. Perform self-review → score, critical_count, warnings

  2. IF score >= 9.5 AND critical_count == 0:
     → Auto-approve, PROCEED

  3. ELSE IF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues
     → Re-run tests
     → cycle++, LOOP

  4. ELSE IF critical_count > 0 AND cycle >= 3:
     → ESCALATE TO USER via notify_user

  5. ELSE (no critical, score < 9.5):
     → Approve with warnings logged, PROCEED
```

## Critical Issues Definition

- **Security:** XSS, SQL injection, exposed secrets, OWASP vulnerabilities
- **Performance:** O(n²) loops on large data, memory leaks, blocking operations
- **Architecture:** Circular dependencies, god objects, layer violations
- **Principles:** Major DRY violations (copy-paste blocks), over-engineering

## Output Formats

- Waiting: `⏸ Step 5: Code reviewed - [score]/10 - WAITING for approval`
- After fix: `✓ Step 5: [old]/10 → Fixed [N] issues → [new]/10 - Approved`
- Auto-approved: `✓ Step 5: Code reviewed - 9.8/10 - Auto-approved`
- User approved: `✓ Step 5: Code reviewed - [score]/10 - User approved`
