# Tech Stack Architecture — Autonomous E-Commerce Inngest, Affiliate Portal & Attribution Engine

**Date:** 2026-10-07  
**Scope:** E-Commerce Inngest Pipelines, Partner Portal UI, Closed-Loop Attribution  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router  

---

## 1. Core Technology Selection

| Domain | Technology | Justification & Architectural Role |
|---|---|---|
| **Edge Compute** | Cloudflare Workers (`@opennextjs/cloudflare`) | Sub-15ms cold start, serverless edge compute with 128MB isolate compliance. |
| **Relational Data** | Cloudflare D1 (SQLite) | Zero-latency co-located edge database with atomic batch queries (`d1.batch()`). |
| **Job Orchestration** | Inngest SDK v3.x | Durable background step execution, debounce, per-host throttling, and zero-loss retries. |
| **Authentication** | Better-Auth v1.6.2 | Session-isolated multi-tenant RBAC (`verifyWorkspaceAccess`) without credential leaking. |
| **Cryptography** | Web Crypto API (AES-256-GCM) | Edge-native destination address encryption at rest (`crypto.subtle`). |
| **UI Design System** | Stitch UI + Tailwind CSS | WCAG AA accessible components, Amber/Indigo tokens declared in `globals.css`. |
| **Localization** | `next-intl` (`[locale]`) | Native bilingual support (Vietnamese default `vi` + English `en`). |
| **Validation** | Zod v3.24+ | Fail-closed input boundary schemas for all Server Actions and event payloads. |

---

## 2. Layered Component Architecture

```
seed (Foundational primitives & schemas)
  ├── src/seed/types/ecommerce.ts          — UnifiedProductItem, CatalogSyncPayload
  ├── src/seed/types/affiliate.ts          — PayoutRail, OCC PayoutStatus, CommissionTier
  ├── src/seed/types/inngest-ecommerce.ts  — Inngest event contracts & schemas
  └── src/seed/security/circuit-breaker.ts — Per-store circuit breaker state machine

tree (Domain clients & cryptographic services)
  ├── src/tree/ecommerce/shopify-client.ts     — GraphQL API client with circuit breaker
  ├── src/tree/ecommerce/woocommerce-client.ts — REST v3 API client with circuit breaker
  ├── src/tree/affiliates/affiliate-ledger-service.ts — D1 commission accounting
  └── src/tree/crypto/encrypt-secret.ts        — AES-256-GCM destination encryption

forest (Orchestration & Server Actions)
  ├── src/forest/inngest/functions/commerce-catalog-sync.ts — Inngest catalog poller
  ├── src/forest/inngest/functions/commerce-video-dispatcher.ts — Batch video dispatch
  └── src/forest/actions/affiliate-actions.ts  — Safe 'use server' partner actions

land (Domain workflows & User Interface)
  ├── src/land/commerce/catalog-mapper.ts      — Clean HTML & generate video prompts
  ├── src/land/commerce/mission-trigger.ts     — Bridge to creative video missions
  ├── src/land/payouts/dual-rail-payout-engine.ts — VietQR & USDT settlement engine
  ├── src/components/affiliates/portal/        — Stitch UI KPI cards & ledger tables
  └── src/app/[locale]/affiliates/invite/      — Partner invite onboarding screens
```

---

## 3. Operational Guarantees

1. **Strict File Size Bound**: Every new and modified file strictly $\le 200$ LOC.
2. **Next.js 16 Server Actions**: `'use server'` files only export async functions; Zod schemas and constants isolated in `*-schema.ts`.
3. **No-Code / No-Tech BYOK**: Zero operator credentials required; customer supplies Shopify, WooCommerce, and payment tokens.
4. **OCC Versioning**: All financial ledger and payout status mutations increment `version` to eliminate race conditions in D1.
