# Phase 01 — Codebase Intelligence + Dirty-Tree Triage

## Context Links

- Prior audit: `plans/reports/actual-fullstack-audit-260515-sophia.md` (87.5/100)
- Prior handover: `plans/reports/handover-260515-0930-v3-gap-91-5to94.md`
- Architecture rule: `.claude/rules/sophia-layer-architecture.md` (seed/tree/forest/land)
- Cross-layer rule: `.claude/rules/cross-layer-orchestration.md`
- Deploy rule: `.claude/rules/sophia-deploy-verify.md`
- Doctrine (suspended for this cycle): `.claude/rules/sophia-no-tech-doctrine.md`

## Overview

- **Priority:** P1 — blocks all downstream phases
- **Status:** pending
- **Description:** Observe, map, verify. Produce architecture/dependency/risk artifacts that Phase 2-5 consume. Resolve unpushed HEAD + dirty tree before any further work.

## Key Insights

- HEAD `d68b4d96` is unpushed → deploy guard blocks; precondition for any verification deploy
- Dirty tree concentrated in `src/tree/handover/handover-doc-generator{,.test}.ts`, `handover-tier-content{,.test}.ts`, project rules, docs — likely a partial handover-doc feature in flight
- Memory said 410 test files; local find returns 956 — large delta needing reconciliation
- Prior audit's scoring rubric is the anchor — deltas must be measurable against it
- 17 cron triggers + 8 worker bindings + 117 migrations + ~467 API handlers — large surface for mapping

## Requirements

### Functional
- Architecture map: layer file counts, key entry points, boundary violations (if any)
- Dependency graph: top-30 most-imported modules; circular dep check; cross-layer rule compliance
- Risk map: services-of-last-resort (auth, DB client, deploy script, IPN webhook); blast radius if each fails
- Test inventory: total count, by layer, coverage gaps for tier-config / billing / payouts
- Cron + binding inventory: every `wrangler.toml` trigger mapped to handler file:line; every binding mapped to consumer
- Live-vs-repo drift: prod SHA, `/api/version` JSON, OpenNext live version, D1 schema (latest migration applied?)

### Non-functional
- No code edits in this phase (read-only audit)
- Researcher reports under `research/researcher-NN-*.md` (≤200 lines each)

## Architecture

Six parallel researcher subagents (independent subsystems, no file overlap):

| ID | Topic | Output |
|---|---|---|
| R1 | CF Worker entry + wrangler bindings + cron lifecycle | `research/researcher-01-worker-and-crons.md` |
| **R2** | **D1 schema graph (117 migrations, 2 DBs, tag-cache split)** | **`research/researcher-02-d1-schema-graph.md`** ✅ |
| R3 | Auth + tier-config single-source model (Better Auth + seed/auth) | `research/researcher-03-auth-tier-model.md` |
| R4 | Deploy script chain + push-guard + SHA injection | `research/researcher-04-deploy-chain.md` |
| R5 | Setup Wizard BYOK flow (customer onboarding gate) | `research/researcher-05-byok-wizard.md` |
| R6 | Test infra topology (956 files, runners, coverage gaps) | `research/researcher-06-test-topology.md` |

Synthesizer (planner) produces `reports/phase-01-codebase-map.md` with consolidated maps.

## Related Code Files

**Read (entry points to map):**
- `wrangler.toml`, `next.config.ts`, `open-next.config.ts`
- `src/app/api/version/route.ts`, `src/app/api/health/route.ts`
- `src/seed/auth/better-auth-session.ts`, `src/seed/db/client.ts`, `src/seed/config/tiers/*`
- `src/forest/inngest/*`, `src/land/billing/*`, `src/tree/byok/*`
- `scripts/deploy-with-sha.sh`, `scripts/apply-migrations.sh`
- `package.json`, `vitest.config.ts`
- `migrations/0001-*.sql` through `migrations/0117-*.sql` (index only — not full reads)

**No files modified in Phase 01.**

## Implementation Steps

1. **Dirty-tree triage**: `git status` full read; classify each modified file as (a) in-scope for B1/B2/B3 already-committed work, (b) partial handover-doc feature needing ship, or (c) scratch to revert. Decide path forward. Document in `reports/phase-01-dirty-tree-decision.md`.
2. **Push HEAD `d68b4d96`** to `origin/main` (and `gitlab` mirror) once dirty-tree decision is committed — clears deploy-guard block.
3. **Verify live prod state**: `curl /api/version` → confirm shortSha, deployedAt, opennextVersion; record actual vs claimed.
4. **Dispatch R1-R6 researchers in parallel** with explicit work context = `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory` and reports path = `plans/260521-2342-go-live-100-audit/research/`.
5. **Reconcile test-file count** (410 vs 956): rerun `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`; identify if prior audit excluded `__tests__/` dirs.
6. **Synthesize `reports/phase-01-codebase-map.md`**: layer counts, top-30 imports, cross-layer compliance, critical-path services, blast-radius matrix.
7. **Flag for Phase 4**: pre-record `OPENNEXT_VERSION` hardcoded defect, any boundary violations, any circular deps.

## Todo List

- [ ] Triage dirty tree; decide ship/abandon for handover-doc changes
- [ ] Commit + push to clear deploy-guard
- [ ] Verify `/api/version` against local HEAD; record drift
- [ ] Dispatch 6 parallel researchers (R1-R6)
- [ ] Reconcile test-file count discrepancy
- [ ] Build top-30 imported-module list
- [ ] Synthesize `reports/phase-01-codebase-map.md`
- [ ] Pre-flag Phase 4 carryovers (OPENNEXT_VERSION + any new finds)

## Success Criteria

- All 6 researcher reports filed
- `reports/phase-01-codebase-map.md` consolidated; contains layer/import/cron/binding/risk maps
- HEAD pushed; deploy-guard unblocked
- Dirty tree resolved (no uncommitted Sophia files)
- Test count reconciled with prior audit
- Zero file edits to `src/` (read-only phase)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Handover-doc partial feature breaks build if committed mid-flight | Med | High | Run `npm run build && npm test` before committing dirty tree |
| Pushing reveals secrets via secretlint catch | Low | High | Pre-push hook already runs secretlint; trust existing gate |
| Researcher reports contradict each other | Med | Low | Planner synthesizes; flag contradictions for user resolution |
| Live prod SHA query fails (Worker down) | Low | Med | Fallback: `wrangler tail` for live state; rerun curl with retry |

## Security Considerations

- No secret reads; no `.env` access
- Researchers receive read-only context; no shell exec rights beyond grep/find/cat
- Dirty-tree push: secretlint pre-push hook catches accidental key commits

## Next Steps

- **Unblocks:** Phase 2 (doc backfill), Phase 3 (readiness audit), Phase 4 (tech debt)
- **Feeds:** all downstream phases consume `reports/phase-01-codebase-map.md` + researcher reports
- **Handoff to Phase 2-4:** parallel-dispatch once Phase 1 reports land
