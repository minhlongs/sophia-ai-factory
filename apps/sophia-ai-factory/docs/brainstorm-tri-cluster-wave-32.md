# Wave 32 Tri-Cluster Deep Modularization & Architecture Refactor Brainstorm

## Problem Statement
Following the successful completion of Wave 31 (17,241 green tests, 0 type/lint errors), the production codebase retains 132 files exceeding the `< 200 LOC` threshold. These monoliths concentrate multiple concerns into single files, heighten context dilution for autonomous coding pipelines, and introduce regression risks in serverless edge execution paths.

Wave 32 targets 15 mission-critical production monoliths (~3,445 LOC total, 222L–233L) across 3 parallel architectural clusters:
1. **Cluster 1: Edge & Webhook Engine** (SLO alerts, dynamic graphs, workflow stepper, affiliate postbacks, OAuth callbacks)
2. **Cluster 2: Frontend Views & Client Configurators** (White-label branding, license management, IP graph tables, mission progress bars, tier migration client)
3. **Cluster 3: Core Domain Services & Repositories** (Tier change provisioning, batch jobs D1 repo, production graph validation, refund repo, AI cost arbitrage fallback)

---

## Architectural Invariants
- **File Budget**: Strictly `< 200 LOC` per file across all newly created submodules.
- **Root Facades**: Original monolith paths preserved as lightweight facades (`< 25 LOC`), re-exporting from submodules to maintain 100% backward compatibility for all callers and static test suites.
- **Layer Boundary Enforcement**: Strict compliance with 4-layer architecture (`seed` → `tree` → `forest` → `land`). Zero illegal imports.
- **TypeScript & Lint Hygiene**: Zero `:any` types in production; zero `console.log` statements (using `@/seed/utils/logger-utility`); zero new ESLint suppressions.
- **Quality Gates**:
  1. `npm run type-check` (0 errors)
  2. `npm run lint -- --quiet` (0 errors)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (0 missing keys)
  5. `npm test` (100% green test suite)

---

## Target Decomposition Matrix (15 Monoliths ~ 3,445 LOC)

### Cluster 1: Edge & Webhook Engine (5 targets ~ 1,145 LOC)
1. **`src/app/api/cron/slo-burn-rate/route.ts` (233L)** → `src/app/api/cron/slo-burn-rate/core/`
   - `types.ts` (<50L): SLO threshold parameters, burn rate window options, alert event contracts.
   - `metrics-evaluator.ts` (<130L): Error budget consumption rate calculations and threshold breach evaluation.
   - `alert-dispatcher.ts` (<120L): Multi-channel alert dispatching (Telegram, Ops webhooks) with throttling.
   - `cron-handler.ts` (<130L): Edge runtime request verification (`CRON_SECRET`) and main execution coordinator.
   - `index.ts` (<20L) + Root Route Facade `route.ts` (<25L).

2. **`src/app/api/graphs/[type]/route.ts` (232L)** → `src/app/api/graphs/[type]/core/`
   - `types.ts` (<50L): Graph request types, node/edge schema definitions, rendering options.
   - `node-assembler.ts` (<130L): Extracts and normalizes graph nodes and topology relationships from D1.
   - `graph-renderer.ts` (<130L): Formats graph visualization outputs (DOT, SVG, JSON-LD) based on requested type.
   - `route-handler.ts` (<130L): Route handler validating graph type parameters and caching headers.
   - `index.ts` (<20L) + Root Route Facade `route.ts` (<25L).

3. **`src/app/api/cron/workflow-stepper/route.ts` (228L)** → `src/app/api/cron/workflow-stepper/core/`
   - `types.ts` (<50L): Stepper configuration, batch size limits, checkpoint result types.
   - `step-evaluator.ts` (<120L): Scans D1 for pending state machine transitions and expired timeouts.
   - `checkpoint-advancer.ts` (<130L): Atomically executes next step logic and updates step attempt counters.
   - `cron-handler.ts` (<120L): Handles cron authorization and batch iteration loops.
   - `index.ts` (<20L) + Root Route Facade `route.ts` (<25L).

