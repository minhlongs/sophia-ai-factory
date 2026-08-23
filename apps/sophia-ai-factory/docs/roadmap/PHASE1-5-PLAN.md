# PHASE 1.5 — Provider Abstraction (SOPHIA 2027 Transformation)

> **Codename:** CREATIVE ECONOMY OS
> **Shipped:** pending · commit `<SHIP-SHA>` · CF-direct deploy
> **Scope:** triaged single-cycle slice deferred from Phase 1 (`docs/roadmap/PHASE1-PLAN.md` §2).

This document records **what shipped**, **what was deliberately not done**, and **where
the remaining work lands**. It is the Phase 1.5 counterpart to `SOPHIA_2027_ROADMAP.md`.

---

## 0. The decision (evidence-based)

The Phase 1 deferral assumed merging `seed/ai` + `tree/ai-providers` was large +
high-risk. Investigation disproved that premise:

- **Two distinct concerns** — `seed/ai/` is runtime transport (live `Provider`
  instances, no persistence, 23 verified importers across all layers).
  `tree/ai-providers/` models persisted tenant provider config (D1 rows).
- **`tree/ai-providers` is dead code** — 0 importers (verified 2026-08-23), and its D1
  tables (`ai_providers`, `ai_usage`) were never created in any migration.
- **Therefore:** NO merge, NO shared barrel. `tree/ai-providers` is formally deprecated
  via `DEPRECATION_REGISTRY`; `seed/ai` stays canonical runtime transport, untouched.

Full rationale: `.orchestrate/latest/plan.md` §2 (decision + rejected alternatives).

---

## 1. What shipped (8 source files, 2 new tests)

| Step | Deliverable | Files | Tests |
|---|---|---|---|
| 1 | **Registry entry** — `DEPRECATION_REGISTRY` entry #8: target `tree/ai-providers`, kind `legacy`, deprecatedAt `2026-08-23`, removableAfter `2026-09-06` (2-sprint buffer), callers `[]`, reason cites 0 importers + tables never migrated. | `src/seed/types/deprecation-markers.ts` | — |
| 1 | **Deprecation markers** — `@deprecated` JSDoc on the `tree/ai-providers/index.ts` barrel; one-line DEPRECATED module header on each of the 5 prod modules (`types`, `registry`, `usage-tracker`, `circuit`, `errors`), pointing at the registry entry. No TODO/FIXME. | `src/tree/ai-providers/{index,types,registry,usage-tracker,circuit,errors}.ts` | — |
| 2 | **Registry test** — co-located test asserting `getDeprecation('tree/ai-providers')` returns correct `removableAfter` / `kind` / empty `callers`, and `deprecationCount()` === 8. Real module under test, no mocks. | `src/seed/types/deprecation-markers.test.ts` (new) | 2 |
| 3 | **Docs** — `DEPRECATION_CANDIDATES.md` verdict MERGE → DEPRECATED (both copies), roadmap row updated, this file. | see §4 below | — |

---

## 2. Gate results (so far — Steps 1–3 gates green)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run src/seed/types/deprecation-markers.test.ts` | 2 passed |
| `npx vitest run src/tree/ai-providers/__tests__/` | 34 passed (module's own suite unaffected by header edits) |
| File sizes (all touched files) | all ≤200 lines |
| `:any` / `console.*` / TODO / FIXME in touched files | 0 hits |
| Layer rule A (`grep "from '@/tree/" src/seed/`) | unchanged baseline (2 hits, both pre-existing test files) |

**Pending before ship (Step 4):** full suite `npx vitest run` (expect ≥7770 passed,
only pinned failure `land/youtube/__tests__/actions.test.ts:322`), `npm run build`,
`npm run lint` (0 new in touched files), protected-flow diff check, clean working tree.

---

## 3. Escrow carried forward (ALL pre-existing, NOT Phase 1.5)

Carried unchanged from `docs/roadmap/PHASE1-PLAN.md` §3:

1. **MED** — 11 pre-existing lint errors in untouched files (`youtube-content-pipeline.ts`
   forest→land ×4 highest priority). Lint-cleanup pipeline.
2. **LOW** — 3 pre-existing tree→land test-only imports.
3. **LOW** — eslint-disable count 45 vs frozen baseline 27. Reconcile in lint-cleanup pipeline.
4. **MED (process)** — suntzu gate agent must receive plan/execution paths inline and write
   verdicts to a fresh filename (`result-verdict-phase1-5.md`).
5. **MED (deploy base)** — `src/land/youtube/__tests__/actions.test.ts:322` fails on a
   frequency-gate assertion. Verified NOT in the Phase 1.5 diff. Deploy carries
   `WARNING: deploying on known-broken base: actions.test.ts:322`.

## 3b. Follow-ups opened by Phase 1.5

| Item | Disposition | Lands in |
|---|---|---|
| `tree/ai-providers` removal | Removal-eligible **2026-09-06** (`getRemovalReady()` surfaces it). Re-grep incl. dynamic `import(` before deleting; delete module + test; decrement registry. Future micro-cycle — NOT automatic. | post-buffer micro-cycle |
| `seed/ai` ↔ `forest/ai` file dedup | Real duplication lives here: 7 duplicated files, 5 ESLint layer exemptions ("mekong-exempt"), zero-importer `forest/ai` barrel. Needs own strangler plan. | suggested Phase 1.7 |
| `seed/ai` file-size debt | 6 files exceed the 200-line guideline — split when the dedup cycle touches them. | with Phase 1.7 |
| Inngest client consolidation | Already scheduled separately. | Phase 1.6 |

---

## 4. Docs changed this phase

| File | Change |
|---|---|
| `/Users/macbook/sophia-ai-factory/docs/architecture/DEPRECATION_CANDIDATES.md` | `tree/ai-providers` verdict MERGE → **DEPRECATED** with evidence line; Action line rewritten; Tổng Kết counts updated (MERGE 12→11, DEPRECATED 2→3). |
| `apps/sophia-ai-factory/docs/architecture/DEPRECATION_CANDIDATES.md` | Registry table gained entry #8 (`tree/ai-providers`) matching the code registry added in Step 1. |
| `apps/sophia-ai-factory/docs/roadmap/SOPHIA_2027_ROADMAP.md` | Transformation Cycles table: Phase 1.5 row ⏳ Deferred → ✅ Shipped `<SHIP-SHA>`, decision noted "kept distinct; dead module deprecated". |
| `apps/sophia-ai-factory/docs/roadmap/PHASE1-5-PLAN.md` | This file (new). |

---

## 5. Architectural note

`seed/ai` and `tree/ai-providers` model different things: a runtime transport instance vs
a persisted tenant config record. Merging would either drag domain state into seed
(seed must stay domain-free) or migrate 23 live importers into tree — churn with no
consumer. If persisted tenant provider config is ever needed again, build it fresh on the
canonical `seed/ai` `Provider` contract rather than resurrecting the unconnected module.
