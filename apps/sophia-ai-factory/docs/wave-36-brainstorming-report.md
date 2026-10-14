# Brainstorming Report: Wave 36 Deep Modularization & Governance Core Architecture

## Executive Summary
Following the successful shipment of Wave 35 (17,291 tests passing, 0 type/lint errors), the production codebase retains 73 monolith files exceeding the strict `< 200 LOC` threshold.

In accordance with founder guidance (`"cả 3 --deep" + "cả"`), Wave 36 targets a comprehensive multi-pillar refactoring encompassing:
1. **Cluster 1: Edge APIs, GraphQL & Server Actions** (5 critical ingress/mutation paths)
2. **Cluster 2: AI Adapters, Auth, Metering & Provenance** (5 core runtime & ledger engines)
3. **Cluster 3: Test Harness, Core Types, UI & Governance Consensus Engine** (Root harness, types barrel, UI rollback, and generic conclave consensus core extraction)

---

## 1. Problem Statement & Architectural Drivers
- **Monolith Concentration**: Production entrypoints and engines concentrate orchestration, validation, SQL/D1 transactions, and error handling in single files > 200 LOC.
- **Conclave Engine Duplication**: Over 10 governance conclave engines (`src/tree/governance/*-conclave-engine.ts`, 211 LOC each) duplicate voting mechanics, quorum checks, proposal states, and ledger records. Extracting a shared consensus core eliminates ~1,800 LOC of boilerplate.
- **Root Test Harness & Barrel Bloat**: `src/test/setup.tsx` (349 LOC) mixes mock environments, Web Crypto shims, D1 mock helpers, and global lifecycle hooks. `src/seed/types/index.ts` (289 LOC) acts as an oversized re-export barrel.
- **Invariants to Preserve**:
  - All new files strictly `< 200 LOC`.
  - Root facades `< 25 LOC` ensuring 100% backward compatibility for all callers and static test suites.
  - Zero `:any` types; zero `console.log`; zero new ESLint suppressions.
  - 4-layer architecture compliance (`seed` → `tree` → `forest` → `land`).

---

## 2. Target Matrix & Submodule Blueprints

### Cluster 1: Edge APIs, GraphQL & Server Actions (5 Targets)
1. **`src/app/api/openclaw/exchange/route.ts` (211 LOC)** → `src/app/api/openclaw/exchange/core/`:
   - `types.ts` (<50 LOC): Token exchange requests, claims schema, error responses.
   - `token-validator.ts` (<80 LOC): Signature validation, nonce verification, and expiry checks.
   - `exchange-service.ts` (<90 LOC): Token issuance, refresh logic, and audit trail emission.
   - `route-handler.ts` (<80 LOC): Edge route handler with error classification.
   - Root facade: `route.ts` (<20 LOC).

2. **`src/app/api/graphql/analytics/route.ts` (211 LOC)** → `src/app/api/graphql/analytics/core/`:
   - `types.ts` (<50 LOC): GraphQL schema types, query contexts, analytics resolver arguments.
   - `query-parser.ts` (<80 LOC): AST extraction, validation, and field complexity limiter.
   - `analytics-resolvers.ts` (<100 LOC): D1 telemetry aggregation and resolver functions.
   - `route-handler.ts` (<70 LOC): Edge POST handler with caching and CORS headers.
   - Root facade: `route.ts` (<20 LOC).

3. **`src/app/actions/brand-kit-action.ts` (212 LOC)** → `src/app/actions/brand-kit/`:
   - `types.ts` (<50 LOC): Brand kit DTOs, color schemes, font palettes, logo schemas.
   - `brand-kit-validator.ts` (<70 LOC): Zod input validation and asset URL verification.
   - `brand-kit-service.ts` (<100 LOC): D1 persistence, tenant isolation, and audit events.
   - `actions.ts` (<80 LOC): `'use server'` Server Actions with auth session validation.
   - Root facade: `brand-kit-action.ts` (<20 LOC).

