# Sophia AI Factory: Scalability & Performance Report

## 1. Cloudflare Workers Edge Runtime Limits
*   **Next.js App Router on Workers:** Next.js compiles to OpenNext format (`.open-next/worker.js`) running on Cloudflare Workers edge runtime.
*   **Resource Constraints:** The platform operates under standard edge limitations: memory (128MB to 256MB) and CPU time limits (10ms on Free tier, 50ms on standard paid, up to 30s for complex requests). Wall-clock limit is 15–30s for HTTP requests.
*   **Inline Execution Risk:** Tasks and agent executions (e.g. OpenRouter calls) are executed inline during the HTTP lifecycle (no Durable Objects used yet due to free tier constraints). This exposes the platform to wall-clock timeouts for complex multi-step reasoning.
*   **Upgrade Path:** Stateful multi-turn agent sessions and long-running workflows require upgrading to Cloudflare Durable Objects (DO) in future phases to prevent edge request timeouts.
*   **Cron Trigger Injection:** Next.js lacks native cron support on Workers. The build hook `inject-scheduled-handler.mjs` patches `.open-next/worker.js` with a `{ scheduled }` export on the default export to dispatch cron triggers (e.g. 10 cron patterns mapped to 11 routes).
*   **Daily Quotas:** Free tier limits requests to 100K/day. Upgrading to Workers Paid ($5/mo) raises the limit to 10M/day.

## 2. D1 Database Locks & Concurrency
*   **Single-Writer SQLite Limitation:** Cloudflare D1 is SQLite-based. Write operations are serialized, making the database prone to write lock contention, transaction queues, and latency during concurrent write bursts.
*   **TOCTOU Race Conditions:** Current quota counters (e.g. `video_usage_monthly` increments) are checked non-atomically. Concurrent requests can read the same count, pass the quota check, and double-increment past the limit. Fix: Recommend atomic `UPDATE org_balances SET balance = balance + 1 WHERE ... RETURNING balance` queries.
*   **Multi-Tenancy & Isolation:** D1 lacks Row-Level Security (RLS). Tenant isolation is enforced at the application layer via query-level scopes (`WHERE tenant_id = ?` or `WHERE org_id = ?`).
*   **Availability & Backups:** Single-region deployment (APAC region). Zone degradation halts the DB completely; manual restore from R2 backups has a 4-hour RTO.
*   **Daily Quotas:** Free tier: 5M reads/day and 100K writes/day. Paid tier: 25M reads/day and 50M writes/day.

## 3. R2 Media Storage Delivery
*   **Bucket Inventory & Lifecycles:**
    *   `sophia-backups`: Stores D1 database dumps (~10–50MB/day) with a 30-day auto-expiry lifecycle rule configured directly on the bucket.
    *   `sophia-videos`: Stores customer-facing campaign MP4 files (5–60MB each). Indefinite retention creates high storage growth risk.
    *   `sophia-ai-factory-opennext-cache`: Next.js ISR cache, automatically managed by OpenNext.
*   **Delivery & Retention Gaps:**
    *   No automated cleanup exists for older videos. Manual operator purging is required for files >90 days old (excluding ENTERPRISE/MASTER tiers).
    *   `video_retention_overrides` database table is not yet implemented to prevent deletion of critical assets.
    *   Auth gating is implemented on the video streaming route to prevent unauthorized traffic/egress costs.
*   **Storage Cost:** Free tier: 10GB storage, 1M Class A (writes), and 10M Class B (reads) operations. Paid tier bills storage at $0.015/GB-mo. Egress is free.

## 4. Inngest Background Video Processing Queues
*   **Orchestration:** Event-driven video generation (scripting → TTS → visual → compose → upload → publish) is managed via Inngest functions.
*   **Saturation & Backpressure:** Spikes in video requests (e.g. mass campaign trigger by 1M users) could saturate the 18+ active async functions. The platform lacks global concurrency limits and backpressure handling.
*   **Hardening & Reliability:** 
    *   Workflows (like Telegram publishing) are split into memoized `step.run` blocks (claim → send → finalize). If a failure occurs, Inngest only retries the failed step instead of restarting the entire pipeline.
    *   Idempotent event IDs (`publish-${jobId}-retry-${n}`) prevent duplicate jobs on retry.
    *   Cron loops: `fulfillment-retry` runs every 2 minutes with exponential backoff; failed fulfillment retries invoke atomic compensation (+1 credit refund).
    *   A reconciliation cron run at 6AM UTC syncs states with billing, and a synthetic monitor runs every 15 minutes to alert on queue issues.

## 5. Multi-Agent & Refactoring Considerations (docs/ai-architecture-2026-update.md)
*   **Agent Teams (Parallelism):** Upgrading the Python/TS RaaS engine to support Agent Teams (16+ parallel agents) speeds up file operations by 10-50x. Cost remains constant, but isolated git worktrees are required to mitigate merge conflicts.
*   **Reflection Patterns (Quality Gates):** Implementing 3 reflection iterations increases quality from 70% to 95%, but increases latency, API calls, and LLM billing costs by 2.2x.

## 6. Unresolved Questions
1.  *Automated R2 Purging:* How can we safely automate video deletion without risking data loss for VIP (ENTERPRISE/MASTER) customers?
2.  *D1 Lock Scale:* How does D1 write lock contention scale if 10K+ users execute simultaneous Inngest event check-ins?
3.  *BYOK Rate Limits:* How to handle OpenRouter/Anthropic key rate limits when running parallel agent teams on the edge runtime?
