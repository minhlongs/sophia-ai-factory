# Wave 30 Tri-Cluster Deep Modularization & Architecture Refactor Brainstorm

## Problem Statement
Following the successful completion of Wave 29, the production codebase retains monoliths exceeding the strict `< 200 LOC` threshold. These monoliths introduce cognitive complexity, increase risk in autonomous agent pipelines, and violate single-responsibility boundaries.

Wave 30 targets the next 15 mission-critical production monoliths (~3,780 LOC total, 247L–258L) across 3 parallel architectural clusters.

---

## Target Decomposition Matrix (15 Monoliths ~ 3,780 LOC)

### Cluster 1: Frontend Views, Analytics & SEO Schema Builders (5 targets ~ 1,260 LOC)
1. **`src/forest/components/analytics/license-utilization.tsx` (253L)** → `src/forest/components/analytics/license-utilization/`
   - `types.ts` (<60L): Seat metrics, license usage breakdown, tier caps.
   - `metric-cards.tsx` (<120L): Allocated seats, active users, utilization gauge.
   - `seat-allocation-table.tsx` (<140L): Per-department / per-seat assignment table.
   - `license-utilization-view.tsx` (<150L): Container view orchestrator (`'use client'`).
   - `index.ts` (<20L) + Facade `license-utilization.tsx` (<10L).
2. **`src/components/stitch/screens/affiliates/affiliates-page.tsx` (250L)** → `src/components/stitch/screens/affiliates/page/`
   - `types.ts` (<60L): Affiliate metrics, commission tier, referral links.
   - `stat-header.tsx` (<110L): Gross referral volume, unpaid earnings, conversion rates.
   - `payout-history-table.tsx` (<130L): Recent USDT / fiat commission payouts table.
   - `affiliates-page-view.tsx` (<150L): Main view component (`'use client'`).
   - `index.ts` (<20L) + Facade `affiliates-page.tsx` (<10L).
3. **`src/components/help/HelpPage.tsx` (248L)** → `src/components/help/page/`
   - `types.ts` (<50L): FAQ categories, search state, contact form props.
   - `faq-accordion.tsx` (<120L): Categorized collapsible FAQ items with bilingual text.
   - `support-contact-card.tsx` (<110L): Telegram bot & support ticket dispatch cards.
   - `help-page-view.tsx` (<150L): Main help desk layout (`'use client'`).
   - `index.ts` (<20L) + Facade `HelpPage.tsx` (<10L).
4. **`src/land/seo/solutions-schema-builder.ts` (252L)** → `src/land/seo/solutions/`
   - `types.ts` (<60L): JSON-LD Schema.org types for AI agency solutions.
   - `breadcrumb-schema.ts` (<100L): BreadcrumbList structured data builder.
   - `service-schema.ts` (<120L): SoftwareApplication & ProfessionalService schemas.
   - `schema-builder.ts` (<140L): Aggregator assembling bilingual LD+JSON payloads.
   - `index.ts` (<20L) + Facade `solutions-schema-builder.ts` (<10L).
5. **`src/forest/analytics/queries/revenue-attribution.ts` (257L)** → `src/forest/analytics/queries/attribution/`
   - `types.ts` (<60L): Attribution models, campaign channels, revenue splits.
   - `d1-attribution-queries.ts` (<130L): SQL queries for first-touch and last-touch D1 records.
   - `multi-touch-calculator.ts` (<140L): Linear and time-decay attribution weighting math.
   - `attribution-service.ts` (<140L): High-level query executor with cache integration.
   - `index.ts` (<20L) + Facade `revenue-attribution.ts` (<10L).

---

### Cluster 2: Video Processing, Webhooks, A/B Testing & Crons (5 targets ~ 1,271 LOC)
6. **`src/forest/ab/winner-picker.ts` (258L)** → `src/forest/ab/winner/`
   - `types.ts` (<60L): Experiment variants, conversion metrics, significance config.
   - `bayesian-calculator.ts` (<130L): Bayesian beta-binomial probability of being best.
   - `sample-size-gate.ts` (<110L): Minimum sample threshold & statistical power check.
   - `winner-picker-service.ts` (<140L): Variant selection & auto-promotion orchestrator.
   - `index.ts` (<20L) + Facade `winner-picker.ts` (<10L).
7. **`src/land/video/generation/assemblyai-client.ts` (255L)** → `src/land/video/generation/assemblyai/`
   - `types.ts` (<60L): Transcription options, subtitle format configs, polling options.
   - `audio-uploader.ts` (<110L): Binary stream uploader to AssemblyAI CDN.
   - `transcript-poller.ts` (<130L): Status poller with exponential backoff & timeout.
   - `assemblyai-client.ts` (<140L): Client facade orchestrating upload, poll, and WebVTT extraction.
   - `index.ts` (<20L) + Facade `assemblyai-client.ts` (<10L).
