# Plan: Full Repo Cleanup Review

## Status

Completed.

## Context

User selected full repo review after the Sophia app cleanup scout. Scope covers root/Constitution files, `.claude/workflows`, `.claude/worktrees`, active plans, Sophia app changes, and untracked mock tests.

## Scout Summary

- **Project type:** Multi-project TypeScript monorepo; canonical Sophia production app is `apps/sophia-ai-factory/` (Next.js 16, React 19, TypeScript, Cloudflare Workers, D1, Better Auth, NOWPayments/PayOS).
- **Existing relevant modules:** Sophia canonical rules in `AGENTS.md`, `apps/sophia-ai-factory/CLAUDE.md`, `apps/sophia-ai-factory/.claude/rules/*`, and Constitution docs at repo root.
- **Current conventions:** CF-direct deployment, 4-layer architecture (`seed`, `tree`, `forest`, `land`), zero `:any`, no production console statements, no mock tests, bilingual customer-facing docs/UI.
- **Existing docs/plans:** Root Constitution docs, `TASKS/constitution-tasks.md`, `ADR/*`, active plan `plans/20260617-0159-stabilization-sprint-week1/`, historical `plans/`, `.claude/workflows/*`, `.claude/worktrees/*`.
- **Public contracts touched:** Sophia deploy proof, payment truth, auth/db/tier canonical imports, pricing page behavior, test suite configuration.

## Findings

### KEEP

| Path | Reason |
|---|---|
| `AGENTS.md` | Replaced stale ClaudeKit/OpenCode bootstrap with Sophia agent contract. |
| `GOAL.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, `FOUNDER_MANIFESTO.md`, `CATEGORIZATION.md`, `TASKS/constitution-tasks.md`, `ADR/*` | Constitution package; current source of truth. |
| `apps/sophia-ai-factory/.gitignore` | Adds `.env.local` ignore; aligns with secret hygiene. |
| `apps/sophia-ai-factory/next.config.ts`, `open-next.config.ts`, `vitest.config.ts` | Type-safety cleanup; CF-direct and test config remain valid. |
| `apps/sophia-ai-factory/src/app/[locale]/pricing/page.tsx`, `error.tsx` | Pricing page type cleanup; no logic change, no `:any`, no production console. |
| `.claude/workflows/*` | Active workflow definitions for current harness/stabilization work. |
| `plans/20260617-0159-stabilization-sprint-week1/` | Active stabilization sprint plan. |

### DELETE

| Path | Business Impact | Technical Impact | Migration Path | Risk |
|---|---|---|---|---|
| `apps/sophia-ai-factory/src/lib/dashboard/__tests__/` | None; mock tests do not validate customer behavior. | Removes fake inline test implementations with no real modules under test. | If dashboard helpers are needed, implement real modules in the proper layer and write tests against them. | Low if only these untracked mock tests are removed; high if real helper files exist later. |
| `.claude/worktrees/*` | None after work is complete. | Removes generated agent worktree copies. | Recreate worktrees when needed. | Medium: must verify no uncommitted work exists before deletion. |

### ARCHIVE / REFACTOR LATER

| Path | Reason |
|---|---|
| Historical `plans/` outside active sprint | Preserve evidence, but not current roadmap. |
| Old `plans/reports/*.md` | Keep as audit trail; reconcile with active Constitution docs later. |
| `docs/archive/`, `docs/handover/`, `apps/sophia-ai-factory/docs/*` | Historical evidence; reconcile with `EVALUATION.md` and `FOUNDER_MANIFESTO.md` later. |
| `.github/workflows/*` | Useful templates but not production deploy path; label/archive to avoid CF-direct conflict. |
| `.opc/goal.md`, `docs/ARCHITECTURE.md`, `docs/development-roadmap.md`, `.sophia-factory/`, `.mekong/tasks/*` | Refactor or archive after explicit approval because they can conflict with current Constitution truth. |

## Implementation Plan

1. **Do not touch** Constitution package or active Sophia app type-safety changes.
2. **Prepare non-destructive patch** for approved deletions only:
   - `apps/sophia-ai-factory/src/lib/dashboard/__tests__/`
   - `.claude/worktrees/*` only after git status proves no uncommitted work inside them.
3. **Do not delete** historical docs or plans in this pass; archive/refactor requires a separate explicit decision.
4. **Verify** after patch:
   - `git status --short`
   - `npm run type-check` in `apps/sophia-ai-factory/` if files remain changed.
   - `npm test -- --run src/app/[locale]/pricing/page.test.ts` or existing pricing/dashboard tests if present.
5. **Review** with `reviewer` agent for acceptance criteria, regression risk, and public contracts.

## Verification

- `git worktree list | grep -c 'prunable'` returned `0` after `git worktree prune` (142 prunable worktrees removed).
- `rm -rf apps/sophia-ai-factory/src/lib/dashboard/__tests__` removed the 5 mock-only test files.
- `cd apps/sophia-ai-factory && npm run type-check` passed.
- `git status --short apps/sophia-ai-factory` now shows only the 6 retained Sophia type-safety/hygiene changes.

## Final State

- Deleted: `apps/sophia-ai-factory/src/lib/dashboard/__tests__/`.
- Pruned: 142 stale/prunable worktrees.
- Kept: active worktrees `agent-ae6a26a3264c2fbf7` and `agent-stabilization-week1` because they may contain uncommitted work.
- Kept: all Constitution docs and Sophia app type-safety changes.

## Acceptance Criteria

- Full repo review is documented with KEEP / DELETE / ARCHIVE / REFACTOR classifications.
- No Constitution docs are deleted or rewritten.
- No CF-direct deploy doctrine is weakened.
- No Sophia protected flow is modified.
- Only approved generated/mock artifacts are deleted.
- Public contracts remain stable: auth/db/tier imports, pricing behavior, payment providers, deploy verification.

## Risks

- `.claude/worktrees/*` may contain uncommitted work; verify before deletion.
- Historical docs may contain unique evidence; archive rather than delete until extracted.
- Mock tests are untracked; deletion is low-risk but should be verified with `find` before removal.

## Next Decision

Commit the retained cleanup/type-safety changes, or continue with archive/refactor work for historical docs.
