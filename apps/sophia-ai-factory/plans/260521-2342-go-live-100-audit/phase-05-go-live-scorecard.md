# Phase 05 — Go-Live 100/100 Scorecard + Blocker Fix List

## Context Links

- All prior phases feed this: `reports/phase-01-codebase-map.md`, `reports/phase-03-*`, `reports/phase-04-tech-debt-inventory.md`
- Anchor baseline: `plans/reports/actual-fullstack-audit-260515-sophia.md` (87.5/100 under doctrine)
- Doctrine SUSPENDED (see `plan.md` reversal notice)
- Audit framework: `~/.claude/rules/on-demand/actual-fullstack-audit.md` (10-layer matrix)

## Overview

- **Priority:** P1
- **Status:** pending (blocked-by Phase 1-4)
- **Description:** Produce honest /100 scorecard across 10 enterprise categories, deltas vs 87.5 baseline, blocker/high/med/low fix list with effort + impact. This phase produces NO code changes — fixes are scheduled, not applied.

## Key Insights

- Doctrine suspension means operator-creds items (QStash, Sentry token, DMARC quarantine, CF cost alert, off-CF mirror) now score honestly
- Without operator commitments (Q5 unresolved), ceiling is still capped — Phase 5 reports residual gap as honest deduction
- Baseline used 10 layers (DB, Server, Networking, Cloud, CI/CD, Security, Monitoring, Containers, CDN, Backup); user requested 10 categories (Architecture, Reliability, Scalability, Security, Observability, Documentation, Testing, Deployment, DevEx, Maintainability)
- Two taxonomies overlap but differ — Phase 5 SHALL produce **both** rubrics to enable delta-tracking against prior audit AND match user's requested categories

## Requirements

