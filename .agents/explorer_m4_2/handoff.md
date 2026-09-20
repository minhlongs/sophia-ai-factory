# Handoff Report: Hybrid Task Routing Policy & Transparent Cloud Fallback (Milestone M4)

**Agent**: explorer_m4_2  
**Milestone**: M4 (Mekong AI Hybrid Edge Node Synchronization)  
**Date**: 2026-09-20  
**Handoff Type**: Hard (Task complete)

---

## 1. Observation

1. **Original Request & Project Scope**:
   - `ORIGINAL_REQUEST.md` lines 588-593 (§R4 Mekong AI Hybrid Edge Node Synchronization):
     > "Bridge Cloudflare Workers cloud execution with private local GPU inference nodes:
     > - Secure communication protocol connecting Cloudflare Workers to local `mekongd` daemons via Cloudflare Tunnels.
     > - Hybrid routing policy directing heavy LLM and TTS tasks to local zero-cost hardware (M1 Max / Ollama / vLLM) with transparent fallback to cloud BYOK providers on node unreachability.
     > - Bidirectional heartbeat and health monitor with encrypted status reporting."
   - `PROJECT.md` line 110:
     > `routeInferenceTask(task: InferenceTask, preferredNodeId?: string): Promise<InferenceResult>`
   - `PROJECT.md` line 138:
     > `apps/sophia-ai-factory/src/forest/ai/hybrid-router.ts # Hybrid edge vs cloud BYOK router`

2. **Provider Certification & Cost Infrastructure**:
   - `apps/sophia-ai-factory/src/seed/ai/provider-certification.ts` lines 25-31 & 179-215:
     Defines `ProviderCertificationState` (`NOT_CERTIFIED | EXPERIMENTAL | PRODUCTION_CANDIDATE | PRODUCTION_READY | BLOCKED`). `resolveCertifiedProvider()` actively diverts blocked providers to certified fallbacks (`openrouter`, `anthropic`).
   - `apps/sophia-ai-factory/src/seed/ai/cost-estimator.ts` lines 33-45:
     ```typescript
     export type CostKind = 'metered' | 'unmetered' | 'internal' | 'unknown';
     export interface CostEstimate {
       usd: number;
       kind: CostKind;
     }
     ```
   - `apps/sophia-ai-factory/src/forest/ai/cost-aware-router.ts` lines 375, 383, 393:
     Distinguishes `metered` vs `unmetered` in router rankings.
   - `apps/sophia-ai-factory/src/tree/agent-fleet/llm-cost-tracker.ts` line 10:
     Defines local model cost as `{ input: 0, output: 0 }`.

3. **Database Schema**:
   - `apps/sophia-ai-factory/migrations/0275_autonomous_growth_and_revenue.sql` lines 183-202:
     Defines table `edge_nodes` with columns:
     `id TEXT PRIMARY KEY, name TEXT, tunnel_url TEXT, bearer_token TEXT, status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'DEGRADED')), hardware_profile TEXT DEFAULT 'apple_m1_max', cost_kind TEXT DEFAULT 'unmetered', last_heartbeat_at INTEGER DEFAULT 0`.
     Defines table `edge_node_heartbeats` with `node_id, status, latency_ms, recorded_at`.

4. **Existing E2E Test Suite & Harness Contract**:
   - `apps/sophia-ai-factory/tests/e2e/growth-engine/growth-engine-harness.ts` lines 1425-1465:
     ```typescript
     export async function routeInferenceTask(
       task: InferenceTask,
       db: MockD1Database,
       preferredNodeId?: string,
       nowMs = Date.now(),
     ): Promise<InferenceResult>
     ```
   - In `tests/e2e/growth-engine/tier1-feature-coverage.test.ts` (lines 938-1015), `tier2-boundary-corner.test.ts` (lines 753-810), `tier3-pairwise-combinations.test.ts` (lines 447-517), and `tier4-real-world-scenarios.test.ts` (lines 346-388):
     Calls are made using both `routeInferenceTask(task, db)` and `routeInferenceTask(task, db, preferredNodeId)`.

5. **Layer Architecture Boundaries**:
   - `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` lines 11-41:
     Forbids `tree → land`, `tree → forest`, `seed → upper`, and `land → forest`.

---

## 2. Logic Chain

