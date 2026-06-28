# Phase 3: Security & Operational Safety
**Priority:** Critical | **Status:** Ready

## Overview
Security and operational safety gaps in the `/binh-phap` command: pre-deploy secret scanning, environment validation, permission checks, rollback, dry-run, dirty tree checks, approval persistence, prompt sanitization, and verify-phase evidence enforcement.

Most of these are implemented as part of the Phase 1 command rewrite. This phase covers the testing and hardening of those security features.

## Implementation Steps

### Step 1: Secret Scanning
Patterns to detect in staged files before commit:
- AWS keys: `AKIA[0-9A-Z]{16}`
- Stripe keys: `sk_live_[0-9a-zA-Z]{24,}`
- GitHub tokens: `ghp_[0-9a-zA-Z]{36}`
- DB URLs with creds: `postgres://`, `mysql://`, `mongodb://`
- Private keys: `-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----`
- Generic: `password\s*[:=]\s*["'][^"']{8,}["']`

### Step 2: Environment Validation
- Read `wrangler.toml` for target environment
- Production: require explicit confirmation + `--force` flag
- Staging: log warning, no auto-promote

### Step 3: Permission Checks
- Branch must NOT be main/master for ship
- Working tree must be clean
- Explicit `/binh-phap ship` command required

### Step 4: Rollback
- On deploy failure: `npx wrangler rollback`
- Log to `.claude/state/rollback-history.json`

### Step 5: Approval Persistence
- File: `.claude/state/binh-phap-approval.json`
- 24h expiry, re-request if expired

### Step 6: Prompt Sanitization
- Strip ANSI codes, control chars
- Reject injection patterns

### Step 7: Verify Evidence Enforcement
- Require raw test output, build logs, HTTP status
- No summaries allowed

## Success Criteria
- [ ] Secret scan blocks deploy with specific file/line/pattern
- [ ] Production deploy requires --force + confirmation
- [ ] Ship blocked on main branch
- [ ] Ship blocked on dirty tree
- [ ] Rollback runs on deploy failure
- [ ] Approval persists 24h across sessions
- [ ] Injection patterns rejected
- [ ] Verify phase outputs raw evidence
