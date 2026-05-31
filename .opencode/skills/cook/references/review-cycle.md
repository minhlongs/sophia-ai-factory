# Code Review Cycle

Interactive review-fix cycle used in code workflows.

## Structured Output Contract

The code-reviewer subagent **MUST** end its response with this exact block:

```
---
REVIEW_RESULT: {"score": 8.5, "criticalCount": 0, "warnings": 2}
---
```

Fields:
- `score`: number 0-10 (e.g., 9.5)
- `criticalCount`: integer
- `warnings`: integer
- `suggestions`: integer (optional)

**If the block is missing or malformed, the orchestrator MUST treat it as a review failure** and either retry (max 1 retry) or escalate to user.

## Parsing Rule

```
1. Find last occurrence of "---" delimited block containing "REVIEW_RESULT"
2. Parse JSON
3. If parse fails → FAIL, retry once
4. Extract: score (number), criticalCount (int)
```

## Interactive Cycle (max 3 cycles)

```python
cycle = 0
LOOP:
  1. Run code-reviewer → extract REVIEW_RESULT block → score, critical_count

  2. DISPLAY FINDINGS:
  ┌─────────────────────────────────────────┐
  │ Code Review Results: [score]/10         │
  ├─────────────────────────────────────────┤
  │ Summary: [what implemented], tests      │
  │ [X/X passed]                            │
  ├─────────────────────────────────────────┤
  │ Critical Issues ([N]): MUST FIX         │
  │ - [issue] at [file:line]                │
  │ Warnings ([N]): SHOULD FIX              │
  │ - [issue] at [file:line]                │
  │ Suggestions ([N]): NICE TO HAVE         │
  │ - [suggestion]                          │
  └─────────────────────────────────────────┘

  3. IF interactive mode:
     AskUserQuestion (header: "Review & Approve"):
       IF critical_count > 0:
         - "Fix critical issues" → fix, re-run tester, cycle++, LOOP
         - "Fix all issues" → fix all, re-run tester, cycle++, LOOP
         - "Approve anyway" → PROCEED
         - "Abort" → stop
       ELSE:
         - "Approve" → PROCEED
         - "Fix warnings/suggestions" → fix, cycle++, LOOP
         - "Abort" → stop

  4. IF cycle >= 3 AND user selects fix:
     → "⚠ 3 review cycles completed. Final decision required."
     → AskUserQuestion: "Approve with noted issues" / "Abort workflow"

  5. IF auto mode:
     → See Auto-Handling Cycle below
```

## Auto-Handling Cycle (for auto mode)

```python
cycle = 0
LOOP:
  1. Run code-reviewer → extract REVIEW_RESULT → score, critical_count, warnings

  2. IF score >= 9.5 AND critical_count == 0:
     → APPROVED, PROCEED

  3. ELIF critical_count > 0 AND cycle < 3:
     → Auto-fix critical issues ONLY (not warnings, not suggestions)
     → CHECK: Is any critical issue a side-effect? (schema migration, data deletion, external API call)
       IF side-effect detected:
         → SKIP auto-fix, LOG: "Side-effect blocked: [issue]"
         → ABORT phase, escalate to user after all phases complete
     → Re-run tester
     → cycle++, LOOP

  4. ELIF critical_count > 0 AND cycle >= 3:
     → FAIL: "3 review cycles failed. Unfixable critical issues."
     → ABORT phase, record failure in phase-status.json
     → Continue to next phase (do NOT block entire workflow)

  5. ELIF score >= 7.0 AND critical_count == 0:  # no critical, score OK
     → APPROVED with warnings logged, PROCEED

  6. ELSE (score < 7.0, no critical):
     → Auto-fix warnings (max 1 cycle)
     → Re-run tester
     → IF still < 7.0: escalate to user after all phases
     → cycle++, LOOP
```

**Auto mode escalation:** Write issues to `phase-status.json` → continue to next phase → present ALL accumulated issues to user at end.

**Side-effect classification:** A fix is a side-effect if it involves:
- Database schema changes (ADD COLUMN, DROP, ALTER)
- Data deletion or migration
- External API calls or webhook registrations
- Permission or access control changes
- File deletions

## Critical Issues Definition
- Security: XSS, SQL injection, OWASP vulnerabilities
- Performance: bottlenecks, inefficient algorithms
- Architecture: violations of patterns, coupling
- Principles: YAGNI, KISS, DRY violations

## Output Formats
- Waiting: `⏸ Step 4: Code reviewed - [score]/10 - WAITING for approval`
- After fix: `✓ Step 4: [old]/10 → Fixed [N] issues → [new]/10 - Approved`
- Auto-approved: `✓ Step 4: Code reviewed - [score]/10 - Auto-approved`
- Approved: `✓ Step 4: Code reviewed - [score]/10 - User approved`
- Failed: `✗ Step 4: Review failed - [reason] - Aborted`
