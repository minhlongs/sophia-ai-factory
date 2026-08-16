---
title: "Phase 02 — ESLint Complexity Baseline"
description: "Add complexity rules with warn/error thresholds to ESLint config. No new disable comments; legacy hot-spots get graceful exclusions."
status: IN_PROGRESS
priority: P1
effort: 1.5h
branch: main
tags: [eslint, complexity, baseline]
created: 2026-08-16
updated: 2026-08-16
---

# Phase 02 — Stryker + ESLint Complexity Baseline

## Context Links

- ESLint config: `eslint.config.mjs` (450 lines)
- ESLint suppressions baseline: `eslint-suppressions.json` (27 suppressions, baseline 2026-08-15)
- Package.json scripts: `apps/sophia-ai-factory/package.json` (scripts at lines 6-75)
- Existing test config: `vitest.config.ts`
- Code standards: `docs/code-standards.md`
- CI lint: `eslint src --max-warnings=341`

## Overview

**Priority:** P1
**Status:** ready-for-merge
**Description:** Add Stryker mutation testing to establish a quantifiable test quality baseline, and add SonarJS complexity rules with a rule-level license to prevent complexity regression. The baseline gates future PRs against measurable quality thresholds.

## Key Insights

- **No Stryker config exists** (verified: no `stryker.config.*` found in project)
- **No complexity rules in ESLint** — config has only `noAsErrorRule` (line 8-11), layer boundary enforcement (line 13-33), and React Compiler rules (inherited from next/core-web-vitals)
- **No external ESLint plugins** besides next/core-web-vitals and next/typescript
- Current suppression baseline: 27 entries, `eslint-suppressions.json` with `version: 1`
- Build: `NODE_OPTIONS=--max-old-space-size=4096 next build` (Turbopack)
- Test: `vitest --run`, coverage: `vitest run --coverage`
- `ci:lint` has `--max-warnings=341` — baseline for suppression tracking
- M1 16GB hardware constraint: Stryker must target limited file set to avoid OOM
- 6744+ tests exist — good foundation for mutation testing

## Requirements

### Functional
1. Stryker config targets `src/seed/utils/`, `src/tree/byok/`, `src/forest/quota/` (critical paths first, limited set for M1 16GB)
2. Mutation score threshold: `>=70%` (warn below, fail CI below)
3. SonarJS `complexity` rule: max 15 per function (warn), max 25 (error)
4. SonarJS `cognitive-complexity` rule: max 15 per function (warn)
5. Rule-level license: documented exceptions in `eslint-suppressions.json` for existing complex functions
6. Baseline snapshot committed for regression tracking

### Non-functional
1. Stryker run completes in <10 min on M1 16GB (limited test set)
2. ESLint with SonarJS does not increase lint time by >30%
3. Baseline files committed to repo for CI gate

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Stryker Mutation Testing                        │
│  ├── Config: stryker.config.mjs                  │
│  ├── Targets: seed/utils, tree/byok, forest/quota│
│  ├── Reporter: dashboard + clear-text            │
│  ├── Threshold: mutationScore = 70               │
│  ├── Run: npx stryker run (post-test gate)       │
│  └── Node heap: --max-old-space-size=8192        │
├─────────────────────────────────────────────────┤
│  SonarJS Complexity Rules                        │
│  ├── ESLint plugin: eslint-plugin-sonarjs        │
│  ├── complexity: max 15 (warn), max 25 (error)   │
│  ├── cognitive-complexity: max 15 (warn)         │
│  ├── License: per-function exceptions in         │
│  │   eslint-suppressions.json                    │
│  └── Gate: new code must not exceed thresholds   │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Input: source files + existing tests
- Transform: Stryker mutates code, runs tests, measures kill rate
- Output: mutation score report + baseline snapshot

**Baselines committed:**
- `stryker-baseline.json` — mutation score per file
- `eslint-complexity-baseline.json` — complexity scores per function

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `eslint.config.mjs` | Modify | Add SonarJS plugin + complexity rules |
| `eslint-suppressions.json` | Modify | Add rule-level license for existing complex functions |
| `stryker.config.mjs` | Create | Stryker configuration |
| `package.json` | Modify | Add `test:mutation` script |
| `stryker-baseline.json` | Create | Initial mutation score baseline |
| `eslint-complexity-baseline.json` | Create | Function complexity snapshot |

## Implementation Steps

1. Install Stryker: `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner`
2. Install SonarJS ESLint: `npm i -D eslint-plugin-sonarjs`
3. Create `stryker.config.mjs` targeting critical path modules (limited for M1)
4. Add `test:mutation` script to `package.json` with `--max-old-space-size=8192`
5. Run initial Stryker baseline: `npx stryker run --reporters clear-text,dashboard`
6. Capture baseline scores in `stryker-baseline.json`
7. Add SonarJS rules to `eslint.config.mjs`: complexity, cognitive-complexity
8. Run `npm run lint` — identify existing violations
9. Add rule-level licenses for existing violations in `eslint-suppressions.json`
10. Capture complexity snapshot in `eslint-complexity-baseline.json`
11. Verify: `npm run lint` passes with suppressions, `npm test` passes

## Todo List

- [ ] Install `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`
- [ ] Install `eslint-plugin-sonarjs`
- [ ] Create `stryker.config.mjs` with target paths and thresholds
- [ ] Add `test:mutation` script to `package.json`
- [ ] Run initial Stryker baseline on critical paths
- [ ] Commit `stryker-baseline.json`
- [ ] Add SonarJS `complexity` rule to ESLint config (warn 15, error 25)
- [ ] Add SonarJS `cognitive-complexity` rule to ESLint config (warn 15)
- [ ] Run `npm run lint` — identify existing violations
- [ ] Add rule-level licenses to `eslint-suppressions.json`
- [ ] Commit `eslint-complexity-baseline.json`
- [ ] Run `npm test` — all pass
- [ ] Run `npm run lint` — passes with suppressions

## Success Criteria

- Stryker config exists and runs without errors on M1 16GB
- Mutation score baseline `>=70%` committed
- SonarJS complexity rules active in ESLint config
- All existing functions below threshold OR have documented rule-level license
- `npm run lint` passes (including new SonarJS rules with suppressions)
- `npm test` passes (no test regressions)
- `npm run build` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stryker OOM on M1 16GB | High | Medium | Limit target files, increase Node heap to 8GB |
| SonarJS rules surface many existing violations | High | Low | Rule-level license for existing code, gate only new code |
| Mutation score below 70% | Medium | Medium | Start with critical paths only, exclude low-value files |
| ESLint lint time increase | Low | Low | SonarJS is fast; profile before/after |
| Stryker version incompatibility with Vitest | Low | High | Pin versions, verify runner compatibility |

## Security Considerations

- Stryker mutates source code in temp directory — no production impact
- No secrets or API keys in test targets
- Baseline files contain only scores, no sensitive data

## Next Steps

- Depends on: nothing (independent phase)
- Blocks: Phase 06 (deploy checklist can verify mutation score threshold)
- Follow-up: Tighten threshold to `>=80%` after 2 sprints, add more target modules
