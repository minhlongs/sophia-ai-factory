# Brainstorming Report: Full-Spectrum Modularization & Architecture Refactor (Wave 14)

**Date**: 2026-10-10  
**Target**: Sophia AI Factory (`apps/sophia-ai-factory/src/`)  
**Scope**: Full-Spectrum ("Cả 3"): Core Backend Engines, Frontend UI/UX Components, and Gateways/Domain Services  
**Invariant**: Strictly `< 200 LOC` per file, Zero `:any`, Zero `console.log`, 100% Backward-Compatible Facades, 0 Quality Gate Failures.

---

## 1. Problem Statement & Context
Following Wave 13's successful modularization, the codebase still contains ~480 production files over 200 LOC. High-complexity files in GPU routing, AI generation, MRR financial consolidation, WhatsApp template configuration, and external client gateways introduce cognitive overhead and elevate regression risks.

Key monoliths identified:
1. **Core AI & Distributed Compute**: GPU routing (`multi-region-router.ts`), playbook campaign generation (`campaign-generator.ts`), and OpenRouter inference provider (`openrouter-provider.ts`) handle multi-region load balancing, JSON extraction, and failover retries in single >425 LOC files.
2. **Frontend Views & Client Dashboards**: Billing pricing matrix (`pricing-section.tsx`), WhatsApp business templates (`WhatsAppTemplatesClient.tsx`), creator payouts management (`creator-payouts-section.tsx`), and BYOK key forms (`byok-key-form.tsx`) bundle UI markup, API mutations, form validation, and locale handling in files >400 LOC.
3. **Domain Gateways & Workflow Services**: Video syndication (`video-publishing.service.ts`), Edge TTS audio synthesis (`edge-tts-client.ts`), organization invitations (`invitation-service.ts`), and sales qualification (`qualification-service.ts`) bundle transport protocol, rate limiting, and business validation.

---

## 2. Evaluated Approaches

| Strategy | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| **Option A: Mega Big-Bang (All 480 files at once)** | Reaches complete 200 LOC compliance in one sweep | Extreme risk of regressions, unmanageable merge conflicts | ❌ Rejected (Violates KISS & YAGNI) |
| **Option B: Single-Domain Slicing (Backend only)** | Focused domain context | Leaves complex frontend forms and external gateways debt-laden | ❌ Rejected (User selected "Cả 3") |
| **Option C: Phased Tri-Cluster Wave 14 (Top 15 Monoliths: 5 Engines + 5 Frontend + 5 Gateways)** | Balances all 3 architectural pillars; preserves 100% backward-compatible facades; zero quality gate failures | Requires disciplined sub-module factoring and interface typing | ✅ **Recommended** |

---

## 3. Wave 14 Target Matrix (15 Targets ~ 6,370 LOC)

### Cluster 1: Core Backend Engines & AI Compute (5 Targets ~ 2,145 LOC)
1. **`src/tree/gpu-mesh/multi-region-router.ts` (432L)** → `src/tree/gpu-mesh/router/`:
   - `types.ts` (<80L): Region definitions, routing strategies, latency thresholds.
   - `region-health-checker.ts` (<140L): Health pinging, circuit breaker status, failover selection.
   - `workload-balancer.ts` (<150L): Cost-optimal region scoring and queue depth estimation.
   - `multi-region-router.ts` (<160L): Main routing engine dispatching jobs to edge GPU instances.
   - `index.ts` (<20L) + root facade `multi-region-router.ts` (<15L).

2. **`src/forest/playbook/campaign-generator.ts` (431L)** → `src/forest/playbook/generator/`:
   - `types.ts` (<80L): Playbook campaign options, step graph schema, generation results.
   - `step-prompt-builder.ts` (<140L): Template interpolation, persona system instructions.
   - `campaign-validator.ts` (<130L): Schedule sanity checks, budget constraints, step dependency validation.
   - `campaign-generator.ts` (<160L): AI orchestrator generating multi-step viral playbooks.
   - `index.ts` (<20L) + root facade `campaign-generator.ts` (<15L).

3. **`src/tree/revenue/mrr-consolidation-engine.ts` (430L)** → `src/tree/revenue/mrr/`:
   - `types.ts` (<80L): MRR snapshot schema, cohort metrics, plan price conversions.
   - `cohort-aggregator.ts` (<150L): MoM expansion, contraction, churn, and new ARR aggregation.
   - `currency-normalizer.ts` (<120L): Multi-currency FX conversion and billing interval alignment.
   - `mrr-engine.ts` (<160L): D1 ledger rollup and reporting snapshot generator.
   - `index.ts` (<20L) + root facade `mrr-consolidation-engine.ts` (<15L).

