# Wave 21 Tri-Cluster Deep Modularization: Architecture & Strategy Blueprint

## Executive Summary
Wave 21 targets the next 15 highest-density monoliths (~4,970 LOC total, all between 323L and 347L) across 3 parallel architectural clusters to enforce the strict `< 200 LOC` file budget invariant, eliminate context window dilution, maintain single-responsibility separation, and ensure zero regression across the Cloudflare Workers edge deployment.

---

## Architectural Invariants & Non-Negotiables
1. **Strict File Budget**: Every single newly created or refactored file must be strictly `< 200 LOC`.
2. **Backward-Compatible Root Facades**: Every original monolith file path is preserved as a lightweight facade (`< 25 LOC`) re-exporting its new submodule directory (`export * from './<submodule>/index';` or default exports).
3. **Layer Hierarchy**: Strict unidirectional boundaries:
   - `seed` (foundational primitives, config, auth, db client)
   - `tree` (reusable domain logic, crypto, analytics, SEO)
   - `forest` (reusable infrastructure, Inngest jobs, components, drawers, modals)
   - `land` (business workflows, server actions, billing, payouts)
   - Only Forest → Land orchestration permitted.
4. **Zero Quality Regressions**:
   - `npm run type-check` (0 errors)
   - `npm run lint -- --quiet` (0 errors, 0 new suppressions)
   - `bash scripts/check-layer-boundaries.sh` (0 violations)
   - `npm run i18n:validate` (0 missing keys)
   - `npm test` (100% green test suite)
   - Zero `:any` types, zero `console.log` in production code.

---

## Target Candidates (15 Monoliths across 3 Clusters)

### Cluster 1: Enterprise Deals, Solutions & Pricing Views (6 Targets ~ 2,023 LOC)
1. **`src/forest/deals/deal-detail-drawer.tsx` (347L)** → `src/forest/deals/detail-drawer/`:
   - `types.ts` (<60L): Deal status, activity record, and drawer prop interfaces.
   - `deal-header.tsx` (<120L): Stage badge, value summary, and close/archive actions.
   - `deal-timeline.tsx` (<140L): Historical interactions, stage progression, and note logs.
   - `deal-detail-drawer-view.tsx` (<150L): Slide-out drawer container and stage transition controls.
   - `index.ts` (<20L) + Root facade `deal-detail-drawer.tsx` (<20L).

2. **`src/forest/components/pricing/one-time-bundle-card.tsx` (345L)** → `src/forest/components/pricing/bundle-card/`:
   - `types.ts` (<60L): Bundle features, pricing tier, and discount badge contracts.
   - `bundle-features.tsx` (<130L): Feature checklist, quota credits, and bonus perks display.
   - `bundle-actions.tsx` (<120L): Purchase CTA, currency toggle, and promo trigger.
   - `one-time-bundle-card-view.tsx` (<150L): Card container with highlight glow and responsive layout.
   - `index.ts` (<20L) + Root facade `one-time-bundle-card.tsx` (<20L).

3. **`src/forest/solutions/solution-interactive-sections.tsx` (340L)** → `src/forest/solutions/interactive-sections/`:
   - `types.ts` (<60L): Interactive step, feature highlight, and tab schemas.
   - `section-stepper.tsx` (<140L): Interactive workflow step navigator and progress indicators.
   - `feature-highlight.tsx` (<130L): Media preview, video render demos, and capability cards.
   - `solution-interactive-sections-view.tsx` (<150L): Main orchestrator component.
   - `index.ts` (<20L) + Root facade `solution-interactive-sections.tsx` (<20L).

4. **`src/forest/components/pricing/coupon-input.tsx` (340L)** → `src/forest/components/pricing/coupon/`:
   - `types.ts` (<60L): Coupon validation response, discount type, and input states.
   - `coupon-validator.ts` (<130L): Promo code syntax sanitizer and client verification helper.
   - `coupon-badge.tsx` (<110L): Applied discount pill, saving amount display, and remove action.
   - `coupon-input-view.tsx` (<150L): Input field with debounce, loading spinner, and error toast.
   - `index.ts` (<20L) + Root facade `coupon-input.tsx` (<20L).

5. **`src/components/stitch/screens/auth/register-page.tsx` (328L)** → `src/components/stitch/screens/auth/register/`:
   - `types.ts` (<60L): Registration form fields, validation errors, and auth state.
   - `register-form.tsx` (<150L): Full name, email, password, referral code, and terms checkbox.
   - `social-auth-buttons.tsx` (<120L): Google / GitHub OAuth entry points and divider.
   - `register-page-view.tsx` (<140L): Stitch hero layout wrapper, testimonials, and branding.
   - `index.ts` (<20L) + Root facade `register-page.tsx` (<20L).

6. **`src/forest/deals/new-deal-modal.tsx` (323L)** → `src/forest/deals/new-deal/`:
   - `types.ts` (<60L): Deal creation DTO, stage definitions, and validation rules.
   - `deal-form.tsx` (<150L): Deal title, value in USD/VND, pipeline stage, and contact association.
   - `new-deal-modal-view.tsx` (<140L): Modal wrapper, ESC dismiss, and form submit handler.
   - `index.ts` (<20L) + Root facade `new-deal-modal.tsx` (<20L).

