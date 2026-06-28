---
phase: 3
title: "Code — Implementation"
description: |
  [VN] Giai đoạn 3: Triển khai code dựa trên design đã duyệt. Output là git commits + tests xanh.
  [EN] Phase 3: Implement code from approved design. Output is git commits + passing tests.
input: "Filled design.md from Phase 2"
output: "Git commits on feature branch, all tests passing"
next-phase: ".sophia-factory/CLAUDE.deploy.md"
---

# Phase 3 — Code

## Purpose
Implement the feature exactly as designed, with full type safety, tests, and passing CI gates. Delegate to CTO agent for execution.

## Agent Instructions

You are acting as **CTO agent** (or routing to CTO via orchestrator). Read the `design.md` fully before writing a single line.

### Step 1 — Branch Setup

```bash
git checkout -b feat/{slug}
# Confirm you are NOT on main
git branch
```

### Step 2 — Implement Per Design File List

Follow the file list from `design.md` exactly. For each file:

1. Check if file exists: if yes, edit in place (never create duplicate).
2. Use canonical imports only:
   ```ts
   import { getCurrentUser } from '@/lib/better-auth-session'
   import { getUserTier } from '@/lib/db/get-user-tier'
   import { createServerClient } from '@/lib/db/client'  // sync, no await
   import { TIER_CONFIGS } from '@/config/tiers'
   ```
3. **BANNED imports**: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`
4. Zod validation on ALL API inputs — no raw `req.body` access.
5. Try/catch on all async operations with typed error handling.
6. Zero `: any` types — use proper interfaces.
7. No `console.log` in production code — use `safe-log` from P2 if available.

### Step 3 — Quality Gates (run after each file)

```bash
npm run typecheck    # must show 0 errors
npm run build        # must succeed
```

If errors → fix immediately, do NOT proceed to next file.

### Step 4 — Write Tests

For each new module in `src/lib/`:
- Unit test in `tests/unit/{module}.test.ts`
- Test: happy path + error path + edge case (empty input, invalid input)
- Coverage target: 80% on new code

For new API routes:
- Integration test in `tests/integration/{route}.test.ts`
- Test: auth-required routes return 401 without token
- Test: tier-gated routes return 403 for wrong tier

```bash
npm test             # all tests must pass
```

### Step 5 — File Size Check

```bash
# Verify no file exceeds 200 LOC
find apps/sophia-ai-factory/src -name "*.ts" -o -name "*.tsx" | \
  xargs wc -l | sort -n | tail -20
```

Any file > 200 LOC → split before committing.

### Step 6 — Commit

```bash
git add apps/sophia-ai-factory/src/{changed-files}
git commit -m "feat({scope}): {description}"
# Example: feat(telegram): add /report command for weekly revenue
```

Rules:
- Conventional commits: `feat|fix|refactor|test|perf`
- No `chore` or `docs` for `.claude/` changes
- No AI references in commit messages
- One commit per logical unit (not one giant commit)

### Step 7 — Final Verification

```bash
npm run typecheck && npm test && npm run build
grep -r ": any" apps/sophia-ai-factory/src | wc -l  # must be 0
grep -r "console\." apps/sophia-ai-factory/src | wc -l  # must be 0
```

All must pass before marking Phase 3 complete.

### Step 8 — Journal

Write `.sophia-factory/journal/YYYYMMDD-code-{slug}.md`:
```
## Action: Implementation of "{feature}"
## Decision: {key implementation choices}
## Outcome: {files created/modified}, {N} tests added, all green
## Lessons: {any pattern or gotcha to remember}
```

## Handoff to Phase 4

Pass to `CLAUDE.deploy.md`:
- Feature branch name
- PR link (create with `gh pr create`)
- Test results summary
- Any env vars needed in CF dashboard

## Anti-Patterns to Avoid
- Do NOT commit failing tests — fix first.
- Do NOT use `: any` as a shortcut.
- Do NOT skip the quality gates.
- Do NOT create new files if existing modules can be extended (DRY).
- Do NOT hardcode secrets, URLs, or tier names as strings.
