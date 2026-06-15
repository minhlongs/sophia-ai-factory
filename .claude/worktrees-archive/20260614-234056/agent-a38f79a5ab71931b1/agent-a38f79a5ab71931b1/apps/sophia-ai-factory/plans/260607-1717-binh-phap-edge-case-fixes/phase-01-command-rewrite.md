# Phase 1: Command Logic Rewrite
**Priority:** High | **Status:** Ready

## Overview
Rewrite `.claude/commands/binh-phap.md` to address 9 unhandled + 3 partial edge cases: input validation, error handling, phase state tracking, timeouts, --help fallback, absolute paths, skills mapping, dry-run mode, approval persistence, and prompt sanitization.

## Files to Modify
- `.claude/commands/binh-phap.md` — full rewrite (61 → ~200 lines)

## Files to Create
- `.claude/state/binh-phap-state.json` — phase tracking
- `.claude/state/binh-phap-approval.json` — approval persistence

## Implementation Steps

### 1. Input Guard
- No args or `--help` → show usage table, exit
- Invalid action → error message + usage hint, exit
- Valid actions: plan | implement | verify | ship

### 2. Phase State Tracking
- State file: `.claude/state/binh-phap-state.json`
- Schema: `{ currentPhase, lastAction, planPath, timestamp, status }`
- Before each phase (except plan): verify previous phase is `completed`
- If not: abort with "Phase '<required>' must complete before '<current>'"

### 3. Error Handling
- Wrap all subagent calls with error handling
- On failure: capture error, update state to `failed`, retry once, escalate if retry fails
- Never silently swallow failures

### 4. Subagent Timeout
- 5-minute timeout per subagent call
- On timeout: log to state, retry once with reduced scope, escalate if retry fails

### 5. Absolute Plan Path
- Replace `./plans/` with absolute path derived from CLAUDE.md location
- Pattern: `<project-root>/plans/`

### 6. Skills → Phase Mapping
Replace vague "Activate relevant skills" with explicit table:
- plan: planner, researcher, brainstorm
- implement: cook, frontend-development, backend-development
- verify: test, code-review
- ship: git, deploy, docs

### 7. Dry-Run Mode
- `--dry-run` flag: show what would execute without running
- List subagents, files to create/modify
- No side effects

### 8. Approval Persistence
- Store approval in `.claude/state/binh-phap-approval.json`
- Schema: `{ planPath, approvedAt, expiresAt (24h default) }`
- Before implement/verify/ship: check approval exists + not expired
- If expired: re-request

### 9. Prompt Injection Sanitization
- Strip ANSI escape codes, control characters
- Reject patterns: `</system-reminder>`, `</user-input>`, "ignore (previous|all) (instructions|rules)"
- Log warning if injection detected

### 10. Dirty Tree Check
- Before implement: `git status --porcelain`
- If dirty: block unless `--force`
- Option: auto-stash with message

### 11. Security Gates in Ship Phase
- Pre-deploy secret scan (grep for API key patterns)
- Environment validation (staging vs production)
- Permission check (not on main branch)
- GREEN PRODUCTION RULE enforcement (CI poll → HTTP check → formatted report)

### 12. Rollback Mechanism
- If deploy fails: `npx wrangler rollback`
- Log rollback SHA + timestamp to state file
- State: `.claude/state/rollback-history.json`

## Success Criteria
- [ ] No-args shows help
- [ ] Invalid action shows error + usage
- [ ] Ship without prior phases aborts with clear message
- [ ] Subagent failure triggers retry then escalation
- [ ] All plan paths are absolute
- [ ] Skills explicitly mapped per phase
- [ ] --dry-run shows preview without execution
- [ ] Approval persists across sessions
- [ ] $ARGUMENTS sanitized before subagent dispatch
- [ ] Dirty tree blocks implement unless --force
- [ ] Secret scan blocks ship if patterns detected
- [ ] Rollback runs on deploy failure
