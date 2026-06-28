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

**Field validation rules (MANDATORY):**
- `score`: Must be a number in range [0, 10]. After JSON parse, cast to float. If string/missing/NaN/out-of-range → treat as malformed, trigger retry.
- `criticalCount`: Must be int >= 0. If negative → treat as 0 (log warning).
- `warnings`: Must be int >= 0. If negative → treat as 0.
- Epsilon for threshold: use `abs(score - threshold) < 0.001` for all comparisons.

**Type coercion before use:**
```python
score = float(parsed.get("score", 0))
criticalCount = max(0, int(parsed.get("criticalCount", 0)))
warnings = max(0, int(parsed.get("warnings", 0)))
```

### TEST_RESULT Block (tester subagent)

The tester subagent **MUST** end its response with:

```
---
TEST_RESULT: {"passed": 12, "failed": 0, "total": 12}
---
```

**TEST_RESULT validation (MANDATORY):**
After parsing JSON, validate:
1. All fields present: `passed`, `failed`, `total` — if any missing, treat as malformed
2. Consistency: `total == passed + failed` — if mismatch, treat as malformed
3. Range: `passed >= 0`, `failed >= 0`, `total >= 0`
4. Type: all must be integers

**Validation code:**
```python
result = parsed_block
required = ["passed", "failed", "total"]
if not all(k in result for k in required):
    → MALFORMED, retry once
if result["total"] != result["passed"] + result["failed"]:
    → MALFORMED, retry once
    LOG: f"TEST_RESULT inconsistency: {result['passed']}+{result['failed']}!={result['total']}"
```

### STATUS Block (all other subagents)

All subagents except `code-reviewer` and `tester` **MUST** end with:

```
---
STATUS: {"success": true, "artifacts": ["path/to/file.ts"], "error": null}
---
```

**STATUS validation (MANDATORY):**
After parsing JSON, validate:
1. Type check: `success` must be bool, `artifacts` must be list, `error` must be str or null
2. Consistency: if `error` is non-null string → `success` MUST be false
3. Artifact check: if `success` is true AND `artifacts` is empty → WARN (may be valid for status-only updates like project-manager)
4. Artifact existence: for `fullstack-developer` and `git-manager`, verify artifact paths exist (skip for other types)

**Validation code:**
```python
status = parsed_block
if status.get("error") and status.get("success"):
    → LOG: "STATUS contradiction: success=true but error set"
    → Treat as failure, retry once
if status["success"] and not status["artifacts"] and agentType in ["fullstack-developer", "git-manager"]:
    → WARN: "Success reported but no artifacts — possible silent failure"
```

## Parsing Rule

**Algorithm:**
```python
1. Split response by lines
2. Find all `---` delimiter positions (lines that are exactly "---")
3. Between each pair of delimiters, extract block content
4. SKIP blocks inside markdown code fences (```...```) — track fence state
5. For each extracted block, check if it starts with expected type (REVIEW_RESULT/TEST_RESULT/STATUS)
6. If multiple blocks of same type: use the LAST one
7. If no matching block found: PARSE_FAILURE
```

On PARSE_FAILURE:
→ Retry once with explicit instruction: "MUST end response with --- followed by REVIEW_RESULT: {...} ---"
→ If retry also fails: treat as subagent failure per escalation rules

**Expected block types per subagent:**
| Subagent | Block Type |
|----------|-----------|
| code-reviewer | REVIEW_RESULT |
| tester | TEST_RESULT |
| all others | STATUS |

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
 → LOG: "Side-effect blocked: [issue description]"
 → Write to phase-status.json: {"phase": N, "status": "blocked", "reason": "side-effect", "details": "[issue]"}
 → SKIP auto-fix for this issue
 → DO NOT re-run tester (code state unchanged — no fix was applied)
 → Mark phase as "partial" (implemented but review failed)
 → Continue to next phase (do NOT loop — side-effect issues require human intervention)
 → DO NOT cycle++ (exit the review loop for this phase)

  4. ELIF critical_count > 0 AND cycle >= 3:
     → FAIL: "3 review cycles failed. Unfixable critical issues."
     → ABORT phase, record failure in phase-status.json
     → Continue to next phase (do NOT block entire workflow)

  5. ELIF score >= 7.0 AND critical_count == 0:  # no critical, score OK
     → APPROVED with warnings logged, PROCEED

 6. ELSE (score < 7.0, no critical):
 → Auto-fix warnings (max 1 additional cycle)
 → Re-run tester
 → IF still < 7.0:
 → Mark phase as "degraded" in phase-status.json
 → LOG: "Phase [N] quality below threshold (score: [X]/10)"
 → DO NOT block subsequent phases — but flag as dependency risk
 → Continue to next phase
 → cycle++, LOOP
```


**Fix scope classification:**
- Patch-level fix (type annotation, rename, null check, import fix): apply directly, re-run tester (Step 4), re-enter review (Step 5)
- Structural fix (API redesign, architecture change, new file needed, file deletion):
 → Write to phase-status.json: "Phase [N] requires re-implementation: [reason]"
 → Mark phase as "needs-rework"
 → DO NOT attempt structural fix in review cycle — proceed to next phase
 → Present at end-of-run report with full context for user to re-run

**Rule:** The review cycle can ONLY apply patch-level fixes (≤ 20 lines changed, no new files, no deleted files). Structural fixes MUST go through Step 3 (implementation) again.

**Auto mode escalation:** Write issues to `phase-status.json` → continue to next phase → present ALL accumulated issues to user at end.

**Side-effect classification:** A fix is a side-effect if it involves:
- Database schema changes (ADD COLUMN, DROP, ALTER, CREATE TABLE, CREATE INDEX, DROP INDEX, RENAME COLUMN, ADD CONSTRAINT, DROP CONSTRAINT, TRUNCATE, migration files)
- Data deletion or migration (DELETE FROM, TRUNCATE, DROP TABLE, destroy, hardDelete, removeAll, truncate, migrate)
- External API calls (fetch(, axios, webhook registration, curl, POST to external URL, httpx)
- Permission or access control changes (GRANT, REVOKE, ALTER ROLE, RLS policy, permission, scope, role)
- File deletions (unlink, rm, fs.rm, removeFile, deleteFile, rimraf)

**Detection method:** Keyword scan of the critical issue description. If ANY keyword from the above categories appears, flag as side-effect. Default to blocking (safe side) when uncertain.

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
