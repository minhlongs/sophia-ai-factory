---
description: "🔍 Sophia Harness — quality gates runner (audit, fix, report)"
argument-hint: "[audit|fix|report] [--gate N] [--fix] [--skip 2,4]"
---

# Sophia Harness

Quality gate runner for sophia-ai-factory. 8 gates, auto-fix, markdown reports.

## Commands

```
/harness audit [--gate N] [--fix] [--skip 2,4]   Run quality gates
/harness fix                                      Auto-fix :any, console.*, lint
/harness report [--format markdown|json]          Generate report from last run
```

## Gates

| # | Gate | What |
|---|------|------|
| 1 | typecheck | `tsc --noEmit` |
| 2 | lint | `next lint` |
| 3 | tests | `vitest run` |
| 4 | security | Secrets + OWASP scan |
| 5 | bundle | `next build` output size |
| 6 | i18n | Translation key validation |
| 7 | migrations | D1 pending migration check |
| 8 | sha-match | Production SHA match (info) |

## Examples

```
/harness audit              # all gates
/harness audit --gate 3     # tests only
/harness audit --fix        # auto-fix lint, re-check
/harness audit --skip 5,8   # skip bundle + sha-match
/harness fix                # fix :any, console.*, lint
/harness report             # markdown report in plans/reports/
```

## Evidence

All gate output → `plans/evidence/`. Last run state → `scripts/harness/state/last-run.json`.