1. From **Observation 1** (§R4 and PROJECT.md), the system requires bridging Cloudflare Workers to local Apple Silicon `mekongd` daemons via Cloudflare Tunnel, directing heavy inference tasks to local hardware at zero cost (`unmetered`), and falling back transparently to cloud BYOK on unreachability.
2. From **Observation 2**, `CostKind` is already typed in `seed/ai/cost-estimator.ts` as `'metered' | 'unmetered' | 'internal' | 'unknown'`. Local edge executions must output `costKind: 'unmetered'` ($0.00 / 0 credits deducted), whereas cloud BYOK fallbacks must output `costKind: 'metered'`. Furthermore, fallback candidates must pass `resolveCertifiedProvider` from `seed/ai/provider-certification.ts`.
3. From **Observation 3**, D1 table `edge_nodes` stores node status as uppercase `'ONLINE'`, `'OFFLINE'`, `'DEGRADED'`, with `last_heartbeat_at` in unix epoch milliseconds. Therefore, the routing policy must normalize status (`status.toUpperCase() === 'ONLINE'`) and check staleness against `nowMs - last_heartbeat_at <= 15000`.
4. From **Observation 4**, existing tests call `routeInferenceTask(task, db, preferredNodeId)` whereas the M4 specification prompt specifies `routeInferenceTask(task: InferenceTask, preferredNodeId?: string, db?: D1Database)`. To prevent breaking either calling convention, the implementation must use a **polymorphic argument parser** that inspects whether the second argument is a database object or a string.
5. From **Observation 5**, domain logic in `tree/` cannot import `forest/` or `land/`. Thus, the canonical routing engine must be implemented in `src/tree/mekong/hybrid-router.ts` (importing only `seed/` and `tree/mekong/*`). `src/forest/ai/hybrid-router.ts` can then cleanly re-export it for forest orchestration pipelines.
6. The decision matrix must cover 9 discrete conditions:
   - Local success (`provider: 'mekong_m1_max'`, `costKind: 'unmetered'`, `encrypted: true`, `latencyMs: 120`).
   - `NO_ONLINE_NODE` $\to$ Cloud fallback (`cloud_byok`, `metered`, `latencyMs: 650`).
   - `PREFERRED_NODE_NOT_FOUND` $\to$ Cloud fallback.
   - `NODE_OFFLINE` $\to$ Cloud fallback.
   - `STALE_HEARTBEAT` ($>15000\text{ ms}$) $\to$ Cloud fallback + lazy DB update to `OFFLINE`.
   - `PROBE_FAILED` $\to$ Cloud fallback.
   - `TUNNEL_TIMEOUT` ($>2500\text{ ms}$) $\to$ Cloud fallback.
   - `TUNNEL_ERROR` (502/504/network) $\to$ Cloud fallback.
   - `BYPASS_REQUESTED` $\to$ Cloud fallback.

---

## 3. Caveats

- **Mock vs Live Tunnel**: In production Cloudflare Workers environments, live dispatch uses `fetch()` over Cloudflare Tunnels to `https://*.cashclaw.cc` with `AbortSignal.timeout(2500)`. In Vitest/Node environments where no live local M1 Max daemon is running, mock fallbacks or deterministic mock tunnel endpoints are used as evidenced by `growth-engine-harness.ts`.
- **Database Availability**: When `db` is omitted in standalone callers, the router gracefully defaults to cloud BYOK with `fallbackReason: 'NO_ONLINE_NODE'`, ensuring zero runtime crashes.

---

## 4. Conclusion

A complete, production-grade architecture and implementation plan for the Hybrid Task Routing Policy and Transparent Cloud Fallback has been designed and documented in `.agents/explorer_m4_2/plan.md`.

Key architectural deliverables:
1. **Canonical File**: `apps/sophia-ai-factory/src/tree/mekong/hybrid-router.ts`
2. **Forest Re-export**: `apps/sophia-ai-factory/src/forest/ai/hybrid-router.ts`
3. **Types & Interfaces**: `InferenceTask`, `InferenceResult`, `FallbackReason`, `HybridRouterOptions` in `src/tree/mekong/types.ts`
4. **Polymorphic Signature**: Supports all caller forms seamlessly:
   `routeInferenceTask(task, dbOrPreferredNodeId?, preferredNodeIdOrDb?, nowMs?, options?)`
5. **Strict 4-Layer Compliance**: 0 violations of `scripts/check-layer-boundaries.sh`.
6. **Provider Certification & Cost Honesty**: Integrates `'mekong_m1_max'` registration and enforces `unmetered` (local) vs `metered` (cloud BYOK) cost parity.

---

## 5. Verification Method

To independently verify this architecture upon implementation:

1. **Check 4-Layer Boundaries**:
   ```bash
   bash scripts/check-layer-boundaries.sh
   ```
   *Expected output*: `✅ All layer boundaries clean` (0 violations).

2. **Run TypeScript Compiler Gate**:
   ```bash
   npm run type-check
   ```
   *Expected output*: Exits with code 0 (0 TypeScript errors).

3. **Run Unit Test Suite**:
   ```bash
   npx vitest run src/tree/mekong/__tests__/hybrid-router.test.ts
   ```
   *Expected output*: 12/12 unit tests pass across all routing and fallback conditions.

4. **Run Growth Engine E2E Test Suite**:
   ```bash
   npx vitest run tests/e2e/growth-engine/
   ```
   *Expected output*: 100% test pass rate across Tier 1 (Feature 11 & 12), Tier 2 (Boundaries), Tier 3 (Pairwise P13-P15), and Tier 4 (Scenario 4 failover lifecycle).
