# Phase 04 — Tech-Debt Discovery

## Context Links

- Phase 1: `reports/phase-01-codebase-map.md`
- Standardization audit: `plans/reports/standardization-audit-260518-0308-sophia.md`
- Layer rule: `.claude/rules/sophia-layer-architecture.md`
- Dev rules: `apps/sophia-ai-factory/.claude/rules/development-rules.md`
- Carryover from prior audit: `OPENNEXT_VERSION = "1.17.3"` hardcoded at `src/app/api/version/route.ts:33`

## Overview

- **Priority:** P1
- **Status:** completed
- **Description:** Discover (don't speculate) tech debt across dead code, anti-patterns, hidden coupling, drift. Classify critical/high/med/low. Each finding cites file:line and proposes minimal fix.

## Key Insights

- `lib/` still has 477 files post-consolidation — compatibility shim layer, some still actively imported (per `sophia-layer-architecture.md` Unresolved note)
- 423 ESLint warnings baseline — opportunity for ratchet-down but not in scope to fix here
- 35 `console.*` refs in observability paths — Phase 3 evaluates leakage, Phase 4 evaluates pattern
- 3 `:any` types in src — small surface, document each
- Memory said consolidation moved 4 domains to seed/tree/forest/land in April; lib/ shim residual

## Requirements

### Functional — discovery checklist
1. **Dead code**: unused exports (knip/ts-prune); orphan files (no inbound import); commented-out blocks ≥10 lines
2. **Anti-patterns**: `any` usage, `// @ts-ignore`, `console.*` in production code paths, async/await on `createServerClient()` (banned per CLAUDE.md), banned `@/lib/auth` `@/lib/subscription` `@/lib/tier-gate` imports
3. **Hidden coupling**: cross-layer violations (seed→tree, tree→forest, tree→land, land→forest); circular deps; god-modules (file >500 lines or >30 inbound imports)
4. **Drift defects** (carryovers + new):
   - `OPENNEXT_VERSION` hardcoded `"1.17.3"` at `src/app/api/version/route.ts:33` — derive from `package.json` at build time or `process.env.OPENNEXT_VERSION` injected via deploy script
   - Tier-config duplication checks (single source = `@/seed/config/tiers`)
   - Migration drift: any `migrations/*.sql` not yet applied to remote D1 (use `wrangler d1 migrations list`)
5. **TODO/FIXME inventory**: count + classify (acknowledged debt vs forgotten)
6. **Banned-import audit**: grep for `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate` (should be 0)
7. **Test debt**: `.skip` / `.only` / `xit()` in test files; flaky test list (if any test history available)

### Non-functional
- Discovery, NOT remediation — fixes go to Phase 5 blocker list with sizing
- File:line per finding mandatory
- ≤10 todos per category to honor "≤10 todos per phase" guidance

## Architecture

Single consolidated report: `reports/phase-04-tech-debt-inventory.md`. Findings classified:

| Severity | Definition | Phase-5 score impact |
|---|---|---|
| Critical | Production bug, security gap, build-blocker | -2 to -5 on relevant category |
| High | Anti-pattern in hot path, hidden coupling causing future incidents | -1 to -2 |
| Med | Style + maintainability drift | -0.5 |
| Low | Cosmetic, dead code w/ no inbound | 0 (track only) |

## Related Code Files

**Read (no edits in this phase — fixes deferred to Phase 5 or follow-up):**
- All `src/**/*.ts*` for grep passes
- `migrations/` for drift check
- `package.json` for dependency-drift comparison
- `src/app/api/version/route.ts:33` (carryover defect)

**Tools:**
- `npx knip` or `npx ts-prune` (dead exports — install if missing)
- `npx madge --circular src/` (circular deps)
- `eslint --format json` (warning categorization)
- `wrangler d1 migrations list sophia-raas-db --remote`

## Implementation Steps

1. Run dead-code scan: `npx ts-prune | tee /tmp/ts-prune.txt`; classify
2. Run circular-dep scan: `npx madge --circular --extensions ts,tsx src/`
3. Run banned-import grep: `grep -rn "@/lib/\(auth\|subscription\|tier-gate\|unified-tier-config\)" src/`
4. Run cross-layer grep (per `cross-layer-orchestration.md`): seed→{tree,forest,land}; tree→{forest,land}; land→forest
5. Run `:any` + `@ts-ignore` + `console.*` inventory
6. Verify migration drift: `wrangler d1 migrations list sophia-raas-db --remote` vs local `ls migrations/`
7. Confirm OPENNEXT_VERSION defect; propose fix recipe (read from package.json at build time via `next.config.ts` or inject as deploy secret)
8. TODO/FIXME inventory
9. Synthesize `reports/phase-04-tech-debt-inventory.md` with classified table
10. Emit Phase-5 input: severity-tagged list with category mapping

## Todo List

- [x] Dead-code scan (ts-prune)
- [x] Circular-dep scan (madge)
- [x] Banned-import audit
- [x] Cross-layer violation grep
- [x] `:any` + `@ts-ignore` + `console.*` inventory
- [x] Migration-drift check vs remote D1
- [x] OPENNEXT_VERSION defect entry + fix recipe
- [x] TODO/FIXME count + classify
- [x] Synthesize inventory report
- [x] Emit Phase-5 severity-tagged input

## Success Criteria

- Single inventory report with all findings in one table
- Every finding has file:line + severity + fix recipe + sizing
- OPENNEXT_VERSION defect included with concrete fix
- Banned-import count = 0 verified (or every violation listed)
- Phase 5 can directly cite findings as score deductions

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tool noise (ts-prune false positives on barrel re-exports) | High | Low | Manual triage; barrel files = expected unused |
| Finding scope explosion (>50 items) | Med | Med | Severity-filter; report shows top-20 per category |
| User over-reacts to low-severity drift | Low | Low | Severity discipline in classification |
| Cross-layer audit miss forest→land "allowed" exception | Med | Med | Reference `cross-layer-orchestration.md` exception list |

## Security Considerations

- Banned-import audit also surfaces forgotten auth pathways
- `console.*` audit identifies potential PII leak surfaces
- Migration drift could indicate forgotten schema changes affecting RLS

## Next Steps

- Feeds Phase 5 score deductions with concrete file:line evidence
- Parallel-safe with Phase 2 + Phase 3
