---
phase: 2
title: "Rebase & Fix Quality Issues"
status: pending
effort: "~1 hr"
priority: P1
dependencies: [1]
---

# Phase 2: Rebase & Fix Quality Issues

## Overview

Create a clean branch from main, cherry-pick the 3 harness-specific commits from the PR, fix quality issues (console.log, dead imports, CF Workers patterns), and update the dashboard UI to match current component conventions.

## Requirements

- Zero `console.log` in production code (use logger instead)
- Zero dead import paths (no `../../lib/` references)
- Use canonical CF Workers patterns (`getCloudflareEnv()` not `process.env`)
- Daemon documented as local-only tool (Remotion check won't work on CF Workers)
- All 5 API routes have proper runtime exports (`export const runtime = 'edge'`)
- Migration renumbered if collision

## Implementation Steps

### Step 1: Create clean branch and cherry-pick harness commits
```bash
cd /Users/macbook/projects/sophia-ai-factory
git checkout main
git checkout -b ship/harness-pr
# Cherry-pick only the harness-specific commits (not the 100+ stale base files)
git cherry-pick 2b0ef3e08 65b5fb3cb 6877cec67
# Resolve conflicts
```

If cherry-pick fails due to dependencies on stale base files, use file-level checkout:
```bash
# Alternative: manually import each harness file
git checkout feature/harness-engineering -- \
  apps/sophia-ai-factory/src/app/api/v1/harness/trigger/route.ts \
  apps/sophia-ai-factory/src/app/api/v1/harness/status/route.ts \
  apps/sophia-ai-factory/src/app/api/v1/harness/jobs/poll/route.ts \
  apps/sophia-ai-factory/src/app/api/v1/harness/jobs/\[id\]/route.ts \
  apps/sophia-ai-factory/src/app/api/v1/harness/check/r2/route.ts \
  apps/sophia-ai-factory/src/app/api/v1/harness/__tests__/route.test.ts \
  apps/sophia-ai-factory/src/tree/harness/daemon.ts \
  apps/sophia-ai-factory/src/tree/harness/__tests__/daemon.test.ts \
  apps/sophia-ai-factory/src/tree/telegram/telegram-bot-harness-handlers.ts \
  "apps/sophia-ai-factory/src/app/[locale]/dashboard/system-health/components/harness-health-card.tsx" \
  migrations/0148_harness_tables.sql
```

### Step 2: Fix daemon.ts quality issues
File: `apps/sophia-ai-factory/src/tree/harness/daemon.ts`

Changes:
1. Replace `import { validateOpenRouter, validateElevenLabs, validateHeyGen } from '../../lib/validation/services';` with canonical imports (check main for equivalent helper functions)
2. Replace `console.log(...)` with `logger.info(...)` / `logger.error(...)`
3. Replace `process.env.HARNESS_SECRET` with `getCloudflareEnv().HARNESS_SECRET` (add `getCloudflareEnv` import from canonical path)
4. Add import: `import { logger } from '@/seed/utils/logger-utility';`
5. Add doc comment noting daemon is local/development-only (Remotion check won't run on CF Workers)

### Step 3: Fix migration number if needed
```bash
# Check if 0148 collides
ls migrations/*.sql | sort | tail -3
# If collision: rename to max+1 and update CREATE TABLE references
mv migrations/0148_harness_tables.sql migrations/XXXX_harness_tables.sql
```

### Step 4: Verify build compiles
```bash
npm run build     # 0 TS errors
```

## Related Code Files

- Modify: `apps/sophia-ai-factory/src/tree/harness/daemon.ts`
- Modify: `migrations/0148_harness_tables.sql` (rename if collision)
- Verify: `apps/sophia-ai-factory/src/app/api/v1/harness/*/route.ts`
- Verify: `apps/sophia-ai-factory/src/tree/telegram/telegram-bot-harness-handlers.ts`

## Success Criteria

- [ ] Cherry-pick or file-level import of all 12 harness files
- [ ] Zero `console.log` in daemon.ts — replaced with logger
- [ ] Zero `../../lib/` imports — all canonical
- [ ] `process.env.HARNESS_SECRET` replaced with `getCloudflareEnv()`
- [ ] Migration number doesn't collide with main
- [ ] `npm run build` → 0 TS errors

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cherry-pick conflicts on all 3 commits | High | Medium | Use file-level checkout instead |
| Daemon's Remotion check uses Node APIs (exec, fs) | High | Medium | Document as local-only; add runtime guard |
| `../../lib/validation/services` has no canonical equivalent | High | Medium | Check if main has equivalent helper; else inline the validation logic |
