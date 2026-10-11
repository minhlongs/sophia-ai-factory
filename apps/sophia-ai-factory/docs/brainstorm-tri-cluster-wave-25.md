# Architecture Brainstorm: Wave 25 Tri-Cluster Deep Modularization

## 1. Problem Statement & Mission Objective
Following the completion of Wave 24, 15 monolithic files (between 286L and 318L, totaling ~4,360 LOC) remain in high-traffic production paths across Sophia AI Factory:
- Large files dilute the LLM context window during autonomous development and automated agent reasoning.
- Violates Single Responsibility Principle (SRP) by mixing persistence, business rules, API callers, and validation logic in single files.
- Refactoring targets must maintain the strict `< 200 LOC` invariant per submodule, `< 25 LOC` per root facade, zero layer violations, zero `:any`, and zero `console.log`.

---

## 2. Cluster Division (15 Monoliths ~ 4,360 LOC)

### Cluster 1: Frontend Views, Client Components & Marketplaces (5 targets ~ 1,429 LOC)
1. `src/land/marketplace/creator-royalty-widget.tsx` (289L) → `src/land/marketplace/royalty-widget/`
   - Split: `types.ts`, `royalty-summary.tsx`, `payout-history-table.tsx`, `royalty-widget-view.tsx`, `index.ts`
2. `src/app/creator/page.tsx` (289L) → `src/app/creator/view/`
   - Split: `types.ts`, `creator-hero.tsx`, `creator-stats.tsx`, `creator-page-view.tsx`, `index.ts`
3. `src/forest/components/checkout/checkout-panel.tsx` (282L) → `src/forest/components/checkout/panel/`
   - Split: `types.ts`, `pricing-summary.tsx`, `payment-methods.tsx`, `checkout-panel-view.tsx`, `index.ts`
4. `src/forest/components/dashboard/handover-client.tsx` (281L) → `src/forest/components/dashboard/handover/`
   - Split: `types.ts`, `handover-steps.tsx`, `credentials-summary.tsx`, `handover-client-view.tsx`, `index.ts`
5. `src/app/[locale]/solutions/[use-case]/page.tsx` (280L) → `src/app/[locale]/solutions/[use-case]/view/`
   - Split: `types.ts`, `solution-hero.tsx`, `solution-features.tsx`, `solution-page-view.tsx`, `index.ts`

### Cluster 2: Domain Intelligence, Help & Market Signal Processors (5 targets ~ 1,452 LOC)
6. `src/seed/ai/provider-registry.ts` (318L) → `src/seed/ai/registry/`
   - Split: `types.ts`, `provider-definitions.ts`, `model-catalog.ts`, `provider-registry-service.ts`, `index.ts`
7. `src/tree/help/progress.ts` (299L) → `src/tree/help/progress-tracking/`
   - Split: `types.ts`, `video-progress-queries.ts`, `progress-calculator.ts`, `progress-service.ts`, `index.ts`
8. `src/tree/market-signals/sources/youtube-source.ts` (294L) → `src/tree/market-signals/sources/youtube/`
   - Split: `types.ts`, `youtube-client.ts`, `signal-parser.ts`, `youtube-signal-source.ts`, `index.ts`
9. `src/tree/usage-metering/usage-kv-sync.ts` (288L) → `src/tree/usage-metering/kv-sync/`
   - Split: `types.ts`, `kv-batch-reader.ts`, `d1-reconciler.ts`, `usage-kv-sync-service.ts`, `index.ts`
10. `src/tree/organizations/mcu-allocation-engine.ts` (287L) → `src/tree/organizations/mcu-allocation/`
    - Split: `types.ts`, `quota-calculator.ts`, `rebalancer.ts`, `mcu-allocation-service.ts`, `index.ts`

### Cluster 3: Billing, Payments, Repositories & Platform Primitives (5 targets ~ 1,450 LOC)
11. `src/seed/auth/resolve-org-id.ts` (295L) → `src/seed/auth/org-resolver/`
    - Split: `types.ts`, `session-org-cache.ts`, `d1-org-queries.ts`, `org-resolver-service.ts`, `index.ts`
12. `src/seed/voices/presets.ts` (293L) → `src/seed/voices/preset-catalog/`
    - Split: `types.ts`, `vietnamese-presets.ts`, `multilingual-presets.ts`, `preset-service.ts`, `index.ts`
13. `src/seed/db/repositories/creator-memory-repo.ts` (292L) → `src/seed/db/repositories/creator-memory/`
    - Split: `types.ts`, `memory-queries.ts`, `memory-mutations.ts`, `creator-memory-repository.ts`, `index.ts`
14. `src/land/payments/payos.ts` (292L) → `src/land/payments/payos-gateway/`
    - Split: `types.ts`, `checksum-verifier.ts`, `webhook-dispatcher.ts`, `payos-service.ts`, `index.ts`
15. `src/seed/compliance/soc2-prep.ts` (291L) → `src/seed/compliance/soc2/`
    - Split: `types.ts`, `audit-log-collector.ts`, `evidence-builder.ts`, `soc2-prep-service.ts`, `index.ts`

---

## 3. Architecture Invariants
- **File Budget**: Every submodule `< 200 LOC`. Root facades `< 25 LOC` (target: 4-8 LOC).
- **Strangler Facade Pattern**: Root files preserved with exact original export signatures.
- **Layer Boundary Enforcement**: `seed` → `tree` → `forest` → `land`. Zero forbidden cross-layer imports.
- **Financial & Payment Resilience**: `Result<T, E>` pattern, atomic idempotency, D1 synchronous calls (`createServerClient()`).
- **Quality Gates**:
  1. `npm run type-check` (0 errors)
  2. `npm run lint -- --quiet` (0 errors, 0 new suppressions)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (passed)
  5. `npx vitest run` (100% green tests)
