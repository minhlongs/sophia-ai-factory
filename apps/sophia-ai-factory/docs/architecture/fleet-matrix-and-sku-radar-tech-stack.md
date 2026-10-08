# Multi-Account Fleet Matrix & Trending SKU Radar Tech Stack

## 1. Executive Summary
This architecture provides Sophia AI Factory with:
1. **Multi-Account Matrix & Synthetic Influencer Fleet Engine**:
   - Manages fleets of virtual social media accounts (TikTok, YouTube Shorts, Reels) across isolated session/proxy profiles.
   - Enforces staggered publish intervals (`min 20-45 mins` jitter) to evade platform rate limits & shadowban algorithms.
   - Aggregates multi-account revenue, views, CTR, and GMV commission in real time.
2. **Real-Time Trending SKU Radar & 1-Click Viral Campaign Generator**:
   - Scans and scores E-commerce products (TikTok Shop, Shopee, ClickBank) using a multi-factor **Velocity Score** algorithm ($V = \Delta\text{Sales} \times \text{CommissionMargin} \times \text{ConversionRate}$).
   - Generates 1-Click ready-to-scale campaigns: Hook angles, Bridge Page slug generation, and fleet distribution via Inngest.

---

## 2. Clean Architecture Layer Mapping

| Layer | Component | Path | Responsibility |
|---|---|---|---|
| **Seed** | Schema & Types | `src/seed/types/fleet-matrix-sku-radar-types.ts` | Zod schemas, TypeScript types, validation |
| **Seed** | Inngest Event Registry | `src/seed/inngest/event-types.ts` | Type definitions for fleet and radar events |
| **Tree** | Fleet Dispatcher | `src/tree/fleet/fleet-stagger-scheduler.ts` | Jitter calculation, daily quota enforcement, rotation |
| **Tree** | SKU Velocity Engine | `src/tree/radar/sku-velocity-calculator.ts` | Velocity scoring, tier classification (BREAKOUT/SURGING) |
| **Forest** | Fleet Deploy Job | `src/forest/inngest/functions/fleet-stagger-publish-job.ts` | Multi-step Inngest delayed distribution |
| **Forest** | SKU Campaign Job | `src/forest/inngest/functions/trending-sku-campaign-job.ts` | 1-Click campaign pipeline automation |
| **Land** | Server Actions | `src/land/fleet/actions/fleet-radar-actions.ts` | Authenticated client mutations (`getCurrentUser()`) |
| **Presentation** | Cockpit Cards | `src/components/fleet-matrix-radar/` | Responsive UI components |

---

## 3. Database Migration (`0458_fleet_matrix_and_sku_radar.sql`)
- Table: `fleet_creator_accounts` (Account credentials, proxy, daily quota, metrics)
- Table: `trending_sku_radar_items` (SKU velocity, category, commission, hook recommendations)
- Table: `fleet_campaign_deployments` (Deployed campaigns across the creator fleet)

---

## 4. Quality & Safety Gates
- 0 `:any` types.
- Synchronous D1 calls via `createServerClient()`.
- Zero-mock Vitest coverage on all algorithms.
