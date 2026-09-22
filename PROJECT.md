# Project: Sophia AI Factory — Autonomous Scale & Agency Multi-Tenancy Engine ($10K–$25K MRR, 50–125 Clients)

## Architecture
- Layer discipline: Canonical 4-layer hierarchy (`seed` → `tree` → `forest` → `land`).
  - `seed`: Data contracts, domain types, crypto helpers, design tokens, error models.
    - `src/seed/types/retention-types.ts` (Customer Health Score models & intervention types)
    - `src/seed/types/agency-multitenancy.ts` (Subaccount, branding, MCU allocation & review token models)
    - `src/seed/types/affiliate-expansion-types.ts` (Tier progression, leaderboard & dual-rail payout models)
    - `src/seed/types/unit-economics-types.ts` (Unit economics, provider arbitrage & margin models)
    - `src/seed/security/review-token.ts` (CSPRNG 256-bit token & SHA-256 hash generator)
  - `tree`: Pure domain services, repositories, algorithms, circuit breakers, notification engines.
    - `src/tree/organizations/subaccount-repo.ts` (Subaccount CRUD, domain resolution, custom branding)
    - `src/tree/organizations/mcu-allocation-engine.ts` (Subaccount quota budgeting & deduction guards)
    - `src/tree/organizations/review-service.ts` (Video review token generation, verification & state management)
    - `src/tree/ai/multimodal-cost-router.ts` (Per-second cost comparison across OpenRouter, fal.ai, ElevenLabs, Mekong GPU)
    - `src/tree/ai/cost-arbitrage-fallback.ts` (Circuit breaker integration & automated failover)
  - `forest`: Interactive UI presentation components, review portals, dashboards.
    - `src/forest/growth/customer-health-monitor.tsx` (Health score cards & 1-click founder action modal)
    - `src/forest/agency/client-video-review-portal.tsx` (Bilingual tokenized review player, feedback & approval)
    - `src/forest/affiliates/affiliate-leaderboard-view.tsx` (Top 10 leaderboard, badges, prize pool)
    - `src/forest/economics/unit-economics-dashboard.tsx` (Gross Margin %, COGS per video, LTV:CAC dashboard)
  - `land`: Business aggregation services, cron orchestrators, payment & payout engines.
    - `src/land/growth/customer-retention-service.ts` (4-factor health score 0-100 algorithm, win-back dispatcher)
    - `src/land/affiliates/tier-progression-engine.ts` (Silver 20%, Gold 25%, Platinum 30% MRR engine)
    - `src/land/affiliates/leaderboard-service.ts` (Leaderboard aggregation & prize allocation)
    - `src/land/payouts/dual-rail-payout-engine.ts` (NOWPayments USDT mass payout + VietQR banking export)
    - `src/land/economics/unit-economics-service.ts` (Gross Margin, COGS per video, LTV:CAC aggregator)
  - `app`: Next.js 16 localized App Router pages and API routes:
    - `src/app/[locale]/client-review/[token]/page.tsx` (Interactive Client Review Portal)
    - `src/app/[locale]/affiliate/leaderboard/page.tsx` (Public bilingual Affiliate Leaderboard)
    - `src/app/(app)/admin/unit-economics/page.tsx` & `src/app/[locale]/(admin)/admin/unit-economics/page.tsx`
    - `src/app/api/cron/anti-churn-guardian/route.ts` (Automated win-back cron check)
    - `src/app/api/admin/customer-intervention/route.ts` (1-click credit grant / direct outreach)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Customer Health Score Algorithm (0-100) | 4-factor scoring (recency, velocity, capacity, reliability) from D1 | M1 | Survey R1 |
