# PHASE 1.6 — Inngest Client Merge (SOPHIA 2027 Transformation)

> **Codename:** CREATIVE ECONOMY OS
> **Date:** 2026-08-23 · commit `<SHIP-SHA>` (orchestrator fills at ship) · CF-direct deploy
> **Scope:** workflow-consolidation slice — merge duplicate Inngest clients via strangler pattern.

This document records **what shipped**, **gate results so far**, and **where the remaining
work lands**. It is the Phase 1.6 counterpart to `SOPHIA_2027_ROADMAP.md`.

---

## 0. The decision (evidence-based)

Two live `Inngest` clients shared the **same app id** (`sophia-ai-factory`) but held
**divergent event schemas**:

- `src/seed/inngest/client.ts` — 28 events (campaign, video pipeline, payouts, SOP, …)
- `src/tree/inngest/client.ts` — 5 agent-mission events (`agent.mission.started`, …)
- `src/forest/inngest/client.ts` re-exported the **tree** client; the serve route served it.

Same id + divergent schemas silently defeats Inngest's type safety (an event known to one
client's schema can reach functions typed against the other with no compile error), and the
split was a layer inversion (a foundational event contract living partly in `tree`).

**Therefore:** merge into ONE canonical client in `seed` — the foundational layer every
other layer may import. Behavior-preserving: same app id, superset schema, import-path-only
migration. Full rationale: `.orchestrate/latest/plan.md` §1–§2.

---

## 1. What shipped

| Step | Deliverable | Files | Notes |
|---|---|---|---|
| 1 | **Merged schema in seed** — 33-key `Events` record (28 former seed + 5 agent-mission). Split into two files because a single merged file (~290 lines) would violate the ≤200-line gate. Reconciliation: `url_revenue.video.requested.userId` optional (handler reads `tenantId`; sender deprecated per ADR 0007); `agent.mission.started` carries the rich payload its sender actually emits. | `src/seed/inngest/event-types.ts` (197), `src/seed/inngest/agent-event-types.ts` (73) | ≤200-line gate |
| 1 | **Thin canonical client + barrel** — sole `new Inngest()` in the codebase, id `sophia-ai-factory`. | `src/seed/inngest/client.ts` (19), `src/seed/inngest/index.ts` (17) | |
| 2 | **Strangler shims** — tree client + barrel become `@deprecated` re-exports of seed; forest client re-exports seed (was tree). | `src/tree/inngest/client.ts` (19), `src/tree/inngest/index.ts` (19), `src/forest/inngest/client.ts` (12) | zero behavior change |
| 3 | **Registry entry #9** — target `@/tree/inngest/client`, kind `duplicate`, deprecatedAt 2026-08-23, removableAfter 2026-09-20, 13 callers listed. | `src/seed/types/deprecation-markers.ts` | `deprecationCount()` === 9 |
| 4 | **13 tree importers migrated path-only** to `@/seed/inngest/client` — incl. protected Telegram handlers (`campaign-handler.ts`, `telegram-bot-campaign-fsm-confirm.ts`); zero logic changes. | see registry `callers` list | |
| 5 | **2 forest importers migrated path-only** (`auto-discover-affiliates`, `hello-world`). Serve route `src/app/api/inngest/route.ts` stays on the forest seam by design — untouched. | | |
| 6 | **Merge test suite** — 9 tests against real exported instances (no mocks): single-instance reference equality across all 4 import paths; 33-key schema exactness (in-test list + compile-time `keyof Events` guard); `agent.mission.started` rich-payload acceptance; app id check. | `src/seed/inngest/__tests__/client-merge.test.ts` (144) | 9 |

---

## 2. Gate results so far

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| Single client instance: `grep -rn "new Inngest(" src/` | exactly 1 hit (`seed/inngest/client.ts:16`) |
| No straggler tree importers (grep outside `src/tree/inngest/`) | 0 hits |
| Seed + forest Inngest suites | 102/102 passed (12 files) |
| Telegram suite (protected flow) | 97/97 passed (8 files) |
| Client-merge suite (`client-merge.test.ts`) | 9/9 passed |
| Registry test | `deprecationCount()` === 9 ✅ |
| `:any` / `console.*` / TODO / FIXME in touched files | 0 hits |
| File sizes (all touched/new files) | all ≤200 lines |

