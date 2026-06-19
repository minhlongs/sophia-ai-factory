# Complete Refactor Sprint Plan (Days 4-7)

**Project**: Sophia AI Factory — Video Domain Re-architecture  
**Plan ID**: 260619-1430  
**Created**: 2026-06-19  
**Status**: Pending Implementation  
**Scope**: Days 4-7 of 7-Day Refactor Sprint + God Files

---

## Executive Summary

This plan completes the remaining refactoring work started in Days 1-3. The goal is to:

1. Extract business logic from Inngest functions to land layer (Day 4)
2. Reorganize forest/missions by domain (Day 5)
3. Eliminate layer violations (Day 6)
4. Update documentation (Day 7)
5. Split God files in parallel (sop-definitions, circuit-breaker, video-service)

**Success Metrics**:

| Metric | Target |
|--------|--------|
| publish-execute.ts size | <100 lines (thin wrapper) |
| generate-campaign.ts size | <100 lines |
| Largest file size | <300 lines |
| Land→forest imports | 0 |
| Tree→forest imports | 0 |
| TypeScript errors | 0 |
| Test pass rate | 100% |
| Build | ✅ |

---

## Phase Index

| Phase | Title | Status | Dependencies |
|-------|-------|--------|--------------|
| [Phase 04](#phase-04---inngest-functions-refactor) | Inngest Functions Refactor | Not Started | Day 3 complete |
| [Phase 05](#phase-05---forest-missions-reorganization) | Forest Missions Reorganization | Not Started | Phase 04 (partial) |
| [Phase 06](#phase-06---layer-violations-cleanup) | Layer Violations Cleanup | Not Started | Phase 04, 05 |
| [Phase 07](#phase-07---documentation) | Documentation | Not Started | Phase 04, 05, 06 |
| [God Files](#god-files-parallel) | God File Elimination | Not Started | Can run parallel with 04-06 |

---

## Phase 04 — Inngest Functions Refactor

**File**: `phase-04-inngest-refactor.md`

**Objective**: Extract business logic from `publish-execute.ts` (620 lines) and `generate-campaign.ts` (340 lines) into land layer, leaving thin Inngest wrappers.

**Key Deliverables**:

1. `land/video/publishing/execute.ts` — Publishing FSM (from publish-execute.ts)
2. `land/video/generation/campaign-orchestrator.ts` — Campaign workflow (from generate-campaign.ts)
3. `forest/inngest/functions/publish-execute.ts` — Thin wrapper (~50 lines)
4. `forest/inngest/functions/generate-campaign.ts` — Thin wrapper (~50 lines)
5. Move helper files: `generate-campaign-db.ts`, `generate-campaign-video-poller.ts`, `generate-campaign-refund-notify.ts` → `land/video/generation/`
6. Move 14 publishers from `forest/publishing/` → `land/video/publishing/providers/`

**Verification**:

```bash
cd apps/sophia-ai-factory
npm run type-check
npm test
npm run build
# Wrapper size check
wc -l src/forest/inngest/functions/publish-execute.ts  # <100
wc -l src/forest/inngest/functions/generate-campaign.ts  # <100
# Publishers moved
ls src/land/video/publishing/providers/*-publisher.ts | wc -l  # 14
```

**Rollback**: `git reset --hard HEAD` on feature branch

---

## Phase 05 — Forest Missions Reorganization

**File**: `phase-05-missions-reorg.md`

**Objective**: Reorganize `forest/missions/` from flat (7 files) into subdirectories by domain.

**Structure**:

```
forest/missions/
├── video/          (emit-video-generate.ts)
├── campaign/       (future campaign.*)
├── billing/        (billing webhook, subscription.*)
├── quota/          (quota.*)
├── common/         (dispatcher, command-registry, checkpoint-persistence, api-key-auth)
└── index.ts        (deprecated barrel re-export)
```

**Steps**:

1. Create subdirectories
2. Move files with `git mv`
3. Update all imports throughout codebase (use grep)
4. Update barrel `forest/missions/index.ts` for backward compatibility
5. Verify no broken imports

**Verification**:

```bash
test -d src/forest/missions/video
test -d src/forest/missions/campaign
test -d src/forest/missions/billing
test -d src/forest/missions/quota
test -d src/forest/missions/common
npm run type-check
npm test
```

**Rollback**: `git mv` reverse or reset to commit

---

## Phase 06 — Layer Violations Cleanup

**File**: `phase-06-layer-violations.md`

**Objective**: Fix forbidden cross-layer imports:

- **Land → forest**: 23 occurrences (CRITICAL)
- **Tree → forest**: 42 occurrences (CRITICAL)
- Land → tree: 55 occurrences (review only, allowed)

**Strategy**:

### Land → Forest (23)

Land must NOT import forest. Fixes:
- Move orchestration code from land → forest
- Extract shared logic to `seed/utils/` or `tree/`
- Replace direct calls with Inngest events

### Tree → Forest (42)

Tree must only import seed. Fixes:
- Move `tree/telegram/*`, `tree/gateway/*` to `forest/`
- Extract helpers to `seed/utils/`
- Invert dependencies with events

**Verification**:

```bash
# Expect 0 violations
grep -rn "from ['\"]@/forest" src/land/ | grep -v "\.test\.ts" | wc -l  # 0
grep -rn "from ['\"]@/forest" src/tree/ | grep -v "\.test\.ts" | wc -l  # 0
npm run type-check
npm test
```

**Rollback**: Revert imports or move files back

---

## Phase 07 — Documentation

**File**: `phase-07-documentation.md`

**Objective**: Update docs to reflect new architecture.

**Deliverables**:

1. Update `apps/sophia-ai-factory/CLAUDE.md` with Post-Refactor Structure section
2. Create `docs/video-domain-architecture.md` (architecture guide)
3. Create `docs/migration-guide-inngest-to-land.md` (migration patterns)
4. Update `plans/reports/bootstrap-audit-20260619.md` with final metrics
5. Create `reports/refactor-completion-summary.md`

**Verification**:

```bash
test -f apps/sophia-ai-factory/CLAUDE.md  # updated
test -f docs/video-domain-architecture.md
test -f docs/migration-guide-inngest-to-land.md
grep -q "Post-Refactor Structure" apps/sophia-ai-factory/CLAUDE.md
```

---

## God Files (Parallel Workstream)

These can be done alongside Days 4-6, but schedule to avoid conflicts.

### G1: Split sop-definitions.ts (666 lines)

**Current**: `seed/config/sops/sop-definitions.ts` contains all 5 SOPs.

**Target**: Split into per-SOP files + barrel:

```
seed/config/sops/
├── sops/
│   ├── faceless-youtube-cash-cow.ts
│   ├── tiktok-creativity-program.ts
│   ├── youtube-shorts-monetization.ts
│   ├── ugc-creator-agency.ts
│   ├── ai-avatar-video-agency.ts
│   └── index.ts (barrel re-exports)
└── index.ts (deprecated barrel)
```

**Verification**: `wc -l` all <200 lines

### G2: Move circuit-breaker.ts (268 lines)

**Current**: `land/fulfillment/circuit-breaker.ts` depends on `land/monitoring/slack-alert`.

**Target**: `seed/utils/circuit-breaker.ts` with no land dependencies.

- Extract core logic (state machine, KV, shouldDispatch, resetCircuit)
- Remove land-specific Slack alerts (replace with optional callback hooks)
- Create wrapper `land/fulfillment/circuit-breaker-wrapper.ts` for backward compat
- Update all imports from `@/land/fulfillment/circuit-breaker` → `@/seed/utils/circuit-breaker`

**Verification**:
```bash
test -f src/seed/utils/circuit-breaker.ts
grep -rn "from '@/land/fulfillment/circuit-breaker" src/ | wc -l  # 0 (or only wrapper)
```

### G3: Split video-service.ts (452 lines)

**Current**: `land/video/generation/video-service.ts` is God service.

**Target**:
- `video-generation-service.ts` — generateVideo, retryVideo
- `video-status-service.ts` — getVideoStatus
- `video-publishing-service.ts` — publishVideo (move to `land/video/publishing/`)
- Original `video-service.ts` becomes barrel re-export

**Verification**:
```bash
wc -l src/land/video/generation/video-service.ts  # <100 (barrel)
test -f src/land/video/generation/video-generation-service.ts
test -f src/land/video/generation/video-status-service.ts
test -f src/land/video/publishing/publishing-service.ts
```

---

## Execution Order

Recommended sequence to minimize conflicts:

1. **Phase 04** (Inngest refactor) — this will reduce some land→forest violations automatically
2. **Phase 05** (Missions reorg) — after Phase 4 updates imports
3. **God Files** (parallel) — after Phase 4 to avoid moving files twice
4. **Phase 06** (Layer violations) — after all moves complete
5. **Phase 07** (Documentation) — last, after all code changes stable

---

## Required Tools

- `git` — version control, branching, rollback
- `npm` — type-check, test, build
- `grep` — find imports to update
- `wrangler` — deploy verification (if applicable)

---

## Quality Gates

Every phase must pass before proceeding to next:

- ✅ `npm run type-check` — 0 errors
- ✅ `npm test` — all tests pass
- ✅ `npm run build` — success
- ✅ Verification commands specific to phase
- ✅ Code review (use `code-reviewer` subagent)

---

## Notes

- **Backward Compatibility**: Keep barrel exports (`index.ts`) for moved files to avoid breaking consumers.
- **Testing**: Do not skip tests. Run after each sub-step.
- **Deploy**: Follow `sophia-deploy-verify.md` — SHA match required.
- **Layer Rules**: See `sophia-layer-architecture.md` and `cross-layer-orchestration.md`.

---

## Plan Status

| Phase | Planned | In Progress | Completed | Blocked |
|-------|---------|-------------|-----------|---------|
| 04 | ✅ | ❌ | ❌ | ❌ |
| 05 | ✅ | ❌ | ❌ | ❌ |
| 06 | ✅ | ❌ | ❌ | ❌ |
| 07 | ✅ | ❌ | ❌ | ❌ |
| God Files | ✅ | ❌ | ❌ | ❌ |

---

**Plan Ready**: 2026-06-19  
**Next Step**: User approval → Begin Phase 04 implementation with multi-agent orchestration