| 2 | Automated Win-Back Triggers (Resend & Telegram) | Auto-trigger email and Telegram notification when Health Score < 40 | M1 | Survey R1 |
| 3 | Growth Analytics Health Monitor & 1-Click Founder Action | Client health table & 1-click bonus credit / support action in `/admin/growth-analytics` | M1 | Survey R1 |
| 4 | Client Sub-Accounts D1 Schema & Migration | Migration `0286_agency_multitenancy_subaccounts.sql` for subaccounts, branding, MCU pools, reviews | M2 | Survey R2 |
| 5 | Agency Sub-Account Repository & Brand Customization | Subaccount CRUD, custom logo, color palette, custom domain mapping | M2 | Survey R2 |
| 6 | Sub-Account MCU Quota Allocation & Enforcement | Independent MCU quota allocation per client subaccount with guard checks | M2 | Survey R2 |
| 7 | Agency Multi-Tenancy RBAC Hierarchy | Subaccount-scoped RBAC: Agency Owner, Video Editor, Client Reviewer | M2 | Survey R2 |
| 8 | Interactive Client Video Review Portal | Bilingual `/client-review/[token]` portal for preview, feedback, approval & auto-publish hook | M2 | Survey R2 |
| 9 | Affiliate Tier Progression Engine | Auto-upgrade partner tiers: Silver (20%), Gold (25%), Platinum (30%) by activated MRR | M3 | Survey R3 |
| 10 | Public Bilingual Affiliate Leaderboard | `/affiliate/leaderboard` & `/vi/affiliate/leaderboard` with Top 10 rankings and bonus incentives | M3 | Survey R3 |
| 11 | VietQR Bank Format Export Engine | D1 migration `0285_affiliate_vietqr_payout_rail.sql` + NAPAS 247 banking batch CSV generator | M3 | Survey R3 |
| 12 | NOWPayments Automated Mass-Payout Bridge | Automated TRC-20 USDT payout verification and execution without duplicate disbursement | M3 | Survey R3 |
| 13 | Multimodal Cost-Arbitrage Router | Per-second cost optimizer across OpenRouter, fal.ai, ElevenLabs, Mekong GPU | M4 | Survey R4 |
| 14 | Automatic Fallback & Circuit Breaker Engine | Circuit breaker failover to secondary provider on error or latency threshold | M4 | Survey R4 |
| 15 | Real-Time Unit Economics Dashboard | `/admin/unit-economics` & `/vi/admin/unit-economics` for Gross Margin %, COGS/video, LTV:CAC | M4 | Survey R4 |
| 16 | Clean 4-Layer Architecture Enforcement | 0 violations verified via `bash scripts/check-layer-boundaries.sh` | M5 | Survey R5 |
| 17 | TypeScript 0 Compile Errors | `npm run type-check` with 0 errors across entire workspace | M5 | Survey R5 |
| 18 | Unit & Integration Test Suites | Comprehensive Vitest suites covering R1, R2, R3, R4 with 100% pass rate | M5 | Survey R5 |
| 19 | Production Deployment Parity & Sophia Doctor 11/11 | Bit-for-bit SHA parity and Sophia Doctor `node scripts/sophia-doctor.mjs` 11/11 GREEN | M5 | Survey R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Client Retention & Anti-Churn AI Guardian (R1) | Health score algorithm, Resend/Telegram win-back triggers, admin health monitor & 1-click founder action | none | DONE |
| 2 | Self-Service Agency Workspace & Client Sub-Accounts (R2) | D1 schema, subaccounts, branding, MCU quota allocation, RBAC, interactive review portal | none | DONE |
| 3 | 2-Tier Master Affiliate Expansion & Dual-Rail Payouts (R3) | Tier progression (Silver/Gold/Platinum), bilingual leaderboard, NOWPayments USDT + VietQR bank export | none | DONE |
| 4 | Multi-Model Cost Arbitrage & Unit Economics Dashboard (R4) | Multimodal cost router, circuit breaker fallback, `/admin/unit-economics` dashboard | none | DONE |
| 5 | Layer Discipline, Comprehensive Testing & Doctor 11/11 (R5) | 4-layer check (0 violations), type-check (0 errors), 100% test pass rate, Sophia Doctor 11/11 GREEN | M1, M2, M3, M4 | DONE |

