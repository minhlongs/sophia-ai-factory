---
phase: 1
title: "Inventory PR Files"
status: pending
effort: "~15 min"
---

# Phase 1: Inventory PR Files

## Overview

Identify which of PR #31's ~2,300 LOC are genuinely-new harness code vs stale base divergence. Mirror of Phase 6-13 inventory approach: classify each file, skip already-existing code, flag quality issues.

## Requirements

- Confirm the ~12 harness-specific files are the only genuinely-new code
- Identify dead import paths in daemon code
- Verify migration 0148 doesn't collide with main's latest migration
- No code changes in this phase — only diagnosis

## Implementation Steps

### Step 1: List PR's harness-specific files
```bash
cd /Users/macbook/projects/sophia-ai-factory
# The harness-specific files (known from brainstorm):
files=(
  "apps/sophia-ai-factory/src/app/api/v1/harness/trigger/route.ts"
  "apps/sophia-ai-factory/src/app/api/v1/harness/status/route.ts"
  "apps/sophia-ai-factory/src/app/api/v1/harness/jobs/poll/route.ts"
  "apps/sophia-ai-factory/src/app/api/v1/harness/jobs/[id]/route.ts"
  "apps/sophia-ai-factory/src/app/api/v1/harness/check/r2/route.ts"
  "apps/sophia-ai-factory/src/app/api/v1/harness/__tests__/route.test.ts"
  "apps/sophia-ai-factory/src/app/[locale]/dashboard/system-health/components/harness-health-card.tsx"
  "apps/sophia-ai-factory/src/tree/harness/daemon.ts"
  "apps/sophia-ai-factory/src/tree/harness/__tests__/daemon.test.ts"
  "apps/sophia-ai-factory/src/tree/telegram/telegram-bot-harness-handlers.ts"
  "migrations/0148_harness_tables.sql"
)
for f in "${files[@]}"; do
  exists_on_main=$(git show main:"$f" 2>/dev/null && echo "YES" || echo "NO")
  echo "$f — on main: $exists_on_main"
done
```

### Step 2: Check migration number collision
```bash
ls migrations/*.sql | tail -3
# If main's max migration > 0148, renumber to main's max + 1
```

### Step 3: Audit daemon.ts for quality issues
Read `apps/sophia-ai-factory/src/tree/harness/daemon.ts` and identify:
- `console.log` calls (replace with logger)
- Import of `../../lib/validation/services` (replace with canonical path)
- `process.env.HARNESS_SECRET` (replace with `getCloudflareEnv()`)
- Remotion `exec()` call (won't work on CF Workers — document as local-only)

### Step 4: Record findings in inventory
Write to `reports/harness-pr-inventory-260703.md`:
```markdown
# Harness PR Inventory — 2026-07-03
## Summary
- Total PR files: {N}
- Genuinely-new harness files: 12
- Quality issues found: {N}
- Migration collision: Yes/No
## Issues to Fix
| File | Issue | Severity | Fix |
|------|-------|----------|-----|
| daemon.ts | console.log → logger | High | logger.error() or logger.info() |
| daemon.ts | dead import path | High | Update to canonical |
| ... | ... | ... | ... |
```

## Related Code Files

- Read: `apps/sophia-ai-factory/src/tree/harness/daemon.ts`
- Read: `apps/sophia-ai-factory/src/tree/harness/__tests__/daemon.test.ts`
- Check: `migrations/*.sql` (latest migration number)

## Success Criteria

- [ ] All 12 harness-specific files confirmed not on main
- [ ] Migration 0148 doesn't collide (or collision documented)
- [ ] Quality issues in daemon.ts identified (console.log, dead imports, CF Workers incompatibility)
- [ ] Inventory report saved