4. **`src/land/predictive/predictive-dashboard-actions.ts` (212 LOC)** → `src/land/predictive/actions/`:
   - `types.ts` (<50 LOC): Predictive metrics schemas, forecast periods, confidence intervals.
   - `forecast-calculator.ts` (<90 LOC): Trend projection math and statistical confidence scoring.
   - `predictive-service.ts` (<90 LOC): D1 query orchestration and caching integration.
   - `actions.ts` (<80 LOC): `'use server'` actions for dashboard client components.
   - Root facade: `predictive-dashboard-actions.ts` (<20 LOC).

5. **`src/forest/ab/thumbnail-ab-runner.ts` (212 LOC)** → `src/forest/ab/runner/`:
   - `types.ts` (<50 LOC): A/B experiment config, CTR metrics, variant allocation models.
   - `variant-selector.ts` (<80 LOC): Multi-armed bandit / deterministic hash variant selection.
   - `metrics-collector.ts` (<90 LOC): Impression and click telemetry recording.
   - `ab-runner.ts` (<90 LOC): Inngest/workflow execution orchestrator.
   - Root facade: `thumbnail-ab-runner.ts` (<20 LOC).

---

### Cluster 2: AI Adapters, Auth, Metering & Provenance (5 Targets)
6. **`src/seed/ai/anthropic-adapter.ts` (210 LOC)** → `src/seed/ai/anthropic/`:
   - `types.ts` (<50 LOC): Request/response payload interfaces, stream chunk formats.
   - `payload-formatter.ts` (<80 LOC): Message array formatting, tool schema conversion.
   - `circuit-client.ts` (<90 LOC): Circuit breaker HTTP client with error classification.
   - `adapter.ts` (<80 LOC): Main AnthropicAdapter service implementing AI provider contract.
   - Root facade: `anthropic-adapter.ts` (<20 LOC).

7. **`src/seed/auth/openclaw-token.ts` (209 LOC)** → `src/seed/auth/openclaw/`:
   - `types.ts` (<50 LOC): OpenClaw token payload, signing options, validation results.
   - `token-signer.ts` (<80 LOC): HMAC/Ed25519 cryptographic token signing.
   - `token-verifier.ts` (<80 LOC): Verification, expiration checks, and claim decoding.
   - `token-service.ts` (<70 LOC): High-level token issuance and revocation.
   - Root facade: `openclaw-token.ts` (<20 LOC).

8. **`src/tree/usage-metering/batch-buffer.ts` (209 LOC)** → `src/tree/usage-metering/buffer/`:
   - `types.ts` (<40 LOC): Buffer entry, flush options, batch status interfaces.
   - `buffer-storage.ts` (<80 LOC): In-memory / KV buffer queue management.
   - `batch-flusher.ts` (<90 LOC): Atomic batch persistence to D1 ledger with retry logic.
   - `buffer-manager.ts` (<80 LOC): High-level buffering coordinator.
   - Root facade: `batch-buffer.ts` (<20 LOC).

9. **`src/tree/provenance/provenance-ledger.ts` (209 LOC)** → `src/tree/provenance/ledger/`:
   - `types.ts` (<50 LOC): Provenance record interfaces, chain hashes, signature metadata.
   - `chain-hasher.ts` (<80 LOC): Merkle / SHA-256 chain hash computation.
   - `ledger-storage.ts` (<90 LOC): D1 ledger insertion, integrity checks, and lookups.
   - `ledger-service.ts` (<80 LOC): Provenance ledger service entrypoint.
   - Root facade: `provenance-ledger.ts` (<20 LOC).

10. **`src/land/youtube/youtube-oauth-client.ts` (209 LOC)** → `src/land/youtube/oauth/`:
    - `types.ts` (<50 LOC): OAuth credentials, token response schemas, token scopes.
    - `token-exchanger.ts` (<80 LOC): Auth code to token exchange and refresh flows.
    - `credential-vault.ts` (<80 LOC): Encrypted storage and retrieval of OAuth tokens in D1.
    - `oauth-client.ts` (<80 LOC): Main YouTube OAuth client interface.
    - Root facade: `youtube-oauth-client.ts` (<20 LOC).

