# Harness PR Inventory — 2026-07-03

## Summary
- Total PR file set: ~100+ (dominated by stale base divergence)
- Genuinely-new harness files: **9** (2 of 12 already on main)
- Already-on-main files: `harness-health-card.tsx`, `harness/jobs/[id]/route.ts`
- Migration collision: **YES** — 0148 exists on main

## Issues to Fix

| File | Issue | Severity | Fix |
|------|-------|----------|-----|
| `tree/harness/daemon.ts` | 7x console.log/console.error | High | Replace with logger |
| `tree/harness/daemon.ts` | 5x process.env | High | Replace with getCloudflareEnv() |
| `tree/harness/daemon.ts` | `../../lib/validation/services` import | High | Use `@/seed/validation/services` |
| `tree/harness/daemon.ts` | `child_process` exec() | Medium | Document as local-only |
| `migrations/0148_harness_tables.sql` | Collision with 0148 on main | High | Rename to 0149 |
| `jobs/[id]/route.ts` | Already exists on main | Low | Don't import |
| `harness-health-card.tsx` | Already exists on main | Low | Don't import |
