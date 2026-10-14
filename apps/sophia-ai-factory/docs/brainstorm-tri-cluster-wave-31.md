# Wave 31 Tri-Cluster Deep Modularization & Architecture Refactor Brainstorm

## Problem Statement
Following the successful completion of Wave 30, the production codebase retains monolithic files exceeding the strict `< 200 LOC` threshold. These monoliths introduce cognitive complexity, increase risk in autonomous agent pipelines, and violate single-responsibility boundaries.

Wave 31 targets the next 15 mission-critical production monoliths (~3,669 LOC total, 241L–253L) across 3 parallel architectural clusters.

---

## Target Decomposition Matrix (15 Monoliths ~ 3,669 LOC)

### Cluster 1: Multi-Platform Publishing, Video Synthesis & AI Clients (5 targets ~ 1,227 LOC)
1. **`src/tree/publishing/providers/telegram-publisher.ts` (253L)** → `src/tree/publishing/providers/telegram/`
   - `types.ts` (<60L): `TelegramPublishInput`, `TelegramPublishResult`, and `TelegramApiError` class.
   - `caption-sanitizer.ts` (<100L): MarkdownV2 escape, truncation, and tag formatting.
   - `api-client.ts` (<140L): Low-level Telegram Bot API fetch with circuit breaker & retry-after hints.
   - `publisher-service.ts` (<140L): High-level publish service coordinating auth & D1 status updates.
   - `index.ts` (<20L) + Root facade `telegram-publisher.ts` (<15L).

2. **`src/seed/inference/zunef-client.ts` (247L)** → `src/seed/inference/zunef/`
   - `types.ts` (<60L): Completion options, token storage interfaces, response payloads.
   - `token-manager.ts` (<110L): KV/D1 credential retrieval, refresh leases, and caching.
   - `circuit-state.ts` (<90L): Circuit breaker integration and state tracking.
   - `zunef-client.ts` (<140L): Edge-compatible completion runner with streaming and circuit guard.
   - `index.ts` (<20L) + Root facade `zunef-client.ts` (<15L).

3. **`src/land/heygen/heygen-client.ts` (245L)** → `src/land/heygen/client/`
   - `types.ts` (<60L): Avatar, voice, video status schemas, and response DTOs.
   - `http-transport.ts` (<120L): Circuit breaker guarded fetcher with error classification (`ProviderQuotaExceededError`, etc.).
   - `avatar-voice-service.ts` (<110L): Avatar listing and voice querying operations.
   - `video-generator-service.ts` (<130L): Video generation creation and polling status logic with usage metering.
   - `index.ts` (<20L) + Root facade `heygen-client.ts` (<15L).

4. **`src/land/video/publishing/providers/linkedin-publisher.ts` (241L)** → `src/land/video/publishing/providers/linkedin/`
   - `types.ts` (<50L): Upload requests, member URNs, video stats interfaces.
   - `asset-uploader.ts` (<120L): LinkedIn Community Management API upload registration and binary PUT.
   - `post-creator.ts` (<120L): UGC/Post creation with commentary length limits and video attachments.
   - `linkedin-publisher.ts` (<130L): Implementation of `Publisher` interface coordinating upload, post creation, and stats.
   - `index.ts` (<20L) + Root facade `linkedin-publisher.ts` (<15L).

5. **`src/land/publish/distribution-plan.ts` (241L)** → `src/land/publish/distribution/`
   - `types.ts` (<70L): Zod schemas (`DistributionPlanSchema`), platform enums, D1 row interfaces.
   - `plan-validator.ts` (<90L): Schedule validation, platform array verification, and metadata checks.
   - `post-generator.ts` (<120L): D1 DistributionPost row generator with idempotency keys (`planId+platform`).
   - `distribution-plan-service.ts` (<140L): D1 persistence runner using `createServerClient()` for multi-channel fan-out.
   - `index.ts` (<20L) + Root facade `distribution-plan.ts` (<15L).

