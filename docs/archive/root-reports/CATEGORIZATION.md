# CATEGORIZATION.md

## KEEP

| Item | Why |
|---|---|
| `apps/sophia-ai-factory/` | Canonical production app and deploy target. |
| `README.md` | Current product, stack, deploy, and protected-flow source. |
| `GOAL.md`, `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, `FOUNDER_MANIFESTO.md` | New Constitution package. |
| `apps/sophia-ai-factory/CLAUDE.md` | Canonical app rules, deploy proof, protected flows. |
| `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` | Authoritative seed/tree/forest/land model. |
| `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` | Authoritative product doctrine. |
| `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` | Authoritative deploy verification. |
| `docs/admin-ops/payment-pricing-source-of-truth.md` | Current payment and pricing truth. |
| `.mekong/tasks/01-first-paying-customer.md`, `.mekong/tasks/05-unit-economics.md` | Business validation tasks with direct revenue relevance. |
| `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md` | Existing ADR evidence for video workflow cleanup. |

## REFACTOR

| Item | Why |
|---|---|
| `AGENTS.md` | Existing file was stale ClaudeKit/OpenCode boilerplate; replaced with Sophia agent contract. |
| `docs/ARCHITECTURE.md` | Existing architecture doc may conflict with current CF-direct/no-tech doctrine; Constitution `ARCHITECTURE.md` is now root truth. |
| `.opc/goal.md` | **ARCHIVED 2026-08-21** — moved to `docs/archive/opc-goal-conflicting.md`. Claimed 99.9% SLA, SOC2 Type II, 10+ enterprise clients, and "RaaS" positioning; none match Constitution truth. |
| `docs/development-roadmap.md` | Valuable history, but current roadmap should be `ROADMAP.md`. |
| `src/lib/*` | Compatibility area remains, but new auth/db/tier imports must use `seed`. Refactor only by risk. |
| `.github/workflows/*` | Some workflows are useful scan templates but conflict with CF-direct deploy doctrine if treated as production deploy. |
| `.sophia-factory/` | Useful agent factory context, but should be aligned with new Constitution and current product docs. |
| `.mekong/tasks/*` | Useful business tasks, but should be linked to `TASKS/` for Constitution-level tracking. |

## ARCHIVE

| Item | Why |
|---|---|
| `docs/archive/` | Historical evidence, not current operating truth. |
| `plans/` | Historical implementation/audit evidence; keep until cleanup decision, but do not treat as current roadmap. |
| `.agents/` | Historical agent run artifacts; archive after extracting any unique operational evidence. |
| `PARALLEL-EXECUTION-*`, `FINAL-DELIVERY-REPORT.md`, `HANDOVER-MANIFEST.md`, `code_review_report.md`, `test-report.json`, `test-results*.json` | Historical delivery evidence, not current source of truth. |
| `docs/handover/` and `apps/sophia-ai-factory/docs/*` | Valuable runbooks, but current customer-facing handover should be reconciled with `EVALUATION.md` and `FOUNDER_MANIFESTO.md`. |
| `docs/go-live-readiness/` | Historical go-live evidence; keep as audit trail, not current deploy doctrine. |

## DELETE

Every DELETE below is a recommendation requiring explicit approval before deletion.

| Item | Business Impact | Technical Impact | Migration Path | Risk |
|---|---|---|---|---|
| `.next/` | None for customers; removes stale local build confusion. | Removes generated Next build artifacts only. | Regenerate with `npm run build` if needed. | Low: ensure no committed source is inside. |
| `.open-next/` | None for customers; avoids citing stale OpenNext output as architecture. | Removes generated Cloudflare build artifacts only. | Regenerate with `npm run deploy:build` if needed. | Medium: verify no custom patched artifacts are only present there. |
| `coverage/` | None. | Removes test coverage output only. | Regenerate with `npm run test:coverage`. | Low. |
| `test-results/`, `test-results*.json` | None. | Removes test output only. | Regenerate tests if needed. | Low. |
| `.claude/worktrees*` | None. | Removes generated agent worktree copies. | Recreate worktrees when needed by harness. | Medium if uncommitted work exists; check git status first. |
| `.agents/` | None after evidence extraction. | Removes historical agent run directories. | Save unique findings into `docs/` or `ADR/` before deletion. | High: may contain unique handoff evidence; audit before delete. |
| `repomix-output.xml` | None. | Removes generated repo snapshot. | Regenerate with repomix if needed. | Low. |
| Stale docs that claim Vercel, GitHub Actions deploy, Polar/PayPal billing, SOC2/SLA promises | Prevents customer/operator confusion. | Reduces conflicting instructions. | Move to `docs/archive/` or update to current truth. | Medium: accidental deletion of useful history; archive first. |