4. **`src/forest/ai/openrouter-provider.ts` (428L)** → `src/forest/ai/openrouter/`:
   - `types.ts` (<80L): Model parameters, streaming chunk interfaces, token usage metrics.
   - `request-formatter.ts` (<140L): OpenAI-compatible message transformation and schema enforcement.
   - `error-classifier.ts` (<130L): Circuit breaker integration and rate limit backoff strategies.
   - `openrouter-client.ts` (<160L): Direct fetch client handling streaming responses and BYOK headers.
   - `index.ts` (<20L) + root facade `openrouter-provider.ts` (<15L).

5. **`src/tree/memory/memory-pruner.ts` (424L)** → `src/tree/memory/pruner/`:
   - `types.ts` (<70L): Retention rules, importance score weights, decay parameters.
   - `decay-evaluator.ts` (<140L): Time-decay math and semantic relevance scoring.
   - `tombstone-cleaner.ts` (<130L): D1 vacuuming and orphaned vector purge.
   - `memory-pruner-service.ts` (<160L): Batch pruner executing scheduled memory reclamation.
   - `index.ts` (<20L) + root facade `memory-pruner.ts` (<15L).

---

### Cluster 2: Frontend Views & Mission/Pricing Components (5 Targets ~ 2,049 LOC)
6. **`src/forest/components/pricing/pricing-section.tsx` (428L)** → `src/forest/components/pricing/section/`:
   - `types.ts` (<70L): Pricing card props, currency toggle options, tier feature specs.
   - `billing-interval-switch.tsx` (<120L): Monthly/Annual billing interval switcher and badge.
   - `pricing-tier-card.tsx` (<160L): Individual plan card rendering with CTA triggers.
   - `pricing-section-view.tsx` (<160L): Main container component with responsive grid and FAQ drawer.
   - `index.ts` (<20L) + root facade `pricing-section.tsx` (<15L).

7. **`src/app/[locale]/dashboard/setup/whatsapp-templates/WhatsAppTemplatesClient.tsx` (418L)** → `src/app/[locale]/dashboard/setup/whatsapp-templates/components/`:
   - `types.ts` (<70L): Template schema, variable mapping, message status.
   - `template-editor.tsx` (<150L): Dynamic variable injection form and character counter.
   - `template-preview.tsx` (<130L): Mobile mockup rendering WhatsApp chat bubbles.
   - `template-list-table.tsx` (<140L): Registered templates table with status chips and delete triggers.
   - `WhatsAppTemplatesClient.tsx` (<160L): Client orchestrator with state machine and Server Actions.
   - `index.ts` (<20L).

8. **`src/forest/components/sop/creator-payouts-section.tsx` (417L)** → `src/forest/components/sop/payouts/`:
   - `types.ts` (<70L): Payout row types, filter contracts, wallet status.
   - `payout-kpi-cards.tsx` (<130L): Total earnings, pending balance, and payout velocity metrics.
   - `payout-history-table.tsx` (<160L): Paginated transaction log with TRC20/USDT hash links.
   - `creator-payouts-view.tsx` (<150L): Main orchestrator with date filter controls and export trigger.
   - `index.ts` (<20L) + root facade `creator-payouts-section.tsx` (<15L).

9. **`src/forest/components/byok/byok-key-form.tsx` (401L)** → `src/forest/components/byok/form/`:
   - `types.ts` (<70L): Key status, provider metadata, verification response.
   - `provider-card.tsx` (<140L): Provider icon, description, and status indicator.
   - `key-input-field.tsx` (<140L): Masked password input, validation feedback, and verify button.
   - `byok-form-view.tsx` (<160L): Key rotation manager with CSRF-protected mutation handler.
   - `index.ts` (<20L) + root facade `byok-key-form.tsx` (<15L).

