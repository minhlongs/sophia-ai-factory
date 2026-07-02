---
phase: 3
title: "Verify & Merge"
status: pending
effort: "~30 min"
priority: P1
dependencies: [2]
---

# Phase 3: Verify & Merge

## Overview

Full quality gate sweep, merge PR #31 to main, push, and delete the stale branch. This is the final gate before the harness feature is live.

## Requirements

- `npm run build` → 0 TS errors
- `npm test` → all tests pass (existing 6763+ plus new harness tests)
- `npm run type-check` → 0 errors
- PR #31 merged with squash commit
- Stale `feature/harness-engineering` branch deleted locally

## Implementation Steps

### Step 1: Full build gate
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npm run build         # 0 TS errors
npm test              # all pass (expect new harness tests to add to 6763)
npm run type-check    # 0 errors
```

### Step 2: Merge PR #31
```bash
cd /Users/macbook/projects/sophia-ai-factory
gh pr merge 31 --squash --subject "feat(harness): add system health harness with daemon, API, dashboard, and Telegram commands"
```

If `gh` merge fails (PR needs rebase per GitHub), push the clean branch:
```bash
# Push the ship/harness-pr branch and create a new PR
git push origin ship/harness-pr
gh pr create --fill --base main --head ship/harness-pr
# Close old PR
gh pr close 31
# Merge new PR
gh pr merge <new-pr-number> --squash
```

### Step 3: Delete stale branches
```bash
git branch -D feature/harness-engineering
git branch -D ship/harness-pr  # only if ship branch created separately
```

### Step 4: Verify production
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
git push origin main
npm run deploy:full
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"  # must match
```

## Related Code Files

- Push: fully verified codebase
- Delete: `feature/harness-engineering` (locally) and optionally on remote

## Success Criteria

- [ ] `npm run build` → 0 TS errors
- [ ] `npm test` → all tests pass
- [ ] `npm run type-check` → 0 errors
- [ ] PR #31 merged (squash)
- [ ] Stale branch deleted locally
- [ ] Production SHA match verified

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests fail after daemon import fixes | Medium | Medium | Debug and fix per failure; daemon tests may need updating |
| `gh pr merge` fails due to branch state | Low | Medium | Push clean branch and create new PR |
| Production deploy breaks existing workflows | Low | High | Rollback to `git revert` of merge commit; protected flows tested first |
