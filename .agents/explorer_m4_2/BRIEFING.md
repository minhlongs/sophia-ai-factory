# BRIEFING — 2026-09-20T03:31:00Z

## Mission
Explore and architect the Hybrid Task Routing Policy and Transparent Cloud Fallback for Milestone M4 (Mekong AI Hybrid Edge Node Synchronization).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, architect, synthesizer
- Working directory: /Users/macbook/sophia-ai-factory/.agents/explorer_m4_2
- Original parent: 296606c0-04b8-47fd-b8b5-4a63a8f83a7c
- Milestone: M4 (Mekong AI Hybrid Edge Node Synchronization - Hybrid Task Routing & Transparent Cloud Fallback)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement production code
- DO NOT run commands with BypassSandbox=true
- Inspect files with view_file and write plan in plan.md
- Produce structured 5-component handoff.md, plan.md, progress.md
- Use send_message to report back to parent agent

## Current Parent
- Conversation ID: 296606c0-04b8-47fd-b8b5-4a63a8f83a7c
- Updated: 2026-09-20T03:28:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` (lines 588-620: §R4 Mekong AI Hybrid Edge Node, §R5 Quality Gates)
  - `PROJECT.md` (Features 17-20, Interface Contracts §4, Code Layout line 138)
  - `apps/sophia-ai-factory/src/seed/ai/provider-certification.ts` (Five-state machine, resolveCertifiedProvider)
  - `apps/sophia-ai-factory/src/seed/ai/cost-estimator.ts` (`CostKind = 'metered' | 'unmetered' | 'internal' | 'unknown'`)
  - `apps/sophia-ai-factory/src/forest/ai/cost-aware-router.ts` (Ranking by cost kind)
  - `apps/sophia-ai-factory/src/forest/ai/llm-router.ts` & `src/seed/ai/llm-router.ts` (Complexity classification)
  - `apps/sophia-ai-factory/src/tree/byok/` (BYOK resolution, AES-256-GCM crypto)
  - `apps/sophia-ai-factory/src/tree/agent-fleet/llm-cost-tracker.ts` (Zero cost for local models)
  - `apps/sophia-ai-factory/migrations/0275_autonomous_growth_and_revenue.sql` (Tables `edge_nodes`, `edge_node_heartbeats`)
  - `apps/sophia-ai-factory/tests/e2e/growth-engine/growth-engine-harness.ts` (`routeInferenceTask` contract)
  - `apps/sophia-ai-factory/tests/e2e/growth-engine/tier1-4` test suites (F11/F12 test cases)
  - `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` (Strict 4-layer boundary checker)

- **Key findings**:
  1. `CostKind` is already typed in `seed/ai/cost-estimator.ts` as `'metered' | 'unmetered' | 'internal' | 'unknown'`. Local Apple Silicon M1 Max execution is strictly `'unmetered'`. Cloud BYOK fallback is strictly `'metered'`.
  2. D1 migration `0275` defines `edge_nodes` with `status IN ('ONLINE', 'OFFLINE', 'DEGRADED')` and `cost_kind TEXT NOT NULL DEFAULT 'unmetered'`.
  3. `routeInferenceTask` in existing E2E tests is called with both `(task, db)` and `(task, db, preferredNodeId)` while specification requests `routeInferenceTask(task: InferenceTask, preferredNodeId?: string, db?: D1Database)`. A polymorphic signature cleanly satisfies both without breaking any callers.
  4. Liveness boundary: `nowMs - last_heartbeat_at <= 15000` is ONLINE; `> 15000` is OFFLINE.
  5. 4-Layer rule: `src/tree/mekong/hybrid-router.ts` can import `seed` and other `tree/mekong` files, but CANNOT import `forest` or `land`. `src/forest/ai/hybrid-router.ts` can wrap or re-export it for forest orchestration.

- **Unexplored areas**: None remaining for planning; ready to draft `plan.md` and `handoff.md`.

## Key Decisions Made
- Architecture split: Pure domain routing logic lives in `apps/sophia-ai-factory/src/tree/mekong/hybrid-router.ts`.
- Polymorphic signature designed for `routeInferenceTask` to support all call conventions seamlessly.
- Transparent Cloud Fallback will support all failure triggers: `NO_ONLINE_NODE`, `STALE_HEARTBEAT`, `PREFERRED_NODE_NOT_FOUND`, `PROBE_FAILED`, `TUNNEL_TIMEOUT`, `TUNNEL_ERROR`.

## Artifact Index
- DISPATCH.md — incoming instructions
- BRIEFING.md — persistent memory
- progress.md — liveness and step tracker
- plan.md — architecture and implementation plan
- handoff.md — final 5-component handoff report
