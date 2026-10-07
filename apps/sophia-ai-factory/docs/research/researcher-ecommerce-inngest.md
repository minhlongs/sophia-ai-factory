# E-Commerce Catalog Sync & Video Dispatch via Inngest

## 1. Executive Summary & Ranked Recommendation
Autonomous product-to-video pipeline for Shopify/WooCommerce syncing into Inngest functions on Cloudflare Workers.
- **Rank 1 (Recommended): Tiered Fanout Pipeline with Inngest Debounce & Pre-Flight Cost Gate.** Decouples ingestion, batching, D1 content hashing, and cost-gated video mission dispatching.
- **Rank 2: Polled Batch Re-indexing.** Scheduled cron polls store catalog and writes delta batches. High latency for merchant updates, wastes rate limits on static stores.
- **Rank 3: Synchronous Webhook-to-Render.** Directly dispatches render on raw webhook. Rejected: runs out of Cloudflare isolate memory, ignores Shopify batch storms, exposes API to credit depletion.

## 2. Source Credibility Assessment
- **Inngest Official Documentation & Cloudflare Guide (High)**: Authoritative for step memoization, 4MB output limits, concurrency keys, `RetryAfterError`, and `NonRetriableError`.
- **Shopify Admin GraphQL API Reference (High)**: Authoritative for leaky bucket rate limits (50-100 cost/sec), HTTP 429 `Retry-After`, and pagination cursor standards.
- **WooCommerce REST API v3 Spec (High)**: Authoritative for WordPress REST authentication, batching endpoints, and host-dependent rate-limiting behaviors.
- **Sophia Architectural Contracts (Internal Truth)**: `seed/security/circuit-breaker.ts`, `land/video/pipeline-pricing.ts`, `forest/quota/mission-quota.ts`, and `tree/ecommerce/*`.

## 3. Trade-Off Matrix

| Dimension | Option 1: Tiered Fanout (Rank 1) | Option 2: Polled Batch (Rank 2) | Option 3: Sync Webhook (Rank 3) |
|---|---|---|---|
| **CF Memory / 4MB Step Limit** | Safe: Stores payload in D1, passes refs | Moderate: Pagination chunks in steps | High Risk: Ingesting whole catalog crashes isolate |
| **Circuit Breaker Resilience** | High: Store-keyed concurrency + cooldown | Moderate: Cron runs trigger burst trips | Poor: Bursts trip breaker immediately |
| **Cost & MCU Safety** | High: Atomic pre-flight quota & budget check | Moderate: Checks quota per batch | Zero: Webhook spam drains customer budget |
| **Merchant Event Latency** | Low (<30s debounce delay) | High (5-60 min polling intervals) | Near-instant (unsafe) |
| **System Complexity** | Moderate (2 Inngest functions, 3 events) | Low-Moderate (Cron + worker) | Low (Fragile) |

## 4. Core Findings & Patterns

### 4.1 Inngest Serverless Patterns on Cloudflare Workers
- **Step Memoization**: Each `step.run()` returns serialized JSON. Never return full product arrays (>50 items) inside a single step to prevent exceeding Inngest 4MB step data limits and CF Worker memory ceilings (128MB).
- **Chunk-and-Ref Pattern**: Store mapped `UnifiedProductItem[]` directly in Cloudflare D1 `commerce_products` or R2 cache during ingestion; steps only return `{ syncId, storeHost, productCount, contentHashes }`.
- **Stateless Breaker Sync**: Module memory in CF Workers is ephemeral across steps. Circuit breaker state MUST synchronize against D1 via `seed/security/circuit-breaker.ts`.

### 4.2 Rate Limits & Per-Store Circuit Breaker Handling
- **Concurrency & Throttling**: Use Inngest function config to rate-limit execution per tenant host:
  `concurrency: { key: "event.data.storeHost", limit: 1 }`, `throttle: { key: "event.data.storeHost", limit: 2, period: "1s" }`.
- **Trip Classification**:
  - `AUTH_FAILURE` (401/403): Invalid token/secret -> trip circuit to `OPEN` (5-min lock) -> throw `new NonRetriableError(msg)`. Halts execution permanently.
  - `RATE_LIMIT` (429): Read `retryAfterSec` (capped at 60s) -> trip circuit cooldown -> throw `new RetryAfterError(msg, retryAfterSec)`. Inngest delays next attempt without retry burn.
  - Active Breaker Lockout: If `shouldAllowRequest(service, storeHost)` is false before request, calculate remaining cooldown and throw `new RetryAfterError("Circuit breaker open", cooldownSec)`.
  - `SERVER_ERROR` (5xx): Throw generic `Error(msg)` for standard exponential backoff.

