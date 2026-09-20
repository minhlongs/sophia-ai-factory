# Project: Sophia AI Factory — Autonomous Growth & Revenue Engine ($1M MRR Path)

## Architecture
Sophia AI Factory is a Cloudflare Workers-native AI creative studio and autonomous revenue engine designed to scale to $1,000,000 MRR (5,000 paying customers at $200 ARPU).
The system strictly enforces the canonical 4-layer dependency model:
- `seed`: Pure types, database schemas, cryptographic primitives, capability models, and auth clients (`@/seed/*`).
- `tree`: Pure domain logic, trend forecasting math, hook scoring, royalty calculations, edge health state machines, and crypto wrappers (`@/tree/*`).
- `forest`: Asynchronous orchestration, Inngest jobs, swarm coordination, campaign generation, payout batchers, and hybrid routing coordinators (`@/forest/*`).
- `land`: User interfaces, Next.js Server Actions, edge route handlers, network adapters, and external API clients (`@/land/*`, `app/*`).

### Core Subsystems:
1. **Hermes Intelligence V2 & Viral Loop Swarm (R1)**:
   Autonomous growth swarm coordinating trend discovery across TikTok, YouTube Shorts, and X. Uses 7-day sliding window z-scores, seasonal/audience multipliers, and Single Exponential Smoothing (SES, $\alpha=0.40$). Evaluates viral hook effectiveness across 6 canonical hook styles. Continuous viral feedback loop recalculates Creative Effectiveness Scores (CES) and updates `playbook_patterns` using OCC CAS concurrency.
2. **Creator Marketplace & Video Blueprint Ecosystem (R2)**:
   Community marketplace interface (`/marketplace`, `/vi/marketplace`) with faceted search by niche, platform, and conversion rate. One-click blueprint cloning into Creative Studio (`/dashboard/missions/new?blueprintId=...`) with pre-flight MCU/USD cost calculation. Immutable creator royalty attribution engine tracking derivative lineage and recording earnings in `creator_earnings_ledger`.
3. **Multi-Network Affiliate Commission & Automated USDT Payouts (R3)**:
   Webhook ingestion for 5 major affiliate networks (TikTok Shop, Amazon Associates, ClickBank, AccessTrade, Awin) with Web Crypto timing-safe HMAC verification and sub-ID click attribution. Automated 14-day anti-fraud clawback hold (`payable_at = attributed_at + 14 * 86400`). Dual-entry accounting ledger reconciling commissions, clawbacks (negative adjustment rows), and net creator earnings. Sunday payout batch processor executing NOWPayments USDT TRC20 mass payouts with OCC CAS row claiming and rate limiting.
4. **Mekong AI Hybrid Edge Node Synchronization (R4)**:
   Secure Cloudflare Tunnel connection (`*.cashclaw.cc`) linking Cloudflare Workers to local `mekongd` daemons on Apple Silicon (M1 Max / Ollama / vLLM). Hybrid routing policy directs heavy LLM and TTS tasks to local zero-cost hardware (`CostKind: 'unmetered'`) with transparent failover to cloud BYOK on unreachability. Active pre-flight probe detects offline transitions within <15 seconds.
5. **Layer Discipline & CF-Direct Live Deployment (R5)**:
   Strict 4-layer import boundaries (`seed` → `tree` → `forest` → `land`, 0 violations via `check-layer-boundaries.sh`), 0 TypeScript errors, 100% test pass rate, live edge SHA match at `/api/version`, and 11/11 Sophia Doctor green score.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Cross-Channel Trend Scouting | Automated trend & hashtag scouting across TikTok, YouTube Shorts, and X | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Mathematical Hook Scoring Engine | Z-score velocity & momentum calculation, SES forecasting ($\alpha=0.40$), and 6-style hook scoring | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Autonomous Daily Campaign Generator | Translates high-confidence winning patterns into multi-track video campaign blueprints | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Closed-Loop Viral Feedback Ingestion | Ingests view count, shares, and watch time to update pattern scores via OCC CAS | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Hermes V2 Capability Model & Provider | Certified text/creative intelligence adapter adhering to `provider-certification.ts` | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Bilingual Marketplace Discovery Interface | Public `/marketplace` and `/vi/marketplace` with filters by niche, platform, and conversion rate | M2 | ORIGINAL_REQUEST §R2 |