---

### Cluster 3: Test Harness, Global Types, UI & Governance Conclave Core (5 Targets)
11. **`src/test/setup.tsx` (349 LOC)** → `src/test/setup/`:
    - `crypto-shims.ts` (<60 LOC): Web Crypto API, TextEncoder/Decoder, and UUID shims.
    - `db-mocks.ts` (<90 LOC): D1 / SQLite mock bindings and transaction stubs.
    - `env-config.ts` (<50 LOC): Test environment variables, Next.js router mocks.
    - `global-lifecycle.ts` (<80 LOC): BeforeEach, afterEach, cleanup and DOM matchers.
    - Root facade: `setup.tsx` (<20 LOC).

12. **`src/seed/types/index.ts` (289 LOC)** → `src/seed/types/index/`:
    - Modularized into domain-specific re-export segments (`auth.ts`, `billing.ts`, `mission.ts`, `media.ts`) while keeping `src/seed/types/index.ts` strictly `< 50 LOC`.

13. **`src/components/rollback-panel.tsx` (210 LOC)** → `src/components/rollback/`:
    - `types.ts` (<40 LOC): Rollback version DTOs, confirmation modal props.
    - `version-list.tsx` (<90 LOC): Previous deployment list and diff viewer (`'use client'`).
    - `confirmation-dialog.tsx` (<70 LOC): Emergency rollback confirmation dialog (`'use client'`).
    - `rollback-view.tsx` (<80 LOC): Main container component with mutation state.
    - Root facade: `rollback-panel.tsx` (<20 LOC, `'use client'`).

14. **`src/land/video/publishing/providers/pinterest-publisher.ts` (208 LOC)** → `src/land/video/publishing/providers/pinterest/`:
    - `types.ts` (<50 LOC): Pinterest Pin schemas, board IDs, media upload options.
    - `api-client.ts` (<80 LOC): Pinterest REST API client with rate-limiting.
    - `media-uploader.ts` (<80 LOC): Video asset chunked upload to Pinterest CDN.
    - `publisher-service.ts` (<80 LOC): Board resolution, pin creation, and verification.
    - Root facade: `pinterest-publisher.ts` (<20 LOC).

15. **Governance Conclave Consensus Core Extraction**:
    - Create `src/tree/governance/core/`:
      - `types.ts` (<50 LOC): `ConclaveProposal`, `VoteRecord`, `QuorumResult`, `ConclaveStatus`.
      - `voting-engine.ts` (<90 LOC): Universal ballot casting, tallying, and threshold math.
      - `quorum-validator.ts` (<70 LOC): Member eligibility, quorum thresholds, epoch checks.
      - `proposal-lifecycle.ts` (<90 LOC): State transitions (draft -> voting -> enacted -> vetoed).
      - `index.ts` (<20 LOC).
    - Refactor `src/tree/governance/inter-galactic-supreme-conclave-engine.ts` (212 LOC) and peers to consume `@/tree/governance/core/`, bringing each engine cleanly under `< 120 LOC`.

---

## 3. Risk Assessment & Mitigations
- **Downstream Callers**: All 15 files will retain identical public APIs via `< 25 LOC` facades.
- **Layer Architecture Invariants**: Submodules will strictly respect unidirectional boundaries (`seed` → `tree` → `forest` → `land`).
- **Test Integrity**: Existing 17,291 tests will run across all phases with 0 failures tolerated.
- **Client Directives**: UI subcomponents (`rollback-panel.tsx`) will preserve `'use client'`.

---

## 4. Next Steps
1. User approves implementation plan via `AskUserQuestion`.
2. Transition to implementation mode (`/plan:hard` or automated phase-by-phase execution).
3. Execute Phase 1 (Cluster 1), Phase 2 (Cluster 2), and Phase 3 (Cluster 3).
4. Run full test suite and quality gates.
