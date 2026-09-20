# Handoff Report: Cloudflare Tunnel Secure Communication & Payload Encryption (Milestone M4)

**Agent:** explorer_m4_1  
**Folder:** `/Users/macbook/sophia-ai-factory/.agents/explorer_m4_1/`  
**Milestone:** M4 (Mekong AI Hybrid Edge Node Synchronization)  
**Role:** Teamwork Explorer / Architecture Investigator  
**Status:** Complete  

---

## 1. Observation

1. **User Requirements & Milestones:**
   - In `/Users/macbook/sophia-ai-factory/ORIGINAL_REQUEST.md` (lines 588-620), §R4 specifies:
     > "### R4. Mekong AI Hybrid Edge Node Synchronization (Private GPU / Offline Mode)
     > Bridge Cloudflare Workers cloud execution with private local GPU inference nodes:
     > - Secure communication protocol connecting Cloudflare Workers to local `mekongd` daemons via Cloudflare Tunnels.
     > - Hybrid routing policy directing heavy LLM and TTS tasks to local zero-cost hardware (M1 Max / Ollama / vLLM) with transparent fallback to cloud BYOK providers on node unreachability.
     > - Bidirectional heartbeat and health monitor with encrypted status reporting."
     > Under Acceptance Criteria (§R4):
     > "- Hybrid router routes requests to local `mekongd` node when available and falls back to cloud cleanly
     > - Node heartbeat monitor detects offline transitions within 15 seconds
     > - Tenant credentials and inference payloads remain encrypted in transit"

2. **D1 Edge Nodes Schema:**
   - In `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/migrations/0275_autonomous_growth_and_revenue.sql` (lines 183-202):
     ```sql
     CREATE TABLE IF NOT EXISTS edge_nodes (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       tunnel_url TEXT NOT NULL,
       bearer_token TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'DEGRADED')),
       hardware_profile TEXT NOT NULL DEFAULT 'apple_m1_max',
       cost_kind TEXT NOT NULL DEFAULT 'unmetered',
       last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
     );

     CREATE TABLE IF NOT EXISTS edge_node_heartbeats (
       id TEXT PRIMARY KEY,
       node_id TEXT NOT NULL REFERENCES edge_nodes(id),
       status TEXT NOT NULL,
       latency_ms REAL NOT NULL DEFAULT 10.0,
       recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
     );
     ```

3. **Existing Cryptographic Patterns in Codebase:**
   - In `apps/sophia-ai-factory/src/tree/byok/byok-crypto.ts` (lines 17-22, 64-72, 214-228), Web Crypto API (`crypto.subtle`) is used for AES-GCM with 256-bit keys and 12-byte IVs (`crypto.getRandomValues(new Uint8Array(12))`).
   - In `apps/sophia-ai-factory/src/tree/affiliate/hmac-verifier.ts` (lines 53-97), constant-time string comparison using bitwise XOR (`mismatch |= computedHex.charCodeAt(i) ^ cleanSig.charCodeAt(i)`) is implemented to defeat timing attacks on signature validation.
   - In `apps/sophia-ai-factory/src/seed/crypto/token-crypto.ts` (lines 16-80), versioned envelope prefixes (`aes:v1:`) and base64 encodings are used.

4. **Existing E2E Test Expectations:**
   - In `apps/sophia-ai-factory/tests/e2e/growth-engine/growth-engine-harness.ts` (lines 441-456, 1430-1548):
     - `InferenceTask` requires `{ taskId, type, prompt, model, maxTokens? }`.
     - `InferenceResult` returns `{ taskId, provider: 'mekong_m1_max' | 'cloud_byok', costKind: 'unmetered' | 'metered', output, latencyMs, encrypted: boolean }`.
     - `probeEdgeNode(nodeUrl, bearerToken, timeoutMs = 2500)` returns `NodeHealthStatus`.
   - In `apps/sophia-ai-factory/tests/e2e/growth-engine/tier2-boundary-corner.test.ts` (lines 813-866):
     - `it('12.1 exact 15-second heartbeat boundary: 15000ms stale remains ONLINE, 15001ms stale transitions to OFFLINE')`.
     - `it('12.2 probe timeout boundary: probe with timeoutMs < 500 fails closed')`.

5. **Layer Architecture Enforcement:**
   - `apps/sophia-ai-factory/scripts/check-layer-boundaries.sh` forbids `tree` from importing `@/forest/*` or `@/land/*`, and forbids `seed` from importing anything above it. Therefore, `apps/sophia-ai-factory/src/tree/mekong/*` must only import from `@/seed/*` or peer `tree` modules.

---

## 2. Logic Chain

