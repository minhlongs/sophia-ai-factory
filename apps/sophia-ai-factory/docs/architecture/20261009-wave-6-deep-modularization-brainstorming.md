# Brainstorming Report: Wave 6 Deep Modularization (< 200 LOC)

**Date**: 2026-10-09  
**Status**: Consensus Reached (All 3 Clusters Approved)  
**Scope**: 14 Monolithic Production Files (7,847 LOC)  

---

## 1. Problem Statement & Invariants

Post-Wave 5 audit revealed 14 production files exceeding 500 LOC (7,847 LOC total) spanning Partner Ecosystems, Growth Analytics/UI, and Enterprise Security/Trust.
Large file sizes impede context management, increase merge collision risk, and violate the strict `< 200 LOC` repository standard.

### Non-Negotiable Invariants:
1. **Strict File Size**: Every created and modified file must remain strictly `< 200 LOC`.
2. **Sophia 4-Layer Architecture**: `seed` -> `tree` -> `forest` -> `land`. Zero cross-layer violations.
3. **100% Backward Compatibility**: Public APIs preserved via thin root facades (`export * from './...'`).
4. **Zero `:any` & Zero `console.log`**: Strict TypeScript typing and `@/seed/utils/logger-utility`.
5. **Protected Flows**: BYOK Setup Wizard, Telegram Bot (`@Sophia_Bbot`), and NOWPayments IPN webhook protected against any regressions.

---

## 2. Architectural Clusters & Submodule Decomposition

### Cluster A: Partner Ecosystem & Reseller Marketplace (4 files, 2,209 LOC)

1. **`src/tree/partners/types.ts`** (593 LOC → `src/tree/partners/types/` + root facade):
   - `core-types.ts` (~120 LOC): Partner tier, partner account status, credentials.
   - `license-types.ts` (~130 LOC): Floating seat allocation, pooling quota brackets.
   - `hierarchy-types.ts` (~140 LOC): Reseller tree nodes, margin splits, commission rates.
   - `webhook-types.ts` (~110 LOC): Partner webhook payload, event schemas, delivery receipt.
   - `index.ts` (~30 LOC): Barrel export.

2. **`src/tree/partners/license-pooling.ts`** (583 LOC → `src/tree/partners/license-pool/` + root facade):
   - `types.ts` (~75 LOC): Pool state, lease token schemas, expiration configurations.
   - `pool-allocator.ts` (~140 LOC): Dynamic seat assignment and quota calculation.
   - `lease-lifecycle.ts` (~150 LOC): Heartbeat renewal, stale lease revocation, timeout reclamation.
   - `overflow-guard.ts` (~130 LOC): Grace period buffer, burst quota interlocks.
   - `index.ts` (~25 LOC): Barrel export.

3. **`src/tree/partners/reseller-hierarchy.ts`** (521 LOC → `src/tree/partners/hierarchy/` + root facade):
   - `types.ts` (~70 LOC): Hierarchy graph nodes, upstream parent links, level depths.
   - `tree-traversal.ts` (~145 LOC): Recursive ancestor resolution and cycle detection.
   - `margin-calculator.ts` (~150 LOC): Multi-level wholesale discount and margin waterfall calculation.
   - `tier-sync.ts` (~125 LOC): Downstream child account tier synchronization.
   - `index.ts` (~25 LOC): Barrel export.

4. **`src/tree/partners/partner-webhook-bus.ts`** (512 LOC → `src/tree/partners/webhook-bus/` + root facade):
   - `types.ts` (~65 LOC): Bus event types, subscription registrations, delivery logs.
   - `signature-verifier.ts` (~110 LOC): HMAC-SHA256 signature generation and validation.
   - `dispatcher.ts` (~145 LOC): HTTP POST dispatch with circuit breaker and exponential backoff.
   - `delivery-ledger.ts` (~130 LOC): D1 append-only delivery logging and retry queue tracking.
   - `index.ts` (~25 LOC): Barrel export.