## Interface Contracts

### 1. Retention & Anti-Churn (R1)
```typescript
export interface CustomerHealthMetrics {
  userId: string;
  userEmail: string;
  userName?: string;
  recencyScore: number;    // 0 - 25 based on login days ago
  velocityScore: number;   // 0 - 25 based on video output rate
  capacityScore: number;   // 0 - 25 based on MCU balance & consumption
  reliabilityScore: number;// 0 - 25 based on render success rate
  totalHealthScore: number;// 0 - 100
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL_CHURN_RISK';
  lastActiveAt: string;
}

export interface WinBackTriggerResult {
  userId: string;
  emailSent: boolean;
  telegramNotified: boolean;
  timestamp: string;
}
```

### 2. Agency Multi-Tenancy & Review Portal (R2)
```typescript
export interface ClientSubaccount {
  id: string;
  agencyOrgId: string;
  name: string;
  slug: string;
  customDomain?: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  };
  mcuQuota: {
    allocated: number;
    used: number;
    remaining: number;
  };
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface VideoReviewPayload {
  token: string;
  subaccountId: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  feedbackComments?: Array<{
    timestampSec?: number;
    author: string;
    comment: string;
    createdAt: string;
  }>;
}
```

### 3. Affiliate Network & Dual-Rail Payouts (R3)
```typescript
export type AffiliateTier = 'SILVER' | 'GOLD' | 'PLATINUM';

export interface AffiliateTierConfig {
  tier: AffiliateTier;
  commissionRatePct: number; // 20%, 25%, 30%
  tier2RatePct: number;      // 5%
  minMrrUsd: number;         // 0, 1000, 5000
}

export interface PayoutBatchItem {
  affiliateId: string;
  partnerCode: string;
  amountUsd: number;
  rail: 'USDT' | 'VIETQR';
  usdtAddress?: string;
  bankDetails?: {
    bin: string;
    accountNumber: string;
    accountName: string;
    amountVnd: number;
  };
}
```

### 4. Cost Arbitrage & Unit Economics (R4)
```typescript
export interface UnitEconomicsMetrics {
  grossMarginPct: number;
  totalRevenueUsd: number;
  totalCogsUsd: number;
  cogsPerVideoUsd: number;
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  breakdownByProvider: Array<{
    provider: 'openrouter' | 'fal' | 'elevenlabs' | 'mekong';
    totalCostUsd: number;
    percentageOfTotal: number;
  }>;
}
```

## Code Layout
- `apps/sophia-ai-factory/src/seed/types/`: Domain models for retention, agency, affiliate, economics
- `apps/sophia-ai-factory/src/tree/organizations/`: Subaccount repo, MCU allocation, review service
- `apps/sophia-ai-factory/src/tree/ai/`: Multimodal cost-arbitrage router & fallback
- `apps/sophia-ai-factory/src/forest/growth/`: Customer health monitor component
- `apps/sophia-ai-factory/src/forest/agency/`: Client video review portal component
- `apps/sophia-ai-factory/src/forest/affiliates/`: Affiliate leaderboard view component
- `apps/sophia-ai-factory/src/forest/economics/`: Unit economics dashboard component
- `apps/sophia-ai-factory/src/land/growth/`: Customer retention service & win-back dispatcher
- `apps/sophia-ai-factory/src/land/affiliates/`: Tier progression engine & leaderboard service
- `apps/sophia-ai-factory/src/land/payouts/`: Dual-rail payout engine (USDT + VietQR)
- `apps/sophia-ai-factory/src/land/economics/`: Unit economics aggregation service
- `apps/sophia-ai-factory/src/app/[locale]/client-review/[token]/`: Review portal route
- `apps/sophia-ai-factory/src/app/[locale]/affiliate/leaderboard/`: Leaderboard route
- `apps/sophia-ai-factory/src/app/(app)/admin/unit-economics/`: Unit economics admin route