### Functional
1. **Scorecard A (user's 10 categories)** — primary deliverable
2. **Scorecard B (10-layer audit framework)** — delta tracking vs 87.5 baseline
3. **Cross-map table** — show how A and B categories overlap
4. **Per-category criteria** — explicit /100 sub-points so the executor can self-score
5. **Blocker/High/Med/Low fix list** — every gap has fix recipe, effort sizing, expected score lift
6. **Operator commitments section** — explicit list of credentials/dashboards user must provision, with score impact if granted vs withheld

### Non-functional
- ≤10 todos in this phase (scorecard production, not fix execution)
- File:line evidence per score deduction
- Honest scoring — no narrative-inflation (lesson learned from 91.5 vs 87.5 reconciliation)

## Architecture

### Scorecard A — 10 Categories (user-requested)

Each scored /10, total /100. Sub-criteria define the score:

| # | Category | Sub-criteria (each = up to 2 pts unless noted) |
|---|---|---|
| 1 | **Architecture** | Layer purity (cross-layer rule compliance) · Boundary docs · Single-source canonical paths · Public API barrels · Cross-layer orchestration exception correctness |
| 2 | **Reliability** | IPN idempotency · Cron retry config · Error budget visibility · D1 transaction integrity · Graceful degradation paths |
| 3 | **Scalability** | Worker CPU headroom · D1 hot-row strategy · R2 egress pattern · KV cache topology · Auto-scale verified |
| 4 | **Security** | 0 HIGH npm audit · CSP grade · BYOK encryption · Secret-rotation cadence + runbook · No banned imports |
| 5 | **Observability** | Sentry symbolication (suspension allows operator token) · Structured logger · `/api/health` completeness · Alert routing · APM/latency dashboard |
| 6 | **Documentation** | All 8 Phase-2 docs · file:line citations · Bilingual customer docs · Runbooks index · Architecture deep-dive |
| 7 | **Testing** | 956 test count verified · Coverage on tier/billing/payouts · No `.skip/.only` · Pre-push gate active · Determinism (flake rate) |
| 8 | **Deployment** | CF-direct script integrity · Push-guard active · SHA injection · Rollback procedure · Migration apply gate |
| 9 | **DevEx** | Pre-commit speed · npm scripts ergonomic · Local dev loop <60s · Test wall-clock · ESLint baseline ratchet |
| 10 | **Maintainability** | ESLint warning count · `:any` count · `console.*` count · TODO/FIXME debt · `lib/` shim shrinkage |

### Scorecard B — 10-Layer Framework (delta vs 87.5)

L1-L10 per `actual-fullstack-audit.md`. For each: current score, prior 5/15 score, delta, evidence.

### Cross-Map

| User Category | Maps to 10-Layer | Phase 3 Axis |
|---|---|---|
| Architecture | L4 + L8 | Infrastructure |
| Reliability | L1 + L2 | Reliability |
| Scalability | L2 + L9 | Scalability |
| Security | L3 + L6 | Security |
| Observability | L7 | Observability |
| Documentation | (cross-cuts; new explicit axis) | n/a |
| Testing | L5 | DevEx |
| Deployment | L5 | DevEx |
| DevEx | L5 | DevEx |
| Maintainability | (cross-cuts) | (Phase 4 inventory) |

### Fix List Schema

```
| ID | Category | Severity | Finding | File:line / Evidence | Fix Recipe | Effort | Score Lift |
| F1 | Maint | Med | OPENNEXT_VERSION hardcoded | src/app/api/version/route.ts:33 | Derive from package.json or inject via deploy script | small | +0.5 Maint |
```

## Related Code Files

**No edits.** Phase 5 produces:
- `reports/phase-05-scorecard.md` (primary deliverable — both rubrics + cross-map + fix list)
- `reports/phase-05-operator-commitments.md` (what user must provision to hit 100)
- `reports/phase-05-residual-gaps.md` (what stays unfixable even with commitments)

## Implementation Steps

1. Consume Phase 1-4 outputs; build evidence index
2. Score Scorecard A per category with file:line evidence per deduction
3. Score Scorecard B (10-layer) with delta-vs-87.5 column
4. Build cross-map table
5. Compile fix list (from Phase 3 axis gaps + Phase 4 tech debt) into severity-sorted table
6. Resolve plan.md Q1 (operator commitments) by listing exactly what each one would buy
7. Identify residual gaps that stay open even with operator commitments (e.g., DR drill cadence still needs months)
8. Compute final score: HONEST current, ceiling-with-commitments, ceiling-without-commitments
9. Write `phase-05-scorecard.md` with verdict tier per framework (Full Stack++ / Actual Full Stack)
10. Surface to user: blockers must be resolved before "go-live"; high+med are stretch

## Todo List

- [ ] Build evidence index from Phase 1-4 outputs
- [ ] Score Scorecard A (10 categories)
- [ ] Score Scorecard B (10-layer) with delta column
- [ ] Cross-map table
- [ ] Severity-sorted fix list (blocker/high/med/low)
- [ ] Operator-commitments analysis
- [ ] Residual-gaps doc
- [ ] Compute three score points (current/with-commits/max)
- [ ] Final report `phase-05-scorecard.md`
- [ ] User-facing verdict + go-live recommendation

## Success Criteria

- Two scorecards filed (A + B)
- Cross-map shows every Scorecard A category maps to ≥1 Scorecard B layer
- Every score deduction cites file:line OR Phase 3/4 finding ID
- Fix list contains: blocker (P0, must fix before go-live), high (post-launch P1), med (next quarter), low (track)
- Operator-commitments doc explicitly lists Q1 items with score-lift per item
- Final score is internally consistent (sum of sub-criteria = category total)
- Phase produces NO code changes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Narrative inflation (91.5 vs 87.5 lesson) | High | High | Sub-criteria scoring forces honest math; reject any score not backed by sub-points |
| Two-rubric overhead doubles work | Med | Med | Cross-map keeps them aligned; rubric B is delta-only, not full re-audit |
| Operator commitments unclear → blocked finalization | High | Med | Plan.md Q1 resolved BEFORE Phase 5 finalizes; if unresolved, score honestly without |
| User reads "100/100 achievable" as promise | Med | High | Explicit "ceiling with commitments" wording; residual-gaps doc separates code-fixable vs time-only |
| Doctrine reversal forgotten in next session | High | Med | Plan.md surfaces reversal at top; phase-05 reiterates in conclusion |

## Security Considerations

- Operator-commitments doc lists credentials needed — store as env-var NAMES only, never values
- Residual-gaps doc may identify exposure surfaces — ensure not published externally without review

## Next Steps

- **Output:** user decides which blockers to assign to follow-up cycles
- **Memory update:** after scorecard accepted, update `project_sophia_consolidation.md` with new score + prod SHA
- **Doctrine decision** (plan.md Q5): keep doctrine file unchanged OR rewrite if user accepts new ceiling
- **Follow-up plan**: spawn `plans/{date}-go-live-fixes/` for blocker remediation cycle if score < 100
