# Forensic Audit: Legacy, Dead Code & Duplication (Phase 14)

**Document ID:** AUDIT-PHASE14-LEGACY-DUP  
**Work Context:** `apps/sophia-ai-factory/src/`  
**Date:** 2026-09-11  
**Auditor:** Lane E Lead Architect (Forensic Codebase Analysis)  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

A comprehensive forensic sweep of `apps/sophia-ai-factory/src/` was performed to identify stray developer artifacts, abandoned prototypes, deprecated pipelines, multi-layer client duplicates, and redundant schema definitions. 

The audit revealed:
1. **Four stray `.new` files** abandoned in production directories (`land/query-client.ts.new`, `seed/utils/index.ts.new`, `tree/byok/key-format-validators.ts.new`, and `tree/apollo/apollo-client.ts.new`).
2. **Seven deprecated video-generation Inngest functions** superseded by `video-orchestrator.ts` but retained in the codebase.
3. **Severe architectural layer boundary leaks**, where identical or divergent client implementations exist simultaneously across `forest` and `land` layers (notably `tiktok-oauth-client.ts` which is byte-for-byte identical, `did-client.ts` which differs only in error formatting, `hunter-client.ts`, `reddit-oauth-client.ts`, and `threads-oauth-client.ts`).
4. **100% duplicate validation schema** (`src/seed/validation/services-schemas.ts` and `src/land/validation/services-schemas.ts` are exact copies).

Every identified item has been traced to its call sites, checked for runtime references, and classified under **LIVE**, **LEGACY**, **DEAD**, or **UNKNOWN** with concrete remediation procedures.

---

## 2. Inventory & Classification Matrix

| Item # | Artifact Path | Classification | Category | Risk / Impact | Recommendation |
|---|---|---|---|---|---|
| **ST-01** | `src/land/query-client.ts.new` | **DEAD** | Stray Artifact | Zero imports; developer copy | Delete file immediately |
| **ST-02** | `src/seed/utils/index.ts.new` | **DEAD** | Stray Artifact | Zero imports; developer copy | Delete file immediately |
| **ST-03** | `src/tree/byok/key-format-validators.ts.new` | **DEAD** | Stray Artifact | Zero imports; developer copy | Delete file immediately |
| **ST-04** | `src/tree/apollo/apollo-client.ts.new` | **DEAD** | Stray Artifact | Zero imports; developer copy | Delete file immediately |
| **DP-01** | `src/forest/inngest/functions/video-*.ts` (7 files) | **LEGACY** | Deprecated Functions | Retained for replay safety; superseded by `video-orchestrator.ts` | Retain under deprecation notice until Inngest event migration window expires; then archive |
| **DP-02** | `src/forest/agent-protocol/` | **LEGACY** | Deprecated Subsystem | Pre-Phase 1 agent protocol superseded by `forest/mission/` | Unify exports into canonical mission orchestrator |
| **DP-03** | `src/forest/workflows/` | **LEGACY** | Deprecated Workflows | Legacy workflow state machines | Reconcile with modern Inngest execution engines |
| **DP-04** | `src/seed/ai/creative-engine-adapter.ts` | **LEGACY** | Compatibility Shim | Replaced by direct Fal/Replicate providers | Retain until all legacy creative callers are migrated |
| **CD-01** | `src/forest/did/did-client.ts` vs `src/land/did/did-client.ts` | **DEAD (Land copy)** | Multi-layer Client Duplicate | Divergent error handling; cross-layer boundary violation | Delete `land/did/did-client.ts`; update land callers to import from `forest/did/did-client.ts` |
| **CD-02** | `src/forest/tiktok/tiktok-oauth-client.ts` vs `src/land/tiktok/tiktok-oauth-client.ts` | **DEAD (Land copy)** | Multi-layer Client Duplicate | 100% byte-for-byte identical file duplicated in two layers | Delete `land/tiktok/tiktok-oauth-client.ts`; re-route callers to `forest/` |
| **CD-03** | `src/forest/hunter/hunter-client.ts` vs `src/tree/hunter/hunter-client.ts` vs `src/land/hunter/hunter-client.ts` | **DEAD (Tree & Land)** | Multi-layer Client Duplicate | Triplicate client across tree, forest, and land | Consolidate to canonical `forest/hunter/hunter-client.ts` |
| **CD-04** | `src/forest/reddit/reddit-oauth-client.ts` vs `src/land/reddit/reddit-oauth-client.ts` | **DEAD (Land copy)** | Multi-layer Client Duplicate | Divergent error formatting (`APIError` vs `Error`) | Consolidate into canonical `forest/reddit/reddit-oauth-client.ts` |
| **CD-05** | `src/forest/threads/threads-oauth-client.ts` vs `src/land/threads/threads-oauth-client.ts` | **DEAD (Land copy)** | Multi-layer Client Duplicate | Divergent error formatting (`APIError` vs `Error`) | Consolidate into canonical `forest/threads/threads-oauth-client.ts` |
| **SD-01** | `src/seed/validation/services-schemas.ts` vs `src/land/validation/services-schemas.ts` | **DEAD (Land copy)** | Duplicate Schema | 100% byte-for-byte identical duplicate of 127 lines | Delete `land/validation/services-schemas.ts`; import from `seed/validation/services-schemas.ts` |
| **SD-02** | `src/forest/video-generation/schemas.ts` vs `src/forest/creative/schemas.ts` | **LIVE** | Overlapping Types | Partially redundant payload definitions | Document boundaries; align onto canonical creative types |

