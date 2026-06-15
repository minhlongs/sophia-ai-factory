# Phase 4: Test & Verify
**Priority:** High | **Status:** Ready

## Overview
Smoke tests and validation for all edge case fixes.

## Test Matrix

### Command Logic
| ID | Input | Expected |
|----|-------|----------|
| TC-A1 | No args | Shows help |
| TC-A2 | `--help` | Shows help |
| TC-A3 | `invalid` | Error + usage |
| TC-A4 | `ship` (no prior phases) | Abort: plan required |
| TC-A5 | `plan test` | Creates plan at absolute path |
| TC-A6 | `plan --dry-run` | Preview, no files |
| TC-A7 | `implement` (dirty tree) | Blocks |
| TC-A8 | `verify` (no approval) | Abort |
| TC-A9 | `ship` (secrets in staged) | Blocks |
| TC-A10 | `ship production` (no --force) | Requires confirmation |

### Symlinks
| ID | Check | Expected |
|----|-------|----------|
| TC-B1..B5 | `test -f ~/.claude/rules/binh-phap-*.md` | All pass |
| TC-B6 | pilot.md line 104 | No brace expansion |
| TC-B7 | cross-layer-orchestration.md | Resolves |

### Security
| ID | Scenario | Expected |
|----|----------|----------|
| TC-C1 | `</system-reminder>` in input | Sanitized |
| TC-C2 | Control chars | Stripped |
| TC-C3 | Secrets in staged | Blocked |
| TC-C4 | Ship on main | Blocked |
| TC-C5 | Dirty tree | Blocked |
| TC-C6 | Expired approval | Re-request |
| TC-C7 | Deploy fails | Auto-rollback |
| TC-C8 | Subagent timeout | Retry then escalate |
| TC-C9 | Verify output | Raw evidence |

## Smoke Test Script
```bash
#!/bin/bash
PASS=0; FAIL=0
# No args → help
output=$(/binh-phap 2>&1)
echo "$output" | grep -qi "usage\|help" && ((PASS++)) || ((FAIL++))
# Invalid action
output=$(/binh-phap invalid 2>&1)
echo "$output" | grep -qi "invalid\|error" && ((PASS++)) || ((FAIL++))
# Symlinks
for rule in core cicd memory-practices quality workflow; do
  [ -f "$HOME/.claude/rules/binh-phap-${rule}.md" ] && ((PASS++)) || ((FAIL++))
done
echo "Results: $PASS pass, $FAIL fail"
[ $FAIL -eq 0 ] && echo "ALL PASS" || echo "FAILURES"
```

## Success Criteria
- [ ] All TC-A* pass
- [ ] All TC-B* pass
- [ ] All TC-C* pass
- [ ] Smoke script exits 0
- [ ] No false positives in secret scanning
- [ ] State persists across invocations