4. **`src/app/api/postback/[network]/route.ts` (226L)** → `src/app/api/postback/[network]/core/`
   - `types.ts` (<50L): Network-specific query payloads (ClickBank, Awin, Impact, CJ) and conversion schemas.
   - `network-parsers.ts` (<130L): Decodes and validates signature tokens and network-specific tracking params.
   - `conversion-recorder.ts` (<130L): Records verified conversions in D1 affiliate ledger with idempotency checks.
   - `route-handler.ts` (<120L): Dynamic network route handler managing HTTP responses and audit logging.
   - `index.ts` (<20L) + Root Route Facade `route.ts` (<25L).

5. **`src/app/api/oauth/instagram/callback/route.ts` (226L)** → `src/app/api/oauth/instagram/callback/core/`
   - `types.ts` (<50L): OAuth state schemas, token response payloads, Instagram profile types.
   - `token-client.ts` (<120L): Short-to-long-lived token exchange with Meta Graph API.
   - `account-binder.ts` (<130L): Securely stores encrypted credentials and maps Instagram creator accounts in D1.
   - `route-handler.ts` (<120L): GET route handler validating CSRF state tokens and redirection flow.
   - `index.ts` (<20L) + Root Route Facade `route.ts` (<25L).

---

### Cluster 2: Frontend Views & Client Configurators (5 targets ~ 1,146 LOC)
6. **`src/app/[locale]/(app)/settings/white-label/page.tsx` (228L)** → `src/app/[locale]/(app)/settings/white-label/components/`
   - `types.ts` (<50L): White-label config DTO, domain validation state, logo upload props.
   - `domain-settings.tsx` (<130L): CNAME configuration, SSL certificate status, and DNS verify button.
   - `branding-form.tsx` (<140L): Custom logo upload, primary/accent color pickers, and preview card.
   - `white-label-view.tsx` (<150L): Main orchestrating view component with form state management.
   - `index.ts` (<20L) + Root Page Facade `page.tsx` (<20L).

7. **`src/forest/components/dashboard/licenses-client.tsx` (227L)** → `src/forest/components/dashboard/licenses/`
   - `types.ts` (<50L): License seat summary, member allocations, invite state interfaces.
   - `seat-summary.tsx` (<120L): Visual seat consumption meter and enterprise quota warnings.
   - `assign-seat-modal.tsx` (<140L): Dialog modal for assigning licenses to workspace members.
   - `licenses-view.tsx` (<150L): Client view container orchestrating queries and mutations.
   - `index.ts` (<20L) + Root Facade `licenses-client.tsx` (<20L).

8. **`src/components/stitch/screens/ip/ip-graph-table.tsx` (224L)** → `src/components/stitch/screens/ip/table/`
   - `types.ts` (<50L): IP asset rows, royalty breakdown, sorting/filtering contracts.
   - `table-row.tsx` (<130L): Individual IP item row with royalty split badges and media thumb.
   - `table-filters.tsx` (<110L): Search bar, category filters, and status dropdowns.
   - `ip-graph-table-view.tsx` (<150L): Main data table component with pagination controls.
   - `index.ts` (<20L) + Root Facade `ip-graph-table.tsx` (<20L).

9. **`src/components/missions/mission-progress-bar.tsx` (222L)** → `src/components/missions/progress/`
   - `types.ts` (<50L): Mission stage definitions, progress percent calculations, retry event handlers.
   - `progress-stage.tsx` (<120L): Individual stage milestone node (Script → Voice → Render → Publish).
   - `status-indicator.tsx` (<110L): Animated pulse indicators, error banners, and retry triggers.
   - `progress-bar-view.tsx` (<140L): Combined reactive progress bar container.
   - `index.ts` (<20L) + Root Facade `mission-progress-bar.tsx` (<20L).

10. **`src/components/billing/change-tier-client.tsx` (222L)** → `src/components/billing/change-tier/`
    - `types.ts` (<50L): Tier delta details, proration calculations, payment method confirmation props.
    - `tier-comparison.tsx` (<130L): Current vs target tier feature matrix and quota delta cards.
    - `proration-breakdown.tsx` (<120L): Immediate charge/credit calculation display with discount codes.
    - `change-tier-view.tsx` (<150L): Main client modal view orchestrating Server Actions.
    - `index.ts` (<20L) + Root Facade `change-tier-client.tsx` (<20L).