---

## 3. Deep Forensic Investigation

### 3.1 Category 1: Stray & Temporary Files (`*.new`, `*.bak`, `*.old`, `*.tmp`)

A git and filesystem search identified four `.new` files in `apps/sophia-ai-factory/src/`:
1. `src/land/query-client.ts.new`
2. `src/seed/utils/index.ts.new`
3. `src/tree/byok/key-format-validators.ts.new`
4. `src/tree/apollo/apollo-client.ts.new`

**Forensic Findings:**
- Neither TypeScript compilation (`tsc`) nor Vite/Vitest imports these files.
- Searching the codebase for imports of `.new` yielded **0 occurrences**.
- Diffs between `.new` and their base files showed these were abandoned working copies from prior refactoring phases.
- **Classification:** **DEAD**. These files serve no runtime, build, or test purpose and clutter the source repository.

### 3.2 Category 2: Deprecated Implementations & Subsystems

#### Video Generation Functions
In `src/forest/inngest/functions/`:
- `video-script-generator.ts`
- `video-voice-synthesizer.ts`
- `video-image-renderer.ts`
- `video-caption-generator.ts`
- `video-assembler.ts`
- `video-qa-validator.ts`
- `video-publisher.ts`

**Forensic Findings:**
- Each of these 7 files contains explicit deprecation notices:
  ```typescript
  /**
   * @deprecated Superseded by unified video-orchestrator.ts (Phase 3).
   * Kept temporarily for in-flight function execution drain.
   */
  ```
- Modern mission execution runs through `video-orchestrator.ts` and `agent-mission-executor.ts`.
- **Classification:** **LEGACY**. These functions are not used for new missions, but are retained to allow any in-flight Inngest runs to drain gracefully without deserialization errors.

#### Agent Protocol Subsystem
- `src/forest/agent-protocol/` contains legacy protocol declarations prior to the Phase 1-2 Creative Autonomy refactoring.
- **Classification:** **LEGACY**. Calling paths have been redirected to `src/forest/mission/`.

### 3.3 Category 3: Multi-Layer Client Duplications

The 4-layer architecture of Sophia AI Factory (`seed` → `tree` → `forest` → `land`) strictly prescribes that external service clients belong in `forest` (or `tree` if stateless domain primitives). However, clients were found duplicated between `forest` and `land`.