1. **From Observation 1 & 2:**
   - The system requires connecting Cloudflare Workers to private local hardware via Cloudflare Tunnels stored in `edge_nodes.tunnel_url` with pre-shared `bearer_token`.
   - Target URLs follow `https://*.cashclaw.cc` or custom tunnel hostnames.
   - Since Cloudflare Tunnels terminate TLS at Cloudflare edge before proxying to local daemons, transport encryption alone is insufficient for zero-trust compliance. Payloads must be encrypted at the application layer to protect tenant credentials and prompts in transit.

2. **From Observation 3:**
   - Cloudflare Workers edge runtime supports the standard Web Crypto API (`crypto.subtle`).
   - Node-specific modules (like `crypto` or `Buffer`) can introduce edge compatibility issues, whereas `crypto.subtle`, `Uint8Array`, `btoa()`, and `atob()` run natively without polyfills.
   - Deriving 256-bit AES-GCM keys from the shared `bearer_token` via SHA-256 provides deterministic, shared symmetric encryption between Cloudflare Workers and `mekongd` without extra key exchange overhead.
   - A random 12-byte IV for each request combined with AES-256-GCM guarantees both semantic confidentiality and tamper detection via the 128-bit authentication tag.

3. **From Observation 3 & 4:**
   - Mutual Bearer authentication using SHA-256 hash validation (`auth_token_hash`) prevents replay and token leakage. Constant-time bitwise XOR comparison eliminates timing side-channel attacks.
   - Probes must enforce a fail-closed boundary when `timeoutMs < 500ms`, returning `status: 'OFFLINE'` and `reachable: false`.
   - Default timeout is `2500ms` via `AbortSignal.timeout(2500)`, allowing rapid failover to cloud BYOK when an edge node goes offline.

4. **From Observation 5:**
   - Placing the tunnel client and crypto engine in `apps/sophia-ai-factory/src/tree/mekong/` (`types.ts`, `crypto.ts`, `tunnel-client.ts`) preserves tree-layer purity, allowing `forest/ai/hybrid-router.ts` and `tree/edge/node-health.ts` to consume them cleanly without circular dependencies or boundary violations.

---

## 3. Caveats

- **Network Availability in Local Testing:** Unit tests for `tunnel-client.ts` will mock `globalThis.fetch` to avoid requiring an active live Cloudflare Tunnel during local CI/build execution.
- **Legacy Browser Support:** The Web Crypto API (`crypto.subtle`) and `AbortSignal.timeout` are supported in modern browsers, Node 18+, and Cloudflare Workers. For older test environments, `createTimeoutSignal` includes a standard `AbortController` fallback.
- **Node Configuration (`mekongd`):** This design defines the client protocol within Sophia AI Factory. The host running `mekongd` must implement matching AES-256-GCM envelope handling if payload encryption is activated.

---

## 4. Conclusion

The Cloudflare Tunnel Secure Communication and Payload Encryption protocol architecture is fully defined and documented in `/Users/macbook/sophia-ai-factory/.agents/explorer_m4_1/plan.md`.

The planned implementation consists of:
1. `apps/sophia-ai-factory/src/tree/mekong/types.ts`: Edge node contracts, `EncryptedPayloadEnvelope`, `InferenceTaskPayload`, and `NodeHealthStatus`.
2. `apps/sophia-ai-factory/src/tree/mekong/crypto.ts`: AES-256-GCM encryption/decryption with random 12-byte IV, SHA-256 token hashing, and timing-safe comparison.
3. `apps/sophia-ai-factory/src/tree/mekong/tunnel-client.ts`: Cloudflare Tunnel client, URL validation (`*.cashclaw.cc`), mutual Bearer authentication, and 2500ms timeout handling with sub-500ms fail-closed boundary.
4. Comprehensive unit test suites in `apps/sophia-ai-factory/src/tree/mekong/__tests__/crypto.test.ts` and `tunnel-client.test.ts`.

---

## 5. Verification Method

To independently verify this architectural plan and implementation:
1. **Inspect Plan File:**
   ```bash
   view_file /Users/macbook/sophia-ai-factory/.agents/explorer_m4_1/plan.md
   ```
2. **Post-Implementation Verification Commands:**
   - Run layer boundary checks:
     ```bash
     bash scripts/check-layer-boundaries.sh
     ```
   - Run TypeScript compilation checks:
     ```bash
     npm run type-check
     ```
   - Run Mekong unit tests:
     ```bash
     npx vitest run src/tree/mekong/__tests__/
     ```
   - Run E2E growth engine tests:
     ```bash
     npx vitest run tests/e2e/growth-engine/
     ```
3. **Invalidation Conditions:**
   - Any dependency in `src/tree/mekong/` importing from `@/forest` or `@/land`.
   - Decryption accepting tampered ciphertext or altered IV without throwing.
   - Probes with `timeoutMs < 500` returning anything other than `status: 'OFFLINE'`.
   - URL validator permitting non-HTTPS URLs in production mode.