| 7 | One-Click Studio Blueprint Cloning | Direct cloning into Creative Studio (`/dashboard/missions/new?blueprintId=...`) with pre-flight cost estimation | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Blueprint Lineage & Remix Tracker | Records derivative relationships, remix counts, and parent provenance in `blueprint_remixes` | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Creator Royalty Attribution Engine | Calculates creator revenue splits and maintains an immutable earnings ledger | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Marketplace & Blueprint D1 Migrations | Migration `0275` adding marketplace metadata to `campaign_blueprints` and creating royalty tables | M2 | Survey 2 |
| 11 | Multi-Network Webhook Ingestion | Webhooks for TikTok Shop, Amazon, ClickBank, AccessTrade, and Awin with HMAC verification | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Inngest Event Ingestion Bridge | Emits `conversion.created` from webhook routes into Inngest processing pipeline | M3 | Survey 3 |
| 13 | 14-Day Anti-Fraud Clawback Hold | Enforces 14-day hold (`payable_at = attributed_at + 14 * 86400`) and daily promotion cron | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Dual-Entry Accounting Ledger | Reconciles commissions, negative-adjustment clawbacks, and net creator earnings | M3 | ORIGINAL_REQUEST §R3 |
| 15 | NOWPayments USDT Mass Payout Processor | Sunday batch processor executing USDT TRC20 payouts with OCC CAS and rate limiting | M3 | ORIGINAL_REQUEST §R3 |
| 16 | Daily Financial Reconciliation Job | Reconciles confirmed payout batches against claimed ledger rows, alerting on diffs > $1.00 | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Mekong Cloudflare Tunnel Communication | Secure tunnel connection to local `mekongd` with Bearer auth and AES-256-GCM encryption | M4 | ORIGINAL_REQUEST §R4 |
| 18 | Hybrid Task Routing Policy | Directs heavy LLM/TTS to local zero-cost hardware (`unmetered`) with transparent cloud BYOK fallback | M4 | ORIGINAL_REQUEST §R4 |
| 19 | 15-Second Node Health Monitor | Active pre-flight probe and 1-token heartbeat detecting offline transitions within <15s | M4 | ORIGINAL_REQUEST §R4 |
| 20 | Edge Nodes D1 State Management | D1 tables `edge_nodes` and `edge_node_heartbeats` for cluster status tracking | M4 | Survey 2 |
| 21 | Opaque-Box E2E Test Suite (Tiers 1-4) | Comprehensive requirement-driven test suite with >=11xN test cases derived from user specs | E2E Track | Dual Track |
| 22 | Adversarial Coverage Hardening (Tier 5) | White-box adversarial stress testing with Challenger-Worker-Reviewer loop | M5 | Dual Track |
| 23 | 4-Layer Architecture Enforcement | Strict zero-violation check via `scripts/check-layer-boundaries.sh` | M5 | ORIGINAL_REQUEST §R5 |
| 24 | TypeScript Zero-Error Gate | Zero compilation errors across all modules (`npm run type-check`) | M5 | ORIGINAL_REQUEST §R5 |
| 25 | CF-Direct Production Deployment | Live deployment via CF-direct doctrine with commit SHA verification at `/api/version` | M5 | ORIGINAL_REQUEST §R5 |
| 26 | Sophia Doctor 11/11 Green Certification | Full health certification via `node scripts/sophia-doctor.mjs` | M5 | ORIGINAL_REQUEST §R5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track Orchestrator | Opaque-box test harness, test runner, Tiers 1-4 tests (Features, Boundaries, Pairwise, Real-World), publishes `TEST_READY.md` | None | DONE |
| 1 | M1: Hermes Intelligence V2 — Autonomous AI Marketing Swarm & Viral Loop | Trend scouting across TikTok/Shorts/X, hook scoring math, daily campaign generator, closed-loop viral feedback with OCC CAS | None | DONE |
| 2 | M2: Creator Marketplace & Video Blueprint Ecosystem | Bilingual discovery UI, one-click studio cloning with cost estimation, royalty attribution engine, D1 migrations for blueprints & remixes | M1 | DONE |
| 3 | M3: Multi-Network Affiliate Commission & Automated USDT Payouts Engine | 5-network webhooks with HMAC, Inngest event bridge, 14-day hold, dual-entry accounting ledger, NOWPayments USDT batch processor, daily reconciliation | M2 | DONE |
| 4 | M4: Mekong AI Hybrid Edge Node Synchronization | Cloudflare Tunnel communication to `mekongd`, hybrid routing policy with cloud BYOK fallback, 15s offline transition detector, edge nodes schema | None | DONE |
| 5 | M5: Final Milestone: E2E Test Pass, Layer Discipline & Live Edge Deploy | Phase 1 (100% E2E test pass Tiers 1-4), Phase 2 (Adversarial hardening Tier 5), layer boundary check, CF-direct deploy, live SHA match, Sophia Doctor 11/11 GREEN | M1, M2, M3, M4, E2E | DONE |

