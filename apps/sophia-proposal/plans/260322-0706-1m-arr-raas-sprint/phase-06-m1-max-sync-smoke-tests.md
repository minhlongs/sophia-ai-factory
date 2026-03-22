---
phase: 6
title: "M1 Max Sync + Smoke Tests"
priority: P2
status: pending
effort: 2h
---

# Phase 6 — M1 Max Sync + Smoke Tests

## Context Links
- [CI/CD Protocol](../../.github/workflows/) (if exists)
- [Development Roadmap](../../docs/development-roadmap.md)

## Overview

Final validation phase. Sync codebase to M1 Max build server, run full test suite, execute smoke tests against deployed Cloudflare environment, update docs.

## Requirements

### Functional
- Full test suite passes on M1 Max
- Smoke tests verify all 14 commands via `/api/v1/missions`
- Build produces zero errors, zero warnings

### Non-functional
- Build time < 30s on M1 Max
- All smoke tests complete within 2 minutes

## Implementation Steps

1. **Build verification:**
   ```bash
   npm run build  # must exit 0, no TS errors
   npm test       # 200+ tests pass
   ```

2. **Smoke test script** (`scripts/smoke-test.sh`):
   - POST each of 14 commands to `/api/v1/missions`
   - Verify 201 response + mission ID returned
   - GET mission status — verify it transitions from queued → completed
   - Test rate limiting (burst 100 requests)
   - Test 402 on zero-balance org

3. **Docs update:**
   - Update `docs/development-roadmap.md` — mark Phase 4-5 milestones
   - Update `docs/system-architecture.md` — add 5 new sales commands to table
   - Update `docs/system-architecture.md` — monitoring section

4. **Final checklist:**
   - `grep -r ": any" lib/ app/` → 0
   - `grep -r "supabase" lib/ app/ package.json` → 0
   - `grep -r "console.log" lib/` → 0 (use proper logging)
   - All 14 commands in STEP_NAMES
   - Health endpoint returns 200

## Related Code Files

### Files to create
- `scripts/smoke-test.sh` — end-to-end smoke test script

### Files to modify
- `docs/development-roadmap.md` — update Phase 4-5 status
- `docs/system-architecture.md` — add new commands + monitoring section

## Todo List

- [ ] Run `npm run build` clean
- [ ] Run full test suite
- [ ] Create and run smoke test script
- [ ] Update development-roadmap.md
- [ ] Update system-architecture.md
- [ ] Final quality grep checks
- [ ] Tag release

## Success Criteria

- Build: 0 errors
- Tests: 200+ pass
- Smoke: all 14 commands return valid results
- Docs: accurate, up-to-date
- Quality: 0 `any`, 0 supabase refs, 0 console.log in lib/

## Risk Assessment

- **M1 Max env differences** — use same Node.js version (>= 20)
- **CF Workers cold start in smoke tests** — add retry logic to smoke script
