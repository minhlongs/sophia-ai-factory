# Phase 01 — Scout + Dependency Analysis

## Context Links
- Plan: [plan.md](plan.md)
- Source: `apps/sophia-ai-factory/src/` (1646 TS files, 102 lib subdirs)
- Output: `reports/scout-260503-dependency-graph.md`
- Mekong reference: `~/mekong-cli/plans/260425-1850-solo-platform-restructure/phase-01-seed-foundation.md`

## Overview
- **Priority:** P1 (blocks all other phases)
- **Status:** pending
- **Effort:** 45m
- **Description:** Static analysis of every TS/TSX file under `apps/sophia-ai-factory/src/` → assign target layer (seed/tree/forest/land) → detect cross-layer violations BEFORE any moves.

## Key Insights
- Sophia is far larger than mekong reference (~1646 files vs ~50). Manual classification infeasible.
- Cross-layer imports are silent killers — `seed → tree` must be ZERO before phase 03 starts.
- Tests live in `__tests__/` co-located AND in `src/__tests__/` — both populations must be classified.
- `src/app/api/*` route handlers each map to a layer based on URL meaning (e.g., `/api/checkout/*` → land).

## Requirements

### Functional
- Generate per-file mapping CSV: `path,target_layer,inbound_refs,outbound_refs,cross_layer_violations`
- Group by target layer with file count
- Top 50 cross-layer violations sorted by severity (deeper layer importing shallower = OK; shallower importing deeper = VIOLATION)
- Identify "ambiguous" files (could fit 2+ layers) for human review

### Non-Functional
- Use `ts-morph` (already in many Node toolchains) OR `madge --json` OR custom `tsx` script
- Run from `apps/sophia-ai-factory/` (deps available)
- Output deterministic so `git diff` of report is meaningful

## Architecture
```
src/**/*.{ts,tsx}
        │
        ▼
   ts-morph project loader (tsconfig.json)
        │
        ▼
   For each SourceFile:
     1. Resolve all imports (skip node_modules)
     2. Classify file → layer (rule table)
     3. Classify each import → layer
     4. If file_layer < import_layer: VIOLATION
        │
        ▼
   Aggregate → markdown report
```

### Layer Classification Rules (pseudo-code)
```ts
function classify(filePath: string): Layer {
  // ORDER MATTERS — first match wins
  if (matches(filePath, ['lib/billing/', 'lib/payments/', 'lib/status/',
                          'app/[locale]/pricing/', 'app/[locale]/status/',
                          'app/checkout/', 'app/api/checkout/',
                          'app/api/payos/', 'app/api/nowpayments/',
                          'app/api/status.json/'])) return 'land';
  if (matches(filePath, ['lib/outbox/', 'lib/api-keys/', 'lib/email/',
                          'lib/onboarding/', 'lib/quota/', 'lib/usage-metering/',
                          'middleware/tenant-isolation', 'app/[locale]/onboarding/',
                          'app/api/v1/api-keys/', 'app/api/welcome/'])) return 'forest';
  if (matches(filePath, ['app/setup-wizard/', 'lib/handover/', 'lib/telegram/',
                          'app/[locale]/dashboard/admin/'])) return 'tree';
  if (matches(filePath, ['lib/db/', 'lib/utils/', 'lib/security/', 'types/',
                          'config/', 'lib/better-auth-', 'lib/agents/base-agent',
                          'lib/health/', 'middleware-helpers'])) return 'seed';
  return 'AMBIGUOUS';
}
```

## Related Code Files

### To create
- `apps/sophia-ai-factory/scripts/scout-layer-classify.mts` — ts-morph classifier
- `plans/260503-1030-sophia-mekong-restructure/reports/scout-260503-dependency-graph.md` — output

### To read (no edits)
- `apps/sophia-ai-factory/tsconfig.json`
- `apps/sophia-ai-factory/src/**/*.{ts,tsx}` (read-only scan)

## Implementation Steps

1. Create `scripts/scout-layer-classify.mts` with classifier rules above
2. Use ts-morph to load Project from `tsconfig.json`
3. Walk all SourceFiles, assign layer, collect imports
4. For each import, resolve target file, classify it, compare layer indexes (0=seed, 1=tree, 2=forest, 3=land)
5. Flag violation if `file_layer_idx < import_layer_idx`
6. Write CSV `reports/scout-260503-classification.csv`
7. Write markdown summary `reports/scout-260503-dependency-graph.md` with:
   - Layer counts table
   - Top 50 violations
   - Ambiguous files list (require human review)
   - Recommended pre-refactors before Phase 03
8. Commit: `chore(scout): mekong restructure — phase 01 dependency graph`

## Todo List

- [ ] Create scout script
- [ ] Run classifier, output CSV
- [ ] Generate markdown report
- [ ] Manual review of AMBIGUOUS bucket — decide layer
- [ ] List pre-refactor TODOs (any cross-layer fixes needed before Phase 03)
- [ ] Commit report + script

## Success Criteria
- Report exists with 100% file coverage (count = `find src -name '*.ts' -o -name '*.tsx' | wc -l`)
- Zero AMBIGUOUS files OR all AMBIGUOUS files explicitly assigned via human review
- Violations sorted by frequency, top 50 documented
- Ready-to-execute pre-refactor TODO list (if any)

## Risk Assessment
- **M** Classifier rules incomplete → AMBIGUOUS bucket too large. Mitigation: iterate rules until <10 ambiguous.
- **L** ts-morph slow on 1646 files. Mitigation: use `skipFileDependencyResolution: true` if needed.
- **L** Test files miscategorized. Mitigation: classify test by SOURCE under test (e.g., `lib/billing/foo.test.ts` → land).

## Security Considerations
- Read-only scan, no writes outside `scripts/` and `plans/`. Safe.

## Next Steps
- **Blocks:** Phase 02 onwards
- If violations >0 → spawn Phase 02.5 "Fix cross-layer violations" before Phase 03