---

## Interface Contracts

### 1. Hermes V2 & Swarm Intelligence
- **Trend Discovery**:
  `scoutTrendingSignals(platform: 'tiktok' | 'youtube_shorts' | 'x', query: string, db: D1Database): Promise<TrendingSignal[]>`
- **Hook Scoring**:
  `calculateHookScore(input: HookEvaluationInput): HookScoreResult`
  Formula: $S_{\text{viral}} = 0.40S_{\text{hook}} + 0.25S_{\text{pacing}} + 0.20S_{\text{retention}} + 0.15S_{\text{cta}}$
- **Campaign Generator**:
  `generateDailyCampaignBlueprints(db: D1Database, minConfidence?: number): Promise<CampaignBlueprint[]>`
- **Feedback Ingestion**:
  `ingestEngagementFeedback(db: D1Database, feedback: VideoEngagementFeedback): Promise<PatternUpdateResult>`
  Updates `playbook_patterns` via OCC CAS: `UPDATE playbook_patterns SET score = ?, sample_count = sample_count + 1, updated_at = ? WHERE id = ? AND updated_at = ?`

### 2. Creator Marketplace & Blueprints
- **Marketplace Listing Service**:
  `listMarketplaceBlueprints(db: D1Database, filters: MarketplaceFilters): Promise<PaginatedBlueprints>`
- **Clone / Remix Action**:
  `cloneBlueprintForMission(db: D1Database, blueprintId: string, userId: string, tenantId: string): Promise<CloneBlueprintResult>`
- **Royalty Attribution Engine**:
  `recordBlueprintRemixAndAccrueRoyalty(db: D1Database, remix: BlueprintRemixInput): Promise<RoyaltyAccrualResult>`
  Inserts into `blueprint_remixes` and `creator_earnings_ledger` with OCC CAS idempotency.

### 3. Affiliate Ingestion & Mass Payouts
- **HMAC Verification**:
  `verifyAffiliateHmac(rawBody: string, signature: string, secret: string, algorithm: 'SHA-256' | 'SHA-1' | 'SHA-512'): Promise<boolean>`
- **Hold Promotion**:
  `flipPendingToPayable(db: D1Database, nowTimestamp: number): Promise<number>`
  Updates `commission_ledger SET status = 'payable' WHERE status = 'pending' AND payable_at <= nowTimestamp`
- **Payout Batcher**:
  `processPayoutBatch(db: D1Database, rail: 'nowpayments_usdt' | 'stripe_connect'): Promise<PayoutBatchResult>`
  Claims rows via CAS: `UPDATE commission_ledger SET status = 'paying', payout_batch_id = ? WHERE status = 'payable' AND payout_batch_id IS NULL`