---

### Cluster 3: Core Domain Services & Repositories (5 targets ~ 1,154 LOC)
11. **`src/land/billing/tier-change-provisioner.ts` (227L)** → `src/land/billing/provisioner/`
    - `types.ts` (<50L): Provisioning request params, entitlement update types, result schemas.
    - `entitlement-sync.ts` (<130L): Recalculates workspace feature gates and video quota caps.
    - `quota-manager.ts` (<120L): Resets MCU quotas and prorates current billing period allocations.
    - `tier-provisioner.ts` (<140L): Executes D1 transaction updates and emits audit log events.
    - `index.ts` (<20L) + Root Facade `tier-change-provisioner.ts` (<20L).

12. **`src/seed/db/repositories/batch-jobs-repo.ts` (226L)** → `src/seed/db/repositories/batch-jobs/`
    - `types.ts` (<50L): Batch job entities, query filter schemas, update DTOs.
    - `job-queries.ts` (<130L): D1 query builders for fetching pending, active, and completed batch jobs.
    - `job-mutations.ts` (<130L): D1 insertion, progress incrementation, and failure status writes.
    - `batch-repo.ts` (<120L): Repository class exposing unified CRUD interface.
    - `index.ts` (<20L) + Root Facade `batch-jobs-repo.ts` (<20L).

13. **`src/tree/production-graph/validate.ts` (225L)** → `src/tree/production-graph/validation/`
    - `types.ts` (<50L): Graph validation errors, rule definitions, node validation contexts.
    - `cycle-detector.ts` (<120L): Tarjan/DFS topological cycle detection algorithm for graph pipelines.
    - `schema-validator.ts` (<130L): Validates node parameter schemas and input/output edge compatibility.
    - `graph-validator.ts` (<130L): High-level validation engine aggregating structural checks.
    - `index.ts` (<20L) + Root Facade `validate.ts` (<20L).

14. **`src/land/refunds/refund-repo.ts` (225L)** → `src/land/refunds/repo/`
    - `types.ts` (<50L): Refund request models, dispute status enums, financial audit records.
    - `refund-queries.ts` (<120L): Reads refund history and checks transaction dispute eligibility.
    - `clawback-handler.ts` (<130L): Manages credit revocation and affiliate commission clawbacks.
    - `refund-repository.ts` (<130L): D1 repository orchestrator managing atomic refund ledger writes.
    - `index.ts` (<20L) + Root Facade `refund-repo.ts` (<20L).

15. **`src/tree/ai/cost-arbitrage-fallback.ts` (224L)** → `src/tree/ai/arbitrage/`
    - `types.ts` (<50L): AI provider cost models, latency metrics, fallback chain configurations.
    - `cost-calculator.ts` (<120L): Token pricing arithmetic and cost-per-minute estimation models.
    - `fallback-chain.ts` (<130L): Circuit breaker aware provider selection and ranking algorithm.
    - `arbitrage-engine.ts` (<130L): Main execution orchestrator handling dispatch with transparent failover.
    - `index.ts` (<20L) + Root Facade `cost-arbitrage-fallback.ts` (<20L).

---

## Risk Assessment & Mitigation
- **Risk 1: Route Handlers and Next.js App Router Edge Runtime Bindings**
  - *Risk*: Modularizing edge route files could accidentally break exported HTTP method handlers (`GET`, `POST`) or middleware header bindings.
  - *Mitigation*: Root route files (`route.ts`) remain the official Next.js App Router entry points, acting as thin facades delegating directly to `core/route-handler.ts`.
- **Risk 2: Client Component Boundary Directives (`'use client'`)**
  - *Risk*: Slicing client UI screens into subcomponents could omit `'use client'` on subcomponents using React hooks.
  - *Mitigation*: Ensure every subcomponent using hooks explicitly includes `'use client'` at line 1.
- **Risk 3: Clean Architecture Boundary Violations**
  - *Risk*: Decomposing across `seed`, `tree`, `forest`, and `land` might induce illegal downward or cross-layer imports.
  - *Mitigation*: Validate imports with `scripts/check-layer-boundaries.sh` after every phase.
