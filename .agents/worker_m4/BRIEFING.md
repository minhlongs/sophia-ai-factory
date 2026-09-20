# BRIEFING — 2026-09-20T03:31:40Z

## Mission
Implement Milestone M4 (Mekong AI Hybrid Edge Node Synchronization) covering Cloudflare Tunnel communication to `mekongd`, AES-256-GCM encrypted payload transit, hybrid routing policy with transparent cloud BYOK fallback, 15-second offline transition detector, and Inngest health sweep monitor.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/macbook/projects/sophia-ai-factory/.agents/worker_m4
- Original parent: aa61d1be-e9e2-442b-a2c6-60c57f94f9ae
- Milestone: Quota Metering & Performance - Case 4.1 & 4.2
- Working directory (M4): /Users/macbook/sophia-ai-factory/.agents/worker_m4
- Current parent: 296606c0-04b8-47fd-b8b5-4a63a8f83a7c
- Milestone (M4): M4: Mekong AI Hybrid Edge Node Synchronization

## 🔒 Key Constraints
- CODE_ONLY network mode: no external HTTP/curl/wget
- Genuine implementation: no hardcoding expected results/facades
- Write only to /Users/macbook/projects/sophia-ai-factory/.agents/worker_m4 for agent metadata
- Code files are in their respective project directories
- DO NOT set BypassSandbox=true in run_command tool calls. Keep BypassSandbox as default.
- 4-layer architecture constraints: canonical hierarchy seed -> tree -> forest -> land.
- Files in src/tree/mekong/ must ONLY import from @/seed/* or other @/tree/* modules. Never import @/forest/* or @/land/* into tree.
- src/forest/ai/hybrid-router.ts and src/forest/jobs/edge-node-monitor.ts may import from tree and seed.
- Zero :any types. Zero production console.log/warn/error (use @/seed/logger or edge logger).
- No cheat mandate: genuine logic, real state transitions, cryptographic validation.

## Current Parent
- Conversation ID: 296606c0-04b8-47fd-b8b5-4a63a8f83a7c
- Updated: 2026-09-20T03:31:40Z

## Task Summary
- **What to build**:
  1. `src/tree/mekong/types.ts`: Domain models for EdgeNode, EdgeNodeHeartbeat, InferenceTask, InferenceResult, EncryptedPayloadEnvelope, PreflightProbeResult, HybridRoutingDecision.
  2. `src/tree/mekong/crypto.ts`: Edge-native Web Crypto API AES-256-GCM, SHA-256 auth_token_hash, constant-time comparison, 12-byte IV.
  3. `src/tree/mekong/tunnel-client.ts`: Cloudflare Tunnel client (*.cashclaw.cc), probeEdgeTunnel (<500ms fail-closed), executeTunnelInference.
  4. `src/tree/mekong/health.ts`: probeEdgeNode, checkClusterHealth (15s boundary: <=15000ms stays ONLINE, >15000ms transitions to OFFLINE), processNodeHeartbeat (VRAM>95% or queue>10 -> DEGRADED).
  5. `src/tree/mekong/hybrid-router.ts`: routeInferenceTask with polymorphic signature, local GPU unmetered routing ($0.00), transparent cloud BYOK metered fallback.
  6. `src/tree/mekong/index.ts`: Tree-layer barrel export.
  7. `src/forest/ai/hybrid-router.ts`: Forest facade.
  8. `src/forest/jobs/edge-node-monitor.ts`: Inngest cron edgeNodeHealthSweepCron.
  9. `src/forest/jobs/index.ts`: Re-export edge-node-monitor.
  10. `src/forest/inngest/functions/index.ts`: Re-export edgeNodeHealthSweepCron.
  11. `src/app/api/inngest/route.ts`: Register edgeNodeHealthSweepCron.
  12. `src/seed/ai/provider-certification.ts`: Register mekong_m1_max.
  13. Unit tests in `src/tree/mekong/__tests__/` and `src/forest/jobs/__tests__/`.
- **Success criteria**:
  - All unit, integration, and E2E growth-engine test suites pass 100%.
  - Zero TypeScript compiler errors (`tsc --noEmit`).
  - Zero layer violations (`scripts/check-layer-boundaries.sh`).
- **Interface contracts**: PROJECT.md §4 Mekong AI Hybrid Edge Node Protocol.
- **Code layout**: PROJECT.md §Code Layout.

## Key Decisions Made
- Use Web Crypto API (crypto.subtle) without Node Buffer dependency for full Cloudflare Workers edge runtime compatibility.
- Enforce strict fail-closed boundary on probes when timeoutMs < 500ms.
- Polymorphic signature on `routeInferenceTask` to seamlessly accept `(task, db, preferredNodeId, nowMs)` or `(task, preferredNodeId, db, nowMs)` or `(task, db)`.
- Use D1 uppercase status constraint (`ONLINE`, `OFFLINE`, `DEGRADED`).
- Lazy update to OFFLINE in D1 when router detects stale heartbeat (>15,000ms).

## Artifact Index
- `apps/sophia-ai-factory/src/tree/mekong/types.ts`
- `apps/sophia-ai-factory/src/tree/mekong/crypto.ts`
- `apps/sophia-ai-factory/src/tree/mekong/tunnel-client.ts`
- `apps/sophia-ai-factory/src/tree/mekong/health.ts`
- `apps/sophia-ai-factory/src/tree/mekong/hybrid-router.ts`
- `apps/sophia-ai-factory/src/tree/mekong/index.ts`
- `apps/sophia-ai-factory/src/forest/ai/hybrid-router.ts`
- `apps/sophia-ai-factory/src/forest/jobs/edge-node-monitor.ts`
- `apps/sophia-ai-factory/src/tree/mekong/__tests__/crypto.test.ts`
- `apps/sophia-ai-factory/src/tree/mekong/__tests__/tunnel-client.test.ts`
- `apps/sophia-ai-factory/src/tree/mekong/__tests__/health.test.ts`
- `apps/sophia-ai-factory/src/tree/mekong/__tests__/hybrid-router.test.ts`
- `apps/sophia-ai-factory/src/forest/jobs/__tests__/edge-node-monitor.test.ts`
- `.agents/worker_m4/progress.md`
- `.agents/worker_m4/handoff.md`

## Change Tracker
- **Files modified**:
  - `src/tree/mekong/types.ts`: Core domain interfaces, hardware profiles, envelopes.
  - `src/tree/mekong/crypto.ts`: Web Crypto AES-256-GCM, constant-time compare, SHA-256 token hash.
  - `src/tree/mekong/tunnel-client.ts`: Cloudflare Tunnel client with fail-closed timeout boundaries.
  - `src/tree/mekong/health.ts`: 15s offline transition detector, probeEdgeNode, processNodeHeartbeat.
  - `src/tree/mekong/hybrid-router.ts`: Polymorphic routing engine with unmetered local GPU and cloud BYOK fallback.
  - `src/tree/mekong/index.ts`: Module barrel export.
  - `src/forest/ai/hybrid-router.ts`: Forest facade connecting to Inngest workflows.
  - `src/forest/jobs/edge-node-monitor.ts`: Inngest health sweep cron job.
  - `src/forest/jobs/index.ts`: Re-exported edge-node-monitor.
  - `src/forest/inngest/functions/index.ts`: Re-exported edgeNodeHealthSweepCron.
  - `src/app/api/inngest/route.ts`: Registered edgeNodeHealthSweepCron.
  - `src/seed/ai/provider-certification.ts`: Certified mekong_m1_max as PRODUCTION_READY.
- **Build status**: PASS (12/12 M4 test files passed, 23/23 regression test files passed, tsc --noEmit 0 errors, layer boundaries clean).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: PASS (145/145 unit tests, 313/313 regression/E2E tests, 0 TS errors).
- **Lint status**: PASS (zero layer boundary violations).
- **Tests added/modified**: 5 new test files covering 67 unit & integration tests across crypto, tunnel client, health, hybrid routing, and Inngest jobs.