---

### Cluster 2: Enterprise Governance, Partners & Integrations (5 targets ~ 1,231 LOC)
6. **`src/tree/affiliates/credentials.ts` (249L) & `src/land/affiliates/credentials.ts` (249L)** → `src/tree/affiliates/credentials/`
   - `types.ts` (<60L): `AffiliateNetwork` union, `NetworkCredentialPayload` interface.
   - `crypto-vault.ts` (<110L): AES-256-GCM encryption/decryption via `token-crypto`.
   - `credential-store.ts` (<140L): D1 tenant-scoped credential read, write, list, and delete operations.
   - `credential-validator.ts` (<110L): Network-specific schema checks and test connection probes.
   - `index.ts` (<25L) + Facades `src/tree/affiliates/credentials.ts` (<15L) and `src/land/affiliates/credentials.ts` (<15L) — eliminates duplicate code and restores DRY!

7. **`src/land/admin/enterprise-sso-actions.ts` (247L)** → `src/land/admin/sso/`
   - `types.ts` (<50L): Action input schemas, authorization error results (`'use server'`).
   - `sso-auth-guard.ts` (<110L): Admin role and multi-tenant organization membership checker.
   - `sso-mutations.ts` (<140L): Server actions for save, update, delete SSO configuration with audit logging.
   - `sso-queries.ts` (<110L): Server actions for retrieving SSO configuration and IdP domain routing.
   - `index.ts` (<25L) + Root facade `enterprise-sso-actions.ts` (<15L).

8. **`src/land/partners/partner-cross-border-actions.ts` (246L)** → `src/land/partners/cross-border/`
   - `types.ts` (<60L): Cross-border action errors, calculation inputs, currency DTOs (`'use server'`).
   - `payout-preview-action.ts` (<120L): Server action calculating withholding tax, FX hedging buffer, and net payout.
   - `commission-record-action.ts` (<130L): Server action recording cross-border commission entries in D1 ledger.
   - `ledger-query-actions.ts` (<130L): Server actions for partner ledger query, summary, and settlement execution.
   - `index.ts` (<25L) + Root facade `partner-cross-border-actions.ts` (<15L).

9. **`src/land/openclaw/automation-hooks.ts` (246L)** → `src/land/openclaw/hooks/`
   - `types.ts` (<50L): Event names (`AUTOMATION_EVENTS`), hook specs, runtime telemetry types.
   - `hook-registry.ts` (<120L): Idempotent registration of built-in domain automation handlers with event bus.
   - `fleet-dispatcher.ts` (<130L): Safe asynchronous dispatch handlers invoking `spawnAgentFleet` with `Promise.allSettled`.
   - `coverage-tracker.ts` (<100L): Telemetry metrics calculation for auto-dispatch coverage and hook stats.
   - `index.ts` (<25L) + Root facade `automation-hooks.ts` (<15L).

10. **`src/land/telegram-sales/telegram-lead-repo.ts` (241L)** → `src/land/telegram-sales/repo/`
    - `types.ts` (<50L): Lead query filters, update payloads, in-memory cache definitions.
    - `lead-queries.ts` (<120L): D1 queries for leads by chat ID, username, campaign ID, and qualification status.
    - `lead-mutations.ts` (<130L): Upsert, update status, and promo tracking D1 transactions with fallback cache.
    - `lead-repository.ts` (<120L): Unified repository facade orchestrating queries, mutations, and analytics.
    - `index.ts` (<25L) + Root facade `telegram-lead-repo.ts` (<15L).

---

### Cluster 3: Agent Intelligence, Strategy, BI & Frontend Views (5 targets ~ 1,212 LOC)
11. **`src/forest/agent-chat/memory-consolidation-service.ts` (243L)** → `src/forest/agent-chat/memory/`
    - `types.ts` (<50L): Context budgeting options, consolidation payloads, pruning configs.
    - `budget-checker.ts` (<110L): Context window token estimation against model capacity limits.
    - `summarization-orchestrator.ts` (<130L): Non-blocking conversation trimming and async LLM summarizer.
    - `consolidation-service.ts` (<140L): Service managing KV storage, lifecycle, and periodic pruning.
    - `index.ts` (<25L) + Root facade `memory-consolidation-service.ts` (<15L).