---

### Cluster B: Growth Engines & Analytics UI (5 files, 2,927 LOC)

5. **`src/forest/growth/viral-funnel-view.tsx`** (669 LOC → `src/forest/growth/viral-funnel/` + root facade):
   - `types.ts` (~65 LOC): Funnel stage metrics, drop-off rates, conversion payload.
   - `funnel-header.tsx` (~110 LOC): Date range selector, funnel filters, export button.
   - `stage-cards.tsx` (~150 LOC): Interactive step conversion cards and bottleneck indicators.
   - `sankey-chart.tsx` (~160 LOC): Visual traffic drop-off and flow renderer.
   - `viral-funnel-view.tsx` (~140 LOC): Composed view container.
   - `index.ts` (~25 LOC): Barrel export.

6. **`src/forest/growth/customer-health-monitor.tsx`** (637 LOC → `src/forest/growth/health-monitor/` + root facade):
   - `types.ts` (~60 LOC): Churn risk score, engagement tier, telemetry badges.
   - `health-score-card.tsx` (~130 LOC): Aggregate tenant health distribution cards.
   - `risk-alert-table.tsx` (~165 LOC): At-risk tenant list with intervention action triggers.
   - `intervention-modal.tsx` (~155 LOC): Automated retention email and credit grant trigger modal.
   - `customer-health-monitor.tsx` (~120 LOC): Composed health monitor container.
   - `index.ts` (~25 LOC): Barrel export.

7. **`src/land/growth/growth-analytics-service.ts`** (587 LOC → `src/land/growth/analytics-service/` + root facade):
   - `types.ts` (~70 LOC): Analytics aggregation schemas, cohort definitions.
   - `cohort-aggregator.ts` (~150 LOC): LTV and retention cohort computation.
   - `velocity-calculator.ts` (~145 LOC): Viral coefficient (K-factor) and cycle time math.
   - `attribution-normalizer.ts` (~140 LOC): Multi-touch referral link and UTM normalization.
   - `index.ts` (~25 LOC): Barrel export.

8. **`src/forest/growth/opportunistic-scheduler.ts`** (530 LOC → `src/forest/growth/scheduler/` + root facade):
   - `types.ts` (~70 LOC): Off-peak rendering windows, opportunistic job priority queues.
   - `time-window-resolver.ts` (~130 LOC): Timezone-based off-peak window evaluator.
   - `backlog-drainer.ts` (~150 LOC): Opportunistic video compilation trigger and quota throttle.
   - `scheduler-engine.ts` (~140 LOC): Inngest scheduling integration and execution loop.
   - `index.ts` (~25 LOC): Barrel export.

9. **`src/forest/growth/growth-analytics-dashboard.tsx`** (504 LOC → `src/forest/growth/analytics-dashboard/` + root facade):
   - `types.ts` (~60 LOC): Dashboard props, period filter, KPI summary structures.
   - `metric-cards.tsx` (~135 LOC): Top-line revenue, active creators, and video generation counters.
   - `velocity-chart.tsx` (~155 LOC): Historical trend charts and velocity overlays.
   - `growth-analytics-dashboard.tsx` (~125 LOC): Composed dashboard grid layout.
   - `index.ts` (~25 LOC): Barrel export.

---

### Cluster C: Enterprise Trust, Security & Compliance (5 files, 2,711 LOC)

10. **`src/tree/custom-domains/verification-service.ts`** (581 LOC → `src/tree/custom-domains/verification/` + root facade):
    - `types.ts` (~70 LOC): Domain status, DNS challenge records, SSL certificate schemas.
    - `dns-resolver.ts` (~140 LOC): DoH (DNS-over-HTTPS) CNAME & TXT challenge lookup.
    - `cf-custom-hostname.ts` (~155 LOC): Cloudflare for Platforms custom hostname API client.
    - `ssl-status-poller.ts` (~135 LOC): SSL issuance lifecycle tracker and verification recorder.
    - `index.ts` (~25 LOC): Barrel export.

