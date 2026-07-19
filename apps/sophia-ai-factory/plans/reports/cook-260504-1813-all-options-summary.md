# /cook all — ClaudeKit + Mekong Hoa Tiêu Implementation

**Date:** 2026-05-04 18:13 PT
**Plan source:** `apps/sophia-ai-factory/plans/reports/navigator-260504-1813-claudekit-mekong-audit.md`
**Status:** All 4 options DONE

## Outcome

| Option | Status | Files |
|---|---|---|
| **A** Sync 5 binh-phap rules + manus-layer-2 | ✅ symlinks | 6 |
| **B** Document Sophia 4-layer + cross-layer + barrel exports | ✅ | 2 rules + 4 barrels |
| **C** Refresh unified architecture plan + bridge doc | ✅ | 4 plan files updated + 1 bridge doc |
| **D** Create `/pilot` command Sophia-aware | ✅ | 1 |

## Files added/modified

**Sophia rules (`.claude/rules/`):**
- 5 symlinks: `binh-phap-{core,quality,cicd,workflow,memory-practices}.md` → `~/.claude/rules/`
- 1 symlink: `manus-layer-2-run-mode.md` → `~/.claude/rules/`
- 2 NEW: `sophia-layer-architecture.md`, `cross-layer-orchestration.md`

**Sophia code (`src/`):**
- 4 NEW barrel exports: `land/billing/index.ts`, `land/payouts/index.ts`, `land/affiliates/index.ts`, `forest/inngest/index.ts`
- (Note: `forest/{raas,usage-metering,quota,middleware,worker}/index.ts` already existed)

**Sophia commands:**
- 1 NEW: `apps/sophia-ai-factory/.claude/commands/pilot.md` (Sophia-aware meta-orchestrator)

**Global plan refresh (`~/plans/260429-2040-claudekit-mekong-unified-architecture/`):**
- `plan.md` — overview rewritten, status PARTIAL→DONE for Phase 1, badges added
- `phase-01-namespace-deduplication.md` — DONE 2026-05-03 closure note
- `phase-02-docs-sync.md` — PARTIAL (2.1+2.2 done, 2.3 → bridge doc)
- `phase-03-unified-source-of-truth.md` — refreshed (3.1+3.2 done, 3.3 → bridge doc)
- `CLAUDEKIT-MEKONG-BRIDGE.md` — NEW single source of truth (90 lines)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npm run build` → exit 0 (Next.js + Turbopack, 144 pages)
- `npm test -- --run` → 2796/2827 pass (31 skipped pre-existing)
- 6 symlinks verified via `ls -la apps/sophia-ai-factory/.claude/rules/`

## Issues encountered

1. **Subagent #1 (rules+barrels) blocked Write/Bash** — handled manually by main session
2. **Subagent #4 (/pilot) blocked Write** — handled manually with full content
3. **Barrel `land/billing/index.ts` ambiguity** — `billing-types` re-exports `ReconciliationError`/`ReconciliationResult` so dropped `./reconciliation-types` from barrel (commented inline)

## Outcome of "hoa tiêu" mission

Sophia hiện inherit đầy đủ binh-phap suite từ global qua symlink (auto-sync với updates).
4-layer architecture giờ có authoritative rule file + cross-layer orchestration documented.
`/pilot` command sẵn sàng làm single entry point cho Sophia work.
Plan unified architecture refresh phản ánh đúng state 2026-05-03.

## Unresolved questions

1. CI guard cho cross-layer rule (auto-detect forest→land violations) — defer hay implement?
2. `@/lib/*` vs `@/seed/*` aliases — đề xuất chọn `@/seed` canonical, deprecate `@/lib` dần. User OK?
3. Should `CLAUDEKIT-MEKONG-BRIDGE.md` cũng copy sang `~/mekong-cli/` repo? (Plan agent bị off-limits.)
4. /pilot command Sophia-only hay nâng lên global? Sophia-specific guard rails (Polar reject, NOWPayments) làm nó khó tái dùng.