12. **`src/tree/bi/export-formatter.ts` (243L)** → `src/tree/bi/export/`
    - `types.ts` (<50L): RFC-4180 CSV options, JSON options, streaming response headers.
    - `csv-serializer.ts` (<130L): RFC-4180 compliant CSV field escaping, CRLF line breaks, formula sanitization.
    - `json-stream-generator.ts` (<120L): NDJSON and formatted JSON array generators for edge streaming.
    - `streaming-response.ts` (<110L): Web Streams API `ReadableStream<Uint8Array>` and Next.js / Workers Response builder.
    - `index.ts` (<25L) + Root facade `export-formatter.ts` (<15L).

13. **`src/app/api/v1/creative-studio/images/generate/route.ts` (243L)** → `src/app/api/v1/creative-studio/images/generate/core/`
    - `types.ts` (<50L): Zod request schema, model allowlists (`TIER_ALLOWED_MODELS`, `TIER_ALLOWED_FAL_MODELS`).
    - `model-resolver.ts` (<110L): Tier gating, FAL vs MuAPI provider routing, and aspect ratio normalization.
    - `job-dispatcher.ts` (<130L): Media job submission, BYOK key resolution, and usage telemetry tracking.
    - `route-handler.ts` (<130L): Next.js Route POST handler with error mapping and JSON responses.
    - `index.ts` (<25L) + Root facade route `route.ts` (<25L).

14. **`src/tree/youtube-strategy/strategy-generator.ts` (242L)** → `src/tree/youtube-strategy/generator/`
    - `types.ts` (<60L): `StrategyRequest`, `ContentStrategy`, `CompetitorInsight`, and content type definitions.
    - `template-fallbacks.ts` (<110L): Evergreen topic repository and rule-based strategy fallbacks.
    - `llm-prompt-builder.ts` (<110L): Prompt engineering for viral hook, angle, and keyword generation.
    - `strategy-generator.ts` (<130L): AI generator with fallback handling and competitor analysis.
    - `index.ts` (<25L) + Root facade `strategy-generator.ts` (<15L).

15. **`src/components/approval-queue.tsx` (242L)** → `src/components/approval-queue/`
    - `types.ts` (<50L): Approval item interface, filter status, action payloads (`'use client'`).
    - `approval-card.tsx` (<120L): Single approval request card with agent metadata and cost estimate.
    - `action-buttons.tsx` (<110L): Approve, reject, and retry button controls with optimistic feedback.
    - `approval-queue-view.tsx` (<140L): Main approval queue container with polling and bilingual translation.
    - `index.ts` (<25L) + Root facade `approval-queue.tsx` (<15L).

---

## Architectural & Quality Invariants
1. **File Budget**: Every single sub-file strictly `< 200 LOC`.
2. **Backward Compatibility**: Facade at every original path re-exports (`export * from './<subfolder>/index';` or Next.js route handler delegation).
3. **Clean Layers**: Strictly preserve `seed` → `tree` → `forest` → `land` isolation. No illegal upward or cross-layer imports (only `forest` → `land` orchestration permitted).
4. **DRY & Deduplication**: Consolidate `src/tree/affiliates/credentials.ts` and `src/land/affiliates/credentials.ts` into a single canonical source of truth in `tree/` with backward-compatible re-exports.
5. **TypeScript & Lint**: 0 `:any`, 0 raw `console.log`, 0 ESLint errors.
6. **Quality Gates**: `npm run type-check`, `npm run lint`, `bash scripts/check-layer-boundaries.sh`, and `npm test` (all tests passing).
