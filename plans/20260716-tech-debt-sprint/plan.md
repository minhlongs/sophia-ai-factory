# Plan: Y3 Technical Debt Sprint — Migration Consolidation & Layer Enforcement

**Status:** DRAFT — awaiting user approval  
**Created:** 2026-07-16  
**Phase:** 1 of 1 (single cohesive sprint)  
**Estimated effort:** 2–3 engineer-days  
**Stage:** PMF→Early Scale  

## Verdict: 🟢 GO

Score: **22/30** → Proceed to implementation with risk mitigation plan.

Full validation: `go-nogo-report.md`  
BMC: `bmc.md`  
PRD: `prd.md`

---

## Summary

Sophia AI Factory's architecture is sound (4-layer model, 10 ADRs, CF-direct doctrine), but three operational risks threaten deployment reliability:

| # | Risk | Severity | Fix Time | Owner |
|---|------|---------|---------|-------|
| 1 | **Migration numbering chaos** — `0004`, `004`, `005` duplication across 2 directories | HIGH | 4h | Backend |
| 2 | **Layer enforcement convention-only** — no CI gate to prevent layer violations | MEDIUM | 8h | Fullstack |
| 3 | **2 competing ARCHITECTURE.md** — root vs docs/ stale copy | MEDIUM | 1h | Docs |

**Why now?**
- M2 shipped. M3 planning begins. These debts compound with each new migration.
- Recent commits show active multitrack work (billing, SSR/crypto, middleware).
- Adding CI gate before new features prevents drift from becoming costly rework.

**Why not later?**
- Migration duplication is deployment-blocking: wrong apply order → D1 schema errors in production.
- Layer drift is a slow-burn that becomes expensive to reverse after 6 months.

---

## Phases

### Phase 1: Migration Consolidation (CRITICAL) — 4 hours
**Files:** `migrations/` + `apps/sophia-ai-factory/migrations/`  
**Deliverables:**
- Single source of truth for all 152 migration files
- Deduplicated list (0001→0150 clean sequence)
- Audit script: `scripts/audit-migrations.sh`
- Update `scripts/apply-migrations.sh` to reference canonical path

**Risks:**
- Renumbering invalidates applied migrations if not careful — use hash-based verification, not just file names
- Need to verify current D1 state matches expected migration sequence before deploy

**Rollback:** Keep old directory as `.legacy/` until verified on staging D1.

### Phase 2: Layer Enforcement CI Gate (HIGH) — 8 hours
**Files:** New `.claude/rules/` config, `apps/sophia/package.json` scripts  
**Deliverables:**
- ESLint custom rule or script: `scripts/check-layer-imports.ts`
- CI integration: add to `npm run ci` gate
- Update `docs/code-standards.md` with enforcement mechanism
- Documentation of allowed import paths per layer

**Risks:**
- False positives on edge cases (shared types, test utilities) — need allowlist
- Existing code may have violations — fix them in same PR or risk CI failure

**Rollback:** Make the check a warning-only mode first, promote to error after 1 sprint.

### Phase 3: Docs & Root Cleanup (LOW) — 1 hour
**Files:** Root-level markdown files, `docs/ARCHITECTURE.md`  
**Deliverables:**
- Archive 30+ root-level markdown files → `docs/archive/YYYY-MM/`
- Delete or redirect `docs/ARCHITECTURE.md` (root is canonical)
- Add `CROSS_REF.md` mapping deprecated → canonical docs

---

## Acceptance Criteria

- [ ] `npm run ci` passes with 0 errors (includes new layer check)
- [ ] `npm run build` passes with 0 TypeScript errors
- [ ] All 844+ tests pass
- [ ] Migration audit script reports 0 duplicates, 0 filepath conflicts
- [ ] Deploy to staging D1 succeeds (SHA verification matches)
- [ ] All customer-facing docs remain bilingual (VN+EN)

## Dependencies

- None — can execute immediately after approval
- Requires staging D1 access for migration verification
- No breaking changes to public APIs or protected flows

## Handoff

After approval:
```bash
/ck:cook --auto ./plans/20260716-tech-debt-sprint/plan.md
```

Or run phases individually via `/ck:plan` per phase file if parallel execution preferred.