---

### Cluster 2: Land Business Workflows & Partner Server Actions (3 Targets ~ 991 LOC)
7. **`src/land/integrations/integration-actions.ts` (332L)** → `src/land/integrations/actions/`:
   - `types.ts` (<70L): Webhook configurations, third-party connector types, and sync status.
   - `connector-sync.ts` (<150L): Cloudflare Worker outbound connector sync and webhook retries.
   - `integration-mutations.ts` (<160L): Server Actions for API key storage, webhook toggles, and deletion.
   - `index.ts` (<20L) + Root facade `integration-actions.ts` (<20L).

8. **`src/land/partners/partner-actions.ts` (330L)** → `src/land/partners/partner-ops/`:
   - `types.ts` (<70L): Partner tier updates, payout request schema, and commission rates.
   - `partner-commission-ops.ts` (<150L): Commission ledger adjustments and tier qualification checks.
   - `partner-management-actions.ts` (<160L): Server actions for partner approval, tier changes, and suspension.
   - `index.ts` (<20L) + Root facade `partner-actions.ts` (<20L).

9. **`src/tree/help/mutations.ts` (329L)** → `src/tree/help/mutation-ops/`:
   - `types.ts` (<60L): Support ticket schema, reply payload, and priority escalation enums.
   - `ticket-validator.ts` (<120L): Input sanitization, attachment size validation, and rate limit checks.
   - `ticket-mutations.ts` (<160L): D1 ticket creation, status transitions, and agent assignment.
   - `index.ts` (<20L) + Root facade `mutations.ts` (<20L).

---

### Cluster 3: Domain Intelligence, SLA, Metering & Auth Engines (6 Targets ~ 1,956 LOC)
10. **`src/tree/youtube-strategy/seo-optimizer.ts` (329L)** → `src/tree/youtube-strategy/seo/`:
    - `types.ts` (<70L): Keyword density scores, title character clamps, and hashtag relevance.
    - `keyword-analyzer.ts` (<140L): Search volume weighting, competition index, and tag ranking.
    - `title-optimizer.ts` (<150L): Click-through rate hook generator and character truncation rules.
    - `seo-engine.ts` (<160L): Composite SEO score calculation and optimization recommendations.
    - `index.ts` (<20L) + Root facade `seo-optimizer.ts` (<20L).

11. **`src/tree/handover/handover-certificate-engine.ts` (328L)** → `src/tree/handover/certificate/`:
    - `types.ts` (<70L): Certificate cryptographic payload, audit hashes, and buyer claims.
    - `certificate-signer.ts` (<140L): HMAC-SHA256 milestone signature and verification.
    - `certificate-generator.ts` (<160L): PDF/HTML certificate metadata assembly and D1 logging.
    - `index.ts` (<20L) + Root facade `handover-certificate-engine.ts` (<20L).

12. **`src/seed/auth/require-admin.ts` (327L)** → `src/seed/auth/admin/`:
    - `types.ts` (<60L): Admin role definitions, permission matrix, and session claims.
    - `role-evaluator.ts` (<130L): Superadmin, billing admin, and support agent permission checks.
    - `admin-guard.ts` (<150L): Edge middleware route protector and Server Action authorization guard.
    - `index.ts` (<20L) + Root facade `require-admin.ts` (<20L).

13. **`src/tree/usage-metering/usage-reconciliation.ts` (325L)** → `src/tree/usage-metering/reconciliation/`:
    - `types.ts` (<70L): MCU usage discrepancy, meter event logs, and billing intervals.
    - `discrepancy-detector.ts` (<140L): KV cache vs D1 database usage count alignment calculator.
    - `reconciliation-engine.ts` (<160L): Batch ledger adjustment and drift correction transactions.
    - `index.ts` (<20L) + Root facade `usage-reconciliation.ts` (<20L).

14. **`src/tree/mekong/health.ts` (324L)** → `src/tree/mekong/health-checker/`:
    - `types.ts` (<60L): Service health status, probe latency thresholds, and dependency status.
    - `subsystem-probes.ts` (<140L): D1, R2, KV, and external AI provider ping probes.
    - `health-aggregator.ts` (<150L): Composite health report compiler and degraded status evaluator.
    - `index.ts` (<20L) + Root facade `health.ts` (<20L).

15. **`src/tree/revenue/sla-uptime-engine.ts` (323L)** → `src/tree/revenue/sla/`:
    - `types.ts` (<70L): SLA tier percentage (99.9% vs 99.99%), downtime incidents, and credits.
    - `uptime-calculator.ts` (<140L): Monthly rolling uptime window calculation and penalty brackets.
    - `sla-credit-engine.ts` (<150L): Automated billing credit credit-note generation on breach.
    - `index.ts` (<20L) + Root facade `sla-uptime-engine.ts` (<20L).

---

## Verification & Execution Gates
- **Phase 1**: Cluster 1 (UI Views & Configurator Drawers)
- **Phase 2**: Cluster 2 (Business Workflows & Partner Server Actions)
- **Phase 3**: Cluster 3 (Domain Intelligence, SLA, Metering & Auth Engines)
- **Phase 4**: Full Quality Gate Verification (`type-check`, `lint`, `layer-boundaries`, `i18n:validate`, `test`)