8. **`src/app/api/cron/error-digest/route.ts` (255L)** → `src/forest/crons/error-digest/`
   - `types.ts` (<50L): Error log aggregates, digest summary schema.
   - `error-collector.ts` (<120L): Queries D1/KV for unhandled errors past 24 hours.
   - `digest-formatter.ts` (<110L): Markdown & Telegram/Email alert body formatter.
   - `route-handler.ts` (<120L): Cron execution logic with CRON_SECRET verification.
   - `index.ts` (<20L) + Facade route `src/app/api/cron/error-digest/route.ts` (<25L).
9. **`src/app/api/oauth/pinterest/callback/route.ts` (250L)** → `src/land/oauth/pinterest/`
   - `types.ts` (<50L): Token exchange request/response, state payload.
   - `token-exchanger.ts` (<120L): OAuth code-for-token POST exchange with Pinterest API.
   - `account-persister.ts` (<120L): Securely writes encrypted token and scopes to D1.
   - `route-handler.ts` (<130L): Next.js Route GET handler managing CSRF state validation.
   - `index.ts` (<20L) + Facade route `src/app/api/oauth/pinterest/callback/route.ts` (<25L).
10. **`src/seed/db/node-sqlite-d1.ts` (253L)** → `src/seed/db/sqlite-d1/`
    - `types.ts` (<50L): SQLite statement interface, D1 compatibility shims.
    - `statement-executor.ts` (<130L): Prepared statement runner with parameter binding.
    - `batch-executor.ts` (<120L): Transactional batch query execution runner.
    - `sqlite-d1-adapter.ts` (<140L): Node SQLite adapter exposing Cloudflare D1 API.
    - `index.ts` (<20L) + Facade `node-sqlite-d1.ts` (<10L).

---

### Cluster 3: Domain Contracts, Swarm, Solvency & Affiliates (5 targets ~ 1,249 LOC)
11. **`src/tree/agents/repository.ts` (257L)** → `src/tree/agents/repo/`
    - `types.ts` (<60L): Agent entity, filter criteria, pagination parameters.
    - `agent-queries.ts` (<130L): Query builders for active agents, team tags, and status.
    - `agent-mutations.ts` (<130L): Insert, update, and soft-delete transactions.
    - `agent-repository.ts` (<140L): High-level repository class.
    - `index.ts` (<20L) + Facade `repository.ts` (<10L).
12. **`src/tree/contracts/contract-signature-verifier.ts` (253L)** → `src/tree/contracts/verifier/`
    - `types.ts` (<60L): Signature payload, EIP-712 / RSA verification types.
    - `crypto-verifier.ts` (<130L): Cryptographic hash & signature algorithm validator.
    - `certificate-chain.ts` (<110L): X.509 certificate expiry & validity checker.
    - `contract-signature-verifier.ts` (<140L): Verifier service handling contract sealing.
    - `index.ts` (<20L) + Facade `contract-signature-verifier.ts` (<10L).
13. **`src/land/affiliates/tier-progression-engine.ts` (252L)** → `src/land/affiliates/tier-progression/`
    - `types.ts` (<60L): Tier thresholds (Silver, Gold, Platinum, Diamond), bonus rates.
    - `tier-evaluator.ts` (<120L): Checks referral volumes & qualification criteria.
    - `reward-allocator.ts` (<120L): Calculates bonus commission bump & perk unlock.
    - `tier-progression-service.ts` (<140L): Evaluates progression & updates partner status in D1.
    - `index.ts` (<20L) + Facade `tier-progression-engine.ts` (<10L).
14. **`src/tree/swarm/sales-qualifier-bot.ts` (247L)** → `src/tree/swarm/sales-qualifier/`
    - `types.ts` (<60L): Lead qualification schema, BANT score, message context.
    - `bant-evaluator.ts` (<120L): Budget, Authority, Need, Timeline scoring model.
    - `dialogue-manager.ts` (<130L): Conversational turn prompt manager.
    - `sales-qualifier-bot.ts` (<140L): Autonomous qualifier bot coordinating qualification steps.
    - `index.ts` (<20L) + Facade `sales-qualifier-bot.ts` (<10L).
15. **`src/tree/reserve/basel-solvency-domain-engine.ts` (247L)** → `src/tree/reserve/basel-solvency/`
    - `types.ts` (<60L): Tier 1 capital, risk-weighted assets (RWA), liquidity ratios.
    - `rwa-calculator.ts` (<120L): Standardized credit & operational risk-weighted asset math.
    - `solvency-evaluator.ts` (<120L): Capital Adequacy Ratio (CAR) and LCR stress testing.
    - `basel-solvency-engine.ts` (<140L): Domain engine coordinating solvency audits.
    - `index.ts` (<20L) + Facade `basel-solvency-domain-engine.ts` (<10L).

---

## Architectural & Quality Invariants
1. **File Budget**: Every single sub-file strictly `< 200 LOC`.
2. **Backward Compatibility**: Facade at every original path re-exports (`export * from './<subfolder>/index';`).
3. **Clean Layers**: Strictly preserve `seed` → `tree` → `forest` → `land` isolation.
4. **TypeScript & Lint**: 0 `:any`, 0 raw `console.log`, 0 ESLint errors.
5. **Quality Gates**: `npm run type-check`, `npm run lint`, `scripts/check-layer-boundaries.sh`, and `npm test` (all 17,236+ tests green).