10. **`src/app/(app)/dashboard/admin/byok-rotation/byok-rotation-client.tsx` (385L)** → `src/app/(app)/dashboard/admin/byok-rotation/components/`:
    - `types.ts` (<70L): Rotation queue items, audit log entries, emergency killswitch status.
    - `rotation-metrics.tsx` (<130L): Active keys count, error rate spike detection, and quota alerts.
    - `rotation-schedule-table.tsx` (<150L): Auto-rotation calendar and manual trigger controls.
    - `byok-rotation-view.tsx` (<150L): Admin dashboard container with live refresh and export.
    - `index.ts` (<20L) + root facade `byok-rotation-client.tsx` (<15L).

---

### Cluster 3: Gateways, Handlers & Domain Services (5 Targets ~ 2,128 LOC)
11. **`src/tree/organizations/invitation-service.ts` (428L)** → `src/tree/organizations/invitation/`:
    - `types.ts` (<70L): Invite request DTO, role permission matrix, expiration policy.
    - `token-generator.ts` (<120L): Cryptographic token generation and HMAC-SHA256 signature verification.
    - `email-dispatcher.ts` (<140L): Resend transactional email formatting with localized templates.
    - `invitation-service.ts` (<160L): D1 team member onboarding and seat quota validation.
    - `index.ts` (<20L) + root facade `invitation-service.ts` (<15L).

12. **`src/land/video/publishing/video-publishing.service.ts` (427L)** → `src/land/video/publishing/service/`:
    - `types.ts` (<80L): Video publish request, platform tokens, rendering progress.
    - `platform-router.ts` (<140L): Target channel selector (YouTube, TikTok, Instagram Reels).
    - `metadata-formatter.ts` (<130L): Title truncation, SEO tags, and thumbnail attachment.
    - `publishing-orchestrator.ts` (<160L): Queue dispatch and webhook completion notifier.
    - `index.ts` (<20L) + root facade `video-publishing.service.ts` (<15L).

13. **`src/forest/edge-tts/edge-tts-client.ts` (426L)** → `src/forest/edge-tts/client/`:
    - `types.ts` (<70L): SSML options, voice identifiers, audio stream chunk types.
    - `ssml-builder.ts` (<130L): Speech pitch, rate, contour, and phoneme XML builder.
    - `websocket-connection.ts` (<160L): Edge WebSocket transport with auto-reconnect and timeout guard.
    - `edge-tts-client.ts` (<160L): Buffer stream accumulator and MP3 audio synthesizer.
    - `index.ts` (<20L) + root facade `edge-tts-client.ts` (<15L).

14. **`src/land/telegram-sales/qualification-service.ts` (425L)** → `src/land/telegram-sales/qualification/`:
    - `types.ts` (<70L): Lead score rubric, intent triggers, qualification stages.
    - `intent-classifier.ts` (<140L): Customer budget extraction, urgency detection, and intent classifier.
    - `routing-rules.ts` (<130L): High-ticket routing to human closer vs automated funnel.
    - `qualification-service.ts` (<160L): Main state machine updating Telegram sales CRM in D1.
    - `index.ts` (<20L) + root facade `qualification-service.ts` (<15L).

15. **`src/tree/sop/performance-feedback-engine.ts` (422L)** → `src/tree/sop/feedback/`:
    - `types.ts` (<70L): SOP metrics, rating schema, reinforcement weights.
    - `metric-evaluator.ts` (<140L): Execution speed, error frequency, and satisfaction score math.
    - `weight-adjuster.ts` (<130L): Dynamic prompt weight recalibration for agent SOPs.
    - `feedback-engine.ts` (<160L): D1 execution log writer and feedback loop coordinator.
    - `index.ts` (<20L) + root facade `performance-feedback-engine.ts` (<15L).

---

## 4. Architectural Invariants & Quality Standards
1. **LOC Budget**: Zero files $\ge 200$ LOC in all newly refactored directories.
2. **Layer Hierarchy**: `seed` (primitives) $\rightarrow$ `tree` (reusable domain) $\rightarrow$ `forest` (orchestrators) $\rightarrow$ `land` (workflows).
3. **Root Facades**: Every original monolith entrypoint file is maintained as a $<20$ LOC re-export (`export * from './<subfolder>';`).
4. **Code Quality**: Zero `:any` types, zero `console.log`, proper Zod parsing, robust circuit breaking.
5. **Quality Gates**:
   - `npm run type-check` (0 errors)
   - `npm run lint -- --quiet` (0 errors)
   - `bash scripts/check-layer-boundaries.sh` (0 violations)
   - `npm run i18n:validate` (0 missing keys)
   - `npm test` (100% green suite)
