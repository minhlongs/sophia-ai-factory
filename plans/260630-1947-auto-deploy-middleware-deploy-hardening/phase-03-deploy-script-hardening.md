# Phase 03: Deploy Script Hardening

**Priority:** P4 | **Effort:** 2-3h | **Status:** pending

## Context Links
- Parent: [plan.md](plan.md)
- Target file: `scripts/deploy-with-sha.sh` (646 lines, 29 fix commits)
- Deploy doctrine: `.claude/rules/sophia-deploy-verify.md`

## Overview

Harden the deploy script against silent failures. 29 fix commits indicate systemic fragility — `|| true`, `2>/dev/null`, and unchecked curl calls mask real failures.

## Known Issues

| Pattern | Lines | Issue |
|---------|-------|-------|
| `|| true` | 4+ | Suppresses legitimate errors |
| `2>/dev/null` | 6+ | Masks stderr diagnostic output |
| Curl without `--fail` | 3+ | HTTP errors return success exit code |
| Shell globs in `wait_for_file` | 1 | Doesn't expand correctly |
| No `set -e` at critical sections | 2 | Errors in pipeline silently ignored |
| `deploy-full-verified.sh` requires E2E password | 1 | Blocks automated deploy |

## Requirements

### Functional
- All curl calls use `--fail --retry 3`
- All `|| true` replaced with explicit error handling (log + exit or continue with metric)
- All `2>/dev/null` replaced with log file capture or removed
- Shell globs validated before use
- Critical sections use `set -e` (or equivalent)
- Deploy script remains compatible with both manual and CI execution

### Non-Functional
- ShellCheck passes with 0 warnings
- Script still deploys successfully (end-to-end test)
- No breaking changes to CLI flags (SKIP_SYMBOL_UPLOAD, SKIP_PWA, etc.)

## Related Code Files

| Action | File |
|--------|------|
| Modify | `scripts/deploy-with-sha.sh` |
| Create | `scripts/lib/deploy-utils.sh` (shared helpers) |
| Read | `wrangler.toml` |

## Implementation Steps

1. Replace `|| true` patterns:
   - `wrangler deploy || true` → capture exit code, log warning, continue only if non-critical
   - `rm -f || true` → check if file exists first
2. Replace `2>/dev/null`:
   - Redirect stderr to log file `/tmp/deploy-$(date +%s).log`
   - Or use `--silent` flag where supported
3. Harden curl calls:
   - Add `--fail` to all production URL checks
   - Add `--retry 3 --retry-delay 5` for transient failures
4. Fix shell globs:
   - Use `find ... -exec` instead of bare globs
   - Add nullglob check
5. Add `set -euo pipefail` at script start, with explicit `|| handle_error` for recoverable errors
6. Create `scripts/lib/deploy-utils.sh` for shared functions (log, retry, verify)
7. Test: run deploy script, verify SHA match
8. Run ShellCheck: `shellcheck scripts/deploy-with-sha.sh`

## Todo List
- [ ] Replace all `|| true` with explicit error handling
- [ ] Replace `2>/dev/null` with log capture
- [ ] Harden all curl calls (--fail, --retry)
- [ ] Fix shell glob patterns
- [ ] Add `set -euo pipefail`
- [ ] Create `scripts/lib/deploy-utils.sh`
- [ ] Run ShellCheck → 0 warnings
- [ ] Test deploy end-to-end
- [ ] Verify SHA match after deploy

## Success Criteria
- [ ] ShellCheck: 0 warnings on deploy-with-sha.sh
- [ ] `npm run deploy:full` still succeeds
- [ ] SHA verification passes after deploy
- [ ] No silent error suppression (all errors logged or fail)
- [ ] Script works in CI environment (non-interactive)

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `set -e` breaks existing flow | Medium | Test each change incrementally; keep `|| handle_error` for recoverable paths |
| wrangler deploy transient failure | Low | Retry logic with exponential backoff |
| ShellCheck false positives | Low | Use `# shellcheck disable=SCXXXX` with comment explaining why |

## Next Steps
- After Phase 03 complete → code review → test deploy → monitor deploy reliability over next 5 deploys