- **Clawback Negative-Row Invariant**:
  `recordClawbackAdjustment(db: D1Database, parentConversionId: string, reason: string): Promise<LedgerAdjustmentResult>`
  Inserts negative `commission_cents` row with `status = 'clawback'`, never mutating historical records.

### 4. Mekong AI Hybrid Edge Node Protocol
- **Health Check & Pre-Flight Probe**:
  `probeEdgeNode(nodeUrl: string, bearerToken: string, timeoutMs?: number): Promise<NodeHealthStatus>`
  Timeout: `AbortSignal.timeout(2500)`. Transition to offline if unresponsive.
- **Hybrid Router**:
  `routeInferenceTask(task: InferenceTask, preferredNodeId?: string): Promise<InferenceResult>`
  Routes to local `mekongd` if status is `ONLINE`. Falls back transparently to cloud BYOK (`OpenRouter` / `Anthropic` / `ElevenLabs`) if offline or on error.

---

## Code Layout

```
apps/sophia-ai-factory/
├── migrations/
│   └── 0275_autonomous_growth_and_revenue.sql           # D1 schema for blueprints, royalties, remixes, edge nodes
├── src/
│   ├── seed/
│   │   ├── types/creative-intelligence.ts               # Hermes V2 contracts & Zod schemas
│   │   ├── ai/provider-certification.ts                 # Certified provider states
│   │   └── db/schema/growth-engine.ts                   # D1 table definitions
│   ├── tree/
│   │   ├── trend-intelligence/                          # Hook scoring, velocity/momentum z-score math, SES forecast
│   │   ├── learning-loop/scoring-cas.ts                 # OCC CAS scoring on patterns
│   │   ├── creator-royalties/attribution.ts             # Royalty attribution math & lineage tracking
│   │   ├── affiliates/crypto.ts                         # Web Crypto timing-safe HMAC verifiers
│   │   └── edge/node-health.ts                          # 15s offline transition state machine
│   ├── forest/
│   │   ├── playbook/campaign-generator.ts               # Autonomous daily campaign generator
│   │   ├── jobs/viral-feedback-loop.ts                  # Closed-loop engagement feedback sync
│   │   ├── marketplace/blueprint-service.ts             # Marketplace search, filtering, cloning
│   │   ├── jobs/payout-batcher.ts                       # Sunday USDT mass payout batch processor
│   │   ├── jobs/reconciliation.ts                       # Daily financial reconciliation job
│   │   └── ai/hybrid-router.ts                          # Hybrid edge vs cloud BYOK router
│   ├── land/
│   │   ├── marketplace/                                 # Bilingual marketplace discovery UI
│   │   ├── missions/cost-estimator.ts                   # Preflight studio cost estimator
│   │   ├── payouts/nowpayments-mass-payout.ts           # NOWPayments USDT TRC20 client
│   │   ├── payouts/clawback-handler.ts                  # Negative-row clawbacks
│   │   └── edge/node-registration.ts                    # Edge node registration endpoints
│   └── app/
│       ├── [locale]/(marketing)/marketplace/page.tsx   # Public /marketplace and /vi/marketplace
│       └── api/webhooks/                                # 5 network webhook routes + NOWPayments IPN
└── tests/
    └── e2e/growth-engine/                               # Opaque-box E2E test suite (Tiers 1-4)
```

---

## Verification Commands
- Check layer boundaries: `bash scripts/check-layer-boundaries.sh`
- TypeScript typecheck: `npm run type-check`
- Unit/Integration tests: `npm test`
- E2E test suite: `npx vitest run tests/e2e/growth-engine/`
- Sophia Doctor: `node scripts/sophia-doctor.mjs`
- CF-direct deploy: `npm run deploy:full`
- Live SHA match:
  ```bash
  curl -s https://sophia.agencyos.network/api/version | jq .shortSha
  git rev-parse HEAD | cut -c1-8
  ```