11. **`src/tree/sovereignty/compliance-ledger.ts`** (542 LOC → `src/tree/sovereignty/ledger/` + root facade):
    - `types.ts` (~75 LOC): Compliance record schemas, jurisdiction tags (EU, US, VN), data residency.
    - `residency-guard.ts` (~130 LOC): Cross-border transfer policy evaluator and blocking rules.
    - `audit-signer.ts` (~145 LOC): Cryptographic audit trail entry signing and hash chaining.
    - `ledger-repo.ts` (~140 LOC): D1 storage operations and historical compliance lookups.
    - `index.ts` (~25 LOC): Barrel export.

12. **`src/tree/creators/c2pa-provenance-signer.ts`** (532 LOC → `src/tree/creators/c2pa/` + root facade):
    - `types.ts` (~70 LOC): C2PA assertion manifests, cryptographic signing credentials, claim generator.
    - `manifest-builder.ts` (~150 LOC): Assertion generation for AI generation tools, prompts, and timestamps.
    - `cryptographic-signer.ts` (~145 LOC): Web Crypto ECDSA / Ed25519 signature generator.
    - `embed-injector.ts` (~135 LOC): JUMBF box packaging and MP4/PNG provenance metadata embedding.
    - `index.ts` (~25 LOC): Barrel export.

13. **`src/tree/creator-royalties/attribution.ts`** (530 LOC → `src/tree/creator-royalties/attribution/` + root facade):
    - `types.ts` (~70 LOC): Royalty slice schemas, split formulas, asset utilization records.
    - `slice-resolver.ts` (~145 LOC): Music, avatar, and script royalty split calculation.
    - `micro-payout-accumulator.ts` (~140 LOC): Sub-cent aggregation and payout threshold checker.
    - `payout-ledger-sync.ts` (~135 LOC): D1 ledger synchronization and commission records.
    - `index.ts` (~25 LOC): Barrel export.

14. **`src/tree/sso/enterprise-sso-service.ts`** (526 LOC → `src/tree/sso/service/` + root facade):
    - `types.ts` (~75 LOC): SAML 2.0 / OIDC connection configs, IdP metadata, user attribute mappings.
    - `saml-parser.ts` (~155 LOC): XML response parsing, signature validation, and assertion extraction.
    - `oidc-authenticator.ts` (~145 LOC): OAuth2 / OpenID Connect token exchange and JWT verification.
    - `jit-provisioner.ts` (~130 LOC): Just-In-Time user provisioning and enterprise role mapping.
    - `index.ts` (~25 LOC): Barrel export.

---

## 3. Implementation Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Circular Dependencies** | High | Strict adherence to `seed` -> `tree` -> `forest` -> `land`. Zero upward/cross-layer imports. Verified via `scripts/check-layer-boundaries.sh`. |
| **i18n Key Failures** | Medium | Use `// i18n-namespace: <ns>` comments at the top of decomposed UI subcomponents to preserve namespace context. |
| **Crypto Signature Regressions** | High | C2PA and SAML verification tests (`enterprise-sso.test.ts`, `enterprise-sso.adversarial.test.ts`) executed before and after refactoring. |
| **Breaking Public APIs** | High | 100% backward compatibility maintained via root facade files re-exporting all submodules. |

---

## 4. Quality Gates & Validation Criteria

- **File LOC**: 100% of created and modified files strictly `< 200 LOC`.
- **TypeScript**: `npm run type-check` with 0 errors.
- **ESLint**: `npm run lint` with 0 errors.
- **Layer Boundaries**: `bash scripts/check-layer-boundaries.sh` with 0 violations.
- **i18n Validation**: `npm run i18n:validate` with 0 missing keys.
- **Test Suites**: All existing unit and integration tests passing (`npm test`).
