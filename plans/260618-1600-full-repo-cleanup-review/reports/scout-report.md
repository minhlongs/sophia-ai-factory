# Scout Report: Full Repo Cleanup Review

## Scope

Full repo status after Constitution package creation and Sophia app type-safety cleanup.

## Status

```text
M AGENTS.md
 M apps/sophia-ai-factory/.gitignore
 M apps/sophia-ai-factory/next.config.ts
 M apps/sophia-ai-factory/open-next.config.ts
 M apps/sophia-ai-factory/src/app/[locale]/pricing/error.tsx
 M apps/sophia-ai-factory/src/app/[locale]/pricing/page.tsx
 M apps/sophia-ai-factory/vitest.config.ts
?? .claude/workflows/dashboard-refactor-week2.js
?? .claude/workflows/stabilization-sprint-full.js
?? .claude/worktrees/agent-ae6a26a3264c2fbf7/
?? .claude/worktrees/agent-stabilization-week1/
?? ADR/ADR-0001-cloudflare-direct-deploy.md
?? ADR/ADR-0002-four-layer-architecture.md
?? ADR/ADR-0003-no-tech-byok-doctrine.md
?? ADR/ADR-0004-payment-providers.md
?? ADR/ADR-0005-d1-canonical-persistence.md
?? ADR/ADR-0006-inngest-video-workflows.md
?? ADR/ADR-0007-agent-factory.md
?? ADR/ADR-0008-vi-en-locales.md
?? ADR/ADR-0009-generated-artifacts.md
?? ADR/ADR-0010-constitution-before-rewrite.md
?? ARCHITECTURE.md
?? BUSINESS_MODEL.md
?? CATEGORIZATION.md
?? EVALUATION.md
?? FOUNDER_MANIFESTO.md
?? GOAL.md
?? MONEY_GRAPH.md
?? ROADMAP.md
?? TASKS/constitution-tasks.md
?? apps/sophia-ai-factory/src/lib/dashboard/__tests__/api-keys.test.ts
?? apps/sophia-ai-factory/src/lib/dashboard/__tests__/auth-helper.test.ts
?? apps/sophia-ai-factory/src/lib/dashboard/__tests__/profile-helper.test.ts
?? apps/sophia-ai-factory/src/lib/dashboard/__tests__/redirect-helper.test.ts
?? apps/sophia-ai-factory/src/lib/dashboard/__tests__/tier-helper.test.ts
?? plans/20260617-0159-stabilization-sprint-week1/docs/quality-gates.md
?? plans/20260617-0159-stabilization-sprint-week1/plan.md
?? plans/20260617-0159-stabilization-sprint-week1/reports/bug-triage-inventory.md
?? plans/20260617-0159-stabilization-sprint-week1/reports/dashboard-audit.md
?? plans/20260617-0159-stabilization-sprint-week1/reports/root-cause-analysis.md
```

## Classification

### KEEP

- `AGENTS.md` — canonical Sophia agent contract.
- Constitution docs: `GOAL.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, `FOUNDER_MANIFESTO.md`, `CATEGORIZATION.md`, `TASKS/constitution-tasks.md`, `ADR/*`.
- `.claude/workflows/*` — active workflow definitions.
- `plans/20260617-0159-stabilization-sprint-week1/` — active stabilization sprint.
- Sophia app type-safety changes: `.gitignore`, `next.config.ts`, `open-next.config.ts`, `vitest.config.ts`, pricing page/error boundary.

### DELETE

- `apps/sophia-ai-factory/src/lib/dashboard/__tests__/` — mock tests with no real implementation under test.
- `.claude/worktrees/*` — generated worktree copies, but only after verifying no uncommitted work exists inside them.

### ARCHIVE / REFACTOR LATER

- Historical `plans/` and old `plans/reports/*.md`.
- `docs/archive/`, `docs/handover/`, `apps/sophia-ai-factory/docs/*`.
- `.github/workflows/*` if present and conflicting with CF-direct doctrine.
- `.opc/goal.md`, `docs/ARCHITECTURE.md`, `docs/development-roadmap.md`, `.sophia-factory/`, `.mekong/tasks/*` if they conflict with current Constitution truth.

## Key Risk

The only destructive cleanup candidates are untracked mock tests and generated worktrees. Historical docs/plans should be archived/refactored later, not deleted in this pass.