### 4.3 Catalog Batching & Deduplication
- **Debouncing**: Burst updates from Shopify/WooCommerce CSV imports are collapsed via Inngest native debounce:
  `debounce: { key: "event.data.storeHost + '-' + event.data.productId", period: "20s" }`.
- **Content Hash Deduplication**: Compute `contentHash = sha256(title + price + description.slice(0, 500) + images[0])`.
  If incoming hash matches `commerce_products.content_hash`, update metadata, mark `video_status = 'skipped_unchanged'`, and terminate mission dispatch.

### 4.4 Pre-Flight Cost Evaluation & Async Video Mission Dispatch
- **Pre-Flight Evaluation Sequence**:
  1. Monthly Mission Gate: `checkMissionQuota(ownerId, tier, 'engine_missions')`. Reject if monthly limit exhausted.
  2. Compute Video Cost Estimate: `estimatedUsd = computeTtsCost(ttsProvider) + computeVisualCost(visualProvider, durationSec)`. (Typically ~$0.65 - $0.85).
  3. Budget Balance Check: Verify workspace ledger balance >= `estimatedUsd` or verified BYOK active status.
- **Deterministic Mission Dispatch**: Emit `agent.mission.started` or `video/generate.requested` with unique Inngest event ID: `event.id = "vidgen-" + storeHost + "-" + productId + "-" + contentHash`.

## 5. Actionable Schemas & Event Definitions

```typescript
// seed/inngest/event-types.ts additions
export interface CommerceCatalogSyncRequestedEvent {
  data: {
    syncId: string;
    workspaceId: string;
    platform: 'shopify' | 'woocommerce';
    storeHost: string;
    triggerSource: 'webhook' | 'manual' | 'cron';
  };
}

export interface CommerceProductDeltaDetectedEvent {
  data: {
    syncId: string;
    workspaceId: string;
    platform: 'shopify' | 'woocommerce';
    storeHost: string;
    productId: string;
    contentHash: string;
    product: UnifiedProductItem;
    autoRenderVideo: boolean;
  };
}
```

```typescript
// forest/inngest/functions/commerce-product-sync.ts
export const commerceProductSync = inngest.createFunction(
  {
    id: 'commerce-product-sync',
    retries: 3,
    concurrency: { key: 'event.data.storeHost', limit: 1 },
    throttle: { key: 'event.data.storeHost', limit: 2, period: '1s' },
  },
  { event: 'commerce/catalog.sync.requested' },
  async ({ event, step }) => {
    const { platform, storeHost, workspaceId } = event.data;
    const products = await step.run('fetch-catalog-delta', async () => {
      if (!shouldAllowRequest(platform, storeHost)) {
        throw new RetryAfterError('Per-store circuit breaker OPEN', 30);
      }
      // Fetches via tree/ecommerce client returning Result<T, CommerceClientError>
      // Throws NonRetriableError on 401/403 or RetryAfterError on 429
    });
    // Stores items in D1 and dispatches delta events
  }
);
```

## 6. Adoption Risks & Architectural Fit
- **Adoption Risk (Low)**: Inngest SDK v3.x is battle-tested in Sophia. Zero external daemon needed; runs entirely inside OpenNext worker bundle.
- **Architectural Fit (High)**: Strictly complies with Sophia 4-layer architecture:
  - `seed`: Inngest event definitions and circuit breaker primitives.
  - `tree`: `tree/ecommerce/` clients for platform-specific fetch logic.
  - `forest`: Inngest functions (`commerce-catalog-sync.ts`, `commerce-video-dispatcher.ts`).
  - `land`: D1 database updates, catalog mapper, and mission trigger actions.

## 7. Limitations & Exclusions
- Does not cover variant combinatorics (only primary variant / canonical product mapped).
- Does not include real-time inventory out-of-stock webhook teardown of live ad campaigns.
- Multi-currency conversion assumes standard platform USD mapping.

## 8. Unresolved Questions
1. Should customer BYOK keys for Shopify/WooCommerce be stored per-workspace or per-user in `tree/byok`?
2. What is the default merchant auto-render policy (render all new products vs queue for approval)?