**Pending before ship:** full suite `npx vitest run`, `npm run build`, CF-direct deploy +
SHA verification. Known-broken deploy base carried forward:
`src/land/youtube/__tests__/actions.test.ts:322` (pre-existing; the test mocks the client
internally, so it is unrelated to this merge).

---

## 3. Escrow carried forward (ALL pre-existing, NOT Phase 1.6)

Carried unchanged from `docs/roadmap/PHASE1-5-PLAN.md` §3:

1. **MED** — 11 pre-existing lint errors in untouched files (`youtube-content-pipeline.ts`
   forest→land ×4 highest priority). Lint-cleanup pipeline.
2. **LOW** — 3 pre-existing tree→land test-only imports.
3. **LOW** — eslint-disable count 45 vs frozen baseline 27. Reconcile in lint-cleanup pipeline.
4. **MED (process)** — suntzu gate agent must receive plan/execution paths inline and write
   verdicts to a fresh filename.
5. **MED (deploy base)** — `src/land/youtube/__tests__/actions.test.ts:322` fails on a
   frequency-gate assertion. Verified NOT in the Phase 1.6 diff. Deploy carries
   `WARNING: deploying on known-broken base: actions.test.ts:322`.

## 3b. Follow-ups opened by Phase 1.6

| Item | Disposition | Lands in |
|---|---|---|
| Agent-mission functions unregistered in `serve()` | Pre-existing gap: `agent-mission-executor`, `agent-approval-handler`, `agent-rollback-cron` are exported but not in the serve route's function array. Explicitly out of scope for the merge (non-goal). | future cycle if agent missions go live |
| Executor local type dedup | `agent-mission-executor.ts` still declares a local `AgentMissionStartedData` interface + cast; post-merge it can import the canonical type from `@/seed/inngest/agent-event-types`. | post-merge micro-cycle |
| `tree/inngest` removal | Removal-eligible **2026-09-20** (`getRemovalReady()` surfaces it). Re-grep incl. dynamic `import(` before deleting; delete both shim files; decrement registry. NOT automatic. | post-buffer micro-cycle |

---

## 4. Docs changed this phase

| File | Change |
|---|---|
| `apps/sophia-ai-factory/docs/system-architecture.md` | New §9 "Inngest Canonical Client" (seed canonical, tree shim deprecated 2026-09-20, forest seam serves the route); Wave 13 Inngest Registration line corrected — no longer claims `forest/inngest/client.ts` registers schemas. |
| `apps/sophia-ai-factory/docs/project-changelog.md` | Phase 1.6 entry added at top (merge summary, registry #9, migration counts, gates). |
| `apps/sophia-ai-factory/CLAUDE.md` | Canonical Import Paths table: added Inngest client row (`@/seed/inngest/client`). |
| `apps/sophia-ai-factory/docs/architecture/DEPRECATION_CANDIDATES.md` | Registry table gained entry #9 (`@/tree/inngest/client`) matching the code registry. |
| `apps/sophia-ai-factory/docs/roadmap/SOPHIA_2027_ROADMAP.md` | Transformation Cycles table: Phase 1.6 row ⏳ Deferred → ✅ Shipped `<SHIP-SHA>`. |
| `apps/sophia-ai-factory/docs/roadmap/PHASE1-6-PLAN.md` | This file (new). |

---

## 5. Architectural note

The Inngest event schema is a **cross-layer contract**: land sends events, forest functions
consume them, tree handlers trigger them. Such contracts belong in `seed` — the only layer
every other layer may import. Keeping the schema in `tree` forced a layer inversion (forest
reaching into tree for a foundational artifact) and allowed two same-id clients to drift.
One client, one merged schema, in seed; shims keep old import paths resolving until the
2026-09-20 removal date.
