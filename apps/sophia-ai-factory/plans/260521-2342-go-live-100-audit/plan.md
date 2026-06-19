---
title: "Go-Live 100/100 Production-Readiness Audit & Hardening"
description: "Five-phase audit + hardening cycle targeting honest 100/100 across 10 enterprise categories. Doctrine v1.28.1 operator-creds ceiling SUSPENDED for this cycle."
status: complete
priority: P0
effort: large
branch: main
tags: [audit, go-live, hardening, production-readiness, doctrine-reversal]
created: 2026-05-21
---

# Go-Live 100/100 — Production-Readiness Audit & Hardening

## ⚠️ Doctrine Reversal Notice (READ FIRST)

`sophia-no-tech-doctrine.md v1.28.1` (2026-05-15) capped honest score ceiling at 87.5/100 by classifying operator third-party setup (QStash crons, Sentry sourcemap upload, DMARC quarantine, monthly DR drills) as OUT-OF-SCOPE — not score-deductible. **The user has consciously suspended that ceiling clause for this audit cycle.** Operator-creds gaps now count as real deductions and are in-scope to close.

What is **NOT** reversed: CF-direct deploy doctrine (GitHub Actions stays disabled), Polar.sh rejection, no-code BYOK for customers.

What **IS** reversed: operator may now provision QSTASH_TOKEN, SENTRY_AUTH_TOKEN, DMARC tooling, off-CF backup mirror, cost-alert dashboards — these become legitimate score paths.

Future sessions: this reversal is local to this plan. The doctrine file is NOT being rewritten here; resolve before any post-100 follow-up.

## State Anchors (verified 2026-05-21 23:42)

- HEAD: `d68b4d96` ("close B1/B2/B3 public-launch blockers") — UNPUSHED, deploy-blocked
- Prod SHA: `b8c4f6dd` (1 commit behind HEAD; `/api/version` confirms)
- Dirty tree: docs (~25 files) + `src/tree/handover/handover-doc-generator{,.test}.ts` + `handover-tier-content{,.test}.ts` + project rules. Scope = in-flight handover doc generator feature. Phase 1 must resolve.
- Prior baseline: `plans/reports/actual-fullstack-audit-260515-sophia.md` (87.5/100 under doctrine)
- Tests: 956 test files locally (audit said 410 — recount delta). 117 migrations (latest `0117-refresh-video-generation-starter-sop.sql`).
- Layer counts: seed 192 · tree 199 · forest 428 · land 171 · lib 477 · app 946 .ts/.tsx files
- Known defect carried forward: `OPENNEXT_VERSION = "1.17.3"` hardcoded at `src/app/api/version/route.ts:33` vs `package.json ^1.19.5`

## Phases

| # | Phase | File | Status |
|---|---|---|---|
| 1 | Codebase intelligence + dirty-tree triage | [phase-01-codebase-intelligence.md](./phase-01-codebase-intelligence.md) | completed |
| 2 | Documentation backfill (README/QUICKSTART/ARCH/RUNBOOKS/INCIDENT/SECURITY) | [phase-02-documentation-backfill.md](./phase-02-documentation-backfill.md) | completed |
| 3 | Production-readiness audit (reliability/scale/security/observability/devex/infra) | [phase-03-production-readiness-audit.md](./phase-03-production-readiness-audit.md) | completed |
| 4 | Tech-debt discovery (dead code, anti-patterns, hidden coupling, classified) | [phase-04-tech-debt-discovery.md](./phase-04-tech-debt-discovery.md) | completed |
| 5 | Go-Live gap analysis — 10-category /100 scorecard + blocker fix list | [phase-05-go-live-scorecard.md](./phase-05-go-live-scorecard.md) | completed |

## Dependencies

- Phase 1 → 2,3,4 (intelligence artifacts feed all downstream phases)
- Phase 2 ∥ Phase 3 ∥ Phase 4 (parallel-safe after Phase 1; different output files)
- Phase 5 depends on all prior phases (synthesizes deltas into scorecard)
- Phase 1 dirty-tree resolution MUST land before any phase commits new files

## Out-of-Scope (do not propose)

- Polar.sh integration (rejected for Sophia)
- Restoring GitHub Actions CI for deploy (CF-direct is permanent doctrine)
- Mass rewrites of `lib/` → `seed/tree/forest/land` (consolidation 2026-04-14 left lib/ as compat shim; in-flight, not this cycle)
- Multi-region/multi-cloud failover (single-vendor CF accepted)
- Premature refactor recommendations without code citation

## Success Criteria

- Plan files complete; researcher reports filed in `research/`
- Audit reports filed in `reports/` per phase
- Phase 5 scorecard produces honest /100 per category with file:line evidence
- Each gap classified blocker/high/med/low with fix recipe + effort sizing
- OPENNEXT_VERSION defect is included in Phase 4 with fix recipe
- Dirty tree resolved (commit, ship, or abandon — decided in Phase 1)
- Unpushed HEAD pushed (precondition for any subsequent deploy work)

## Unresolved Questions (resolve before execution)

1. **Operator credential commitments**: Does the user intend to provision (a) Upstash QStash for external backup cron, (b) Sentry `SENTRY_AUTH_TOKEN` for sourcemap symbolication, (c) DMARC `p=quarantine` migration tooling, (d) CF monthly cost-alert? Without these, Phase 5 will report residual gaps honestly — but the 100/100 ceiling becomes unreachable. (Recommend: confirm yes/no per item before Phase 5 finalizes scorecard.)
2. **Dirty-tree decision**: Is the `handover-doc-generator` + `handover-tier-content` work part of B1/B2/B3 (already committed in `d68b4d96`) or a new uncommitted feature? Phase 1 verifies; if new feature → ship before audit cycle starts; if abandoned scratch → revert.
3. **Audit baseline reconciliation**: RESOLVED — test surface grew (956 files; 501 ts pass; 4856 tests pass).
4. **Memory drift**: Memory snapshot said prod SHA `93b190e0`; live is `b8c4f6dd`. Memory entry `project_sophia_consolidation.md` is stale — Phase 5 updates after scorecard lands.
5. **Doctrine post-cycle**: RESOLVED — doctrine file NOT rewritten; reversal stays local to this plan per user override.