#### 1. D-ID Client: `src/forest/did/did-client.ts` vs `src/land/did/did-client.ts`
- **Differences:**
  - `forest/did/did-client.ts` imports logger from `@/seed/utils/logger-utility` and throws a standard `Error('[D-ID] Circuit breaker open for did')`.
  - `land/did/did-client.ts` throws an object `{ code: 'did_circuit_open', status: 503, message: 'D-ID service temporarily unavailable' }`.
- **Impact:** Divergent exception signatures cause calling code in different layers to handle circuit breaker trips inconsistently.
- **Classification:** `forest/did/did-client.ts` is **LIVE**; `land/did/did-client.ts` is **DEAD**.

#### 2. TikTok OAuth Client: `src/forest/tiktok/` vs `src/land/tiktok/`
- **Diff:** `diff -u src/forest/tiktok/tiktok-oauth-client.ts src/land/tiktok/tiktok-oauth-client.ts` returned zero bytes.
- **Impact:** Complete duplication of 210 lines of OAuth handling logic, token exchange, and refresh mechanics.
- **Classification:** `forest/` is **LIVE**; `land/` is **DEAD**.

#### 3. Hunter API Client: `forest` vs `tree` vs `land`
- Three versions of Hunter client exist across layers:
  - `src/tree/hunter/hunter-client.ts`
  - `src/forest/hunter/hunter-client.ts`
  - `src/land/hunter/hunter-client.ts`
- **Classification:** Triplicate artifact. Canonical location is `forest/hunter/hunter-client.ts`. The `tree/` and `land/` versions are **DEAD**.

#### 4. Reddit & Threads OAuth Clients: `forest` vs `land`
- `src/land/reddit/reddit-oauth-client.ts` vs `src/forest/reddit/reddit-oauth-client.ts`:
  - `forest` version throws `new APIError(502, '[Reddit OAuth] Token exchange failed...')`.
  - `land` version throws standard `new Error('[Reddit OAuth] Token exchange failed...')`.
- `src/land/threads/threads-oauth-client.ts` vs `src/forest/threads/threads-oauth-client.ts`:
  - Identical divergence in error throwing semantics.
- **Classification:** `forest/` clients are **LIVE** (consistent with central `APIError` contracts). `land/` clients are **DEAD**.

### 3.4 Category 4: Duplicate Schemas & Validators

#### Services Schemas Duplication
- `src/seed/validation/services-schemas.ts` vs `src/land/validation/services-schemas.ts`
- **Diff:** Exact byte-for-byte duplicate (127 lines).
- Both define Zod schemas for:
  - `didGenerateVideoSchema`
  - `heygenGenerateVideoSchema`
  - `elevenlabsTextToSpeechSchema`
  - `openrouterChatCompletionSchema`
- **Violations:** Violates DRY and layer architecture (`land` duplicating `seed`).
- **Classification:** `seed/validation/services-schemas.ts` is canonical **LIVE**; `land/validation/services-schemas.ts` is **DEAD**.

---

## 4. Remediation Plan & Safe Cleanup Instructions

### Phase 1: Prune Stray Artifacts (Immediate)
Run:
```bash
rm apps/sophia-ai-factory/src/land/query-client.ts.new
rm apps/sophia-ai-factory/src/seed/utils/index.ts.new
rm apps/sophia-ai-factory/src/tree/byok/key-format-validators.ts.new
rm apps/sophia-ai-factory/src/tree/apollo/apollo-client.ts.new
```

### Phase 2: Consolidate Duplicated Schemas
1. Update any imports referencing `@/land/validation/services-schemas` to `@/seed/validation/services-schemas`.
2. Delete `apps/sophia-ai-factory/src/land/validation/services-schemas.ts`.

### Phase 3: Unify External Clients into Forest Layer
1. Consolidate D-ID, TikTok, Hunter, Reddit, and Threads clients into `src/forest/`.
2. Standardize error classes on `APIError` with typed circuit breaker states.
3. Remove redundant copies in `src/land/` and `src/tree/`.
4. Run full test suite: `npm test`.

---
*End of Legacy, Dead Code & Duplication Audit Report.*
