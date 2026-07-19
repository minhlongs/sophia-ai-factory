# Handoff Report — System Topology & Architecture Audit

## 1. Observation

Direct observations of the codebase structure and runtime configuration:
* **System Runtime & Infrastructure**:
  * File `apps/sophia-ai-factory/wrangler.toml` contains Cloudflare bindings:
    * Compute entry: `main = ".open-next/worker.js"` (Line 4), `name = "sophia-ai-factory"` (Line 3).
    * R2 bindings: `NEXT_INC_CACHE_R2_BUCKET` (Line 15), `VIDEO_BUCKET` (Line 22, name: `sophia-videos`), and `BACKUPS_BUCKET` (Line 29, name: `sophia-backups`).
    * D1 bindings: `DB` (Line 33, database_id: `78bd1961-b62d-43bb-b551-0c5d7d389506`, name: `sophia-raas-db`) and `NEXT_TAG_CACHE_D1` (Line 44, database_id: `7b1d4fd4-8aa2-4006-828a-ef2b76652a46`, name: `sophia-tag-cache`).
    * KV binding: `EXPERIMENT_KV` (Line 89).
  * File `apps/sophia-ai-factory/open-next.config.ts` delegates static caching and path invalidation to R2 and D1 cache bindings:
    ```typescript
    incrementalCache: r2IncrementalCache,
    tagCache: d1NextTagCache,
    ```
  * File `apps/sophia-ai-factory/next.config.ts` configures Next.js compilation:
    * `output: 'standalone'` (Line 24).
    * `typescript.ignoreBuildErrors: true` (Line 43) bypasses build-time check constraints to reduce compiler OOM.
* **Routing & Authentication**:
  * File `apps/sophia-ai-factory/src/middleware.ts` routes request traffic:
    * Line 113: session verification via `auth.api.getSession({ headers: request.headers })`.
    * Line 119: MFA redirection checks `isSessionMfaPending(session.session.id)`.
    * Lines 133-154: `MASTER` tier gate check for `/dashboard/admin/*` using raw D1 query via `getD1Raw()`.
  * File `apps/sophia-ai-factory/src/middleware-api-handler.ts` executes API checks:
    * Line 13: `tenantIsolationMiddleware` runs to protect database scoping.
    * Line 46: `checkRateLimit` handles request rates.
    * Line 74: `raasGate` handles licensing validation.
* **Database & Repositories**:
  * File `migrations/0001-init.sql` establishes basic tables: `users`, `organizations`, `org_members`, `org_balances`, `subscriptions`, `transactions`, `usage_logs`, `missions`.
  * File `migrations/0052-missions-engine.sql` inserts `engine_missions` for user-scoped REST API commands:
    ```sql
    CREATE TABLE IF NOT EXISTS engine_missions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      command TEXT NOT NULL,
      params TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','cancelled')),
      result TEXT,
      error TEXT,
      credits_used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      webhook_url TEXT
    );
    ```
  * File `migrations/0043-videos-fulfillment-state-relax.sql` establishes the final relaxed schema for the `videos` table (Lines 10-34), tracking user scripts, R2 keys, purchase linkages, attempt counts, and locale parameters.
* **Orchestration & Data Flow**:
  * File `apps/sophia-ai-factory/src/app/actions/automation.ts` initiates script and video webhooks:
    * Line 62: calls `process.env.N8N_WEBHOOK_GENERATE_SCRIPT` POST request with script parameters.
    * Line 112: calls `process.env.N8N_WEBHOOK_RENDER_VIDEO` POST request with video parameters.
  * File `apps/sophia-ai-factory/src/forest/missions/dispatcher.ts` coordinates background task handlers:
    * Line 64: `dispatchMission(missionId)` transitions task status to `running`, loads handler dynamically (Line 19), runs the step, deducts credits, and posts results.
  * File `apps/sophia-ai-factory/src/forest/missions/handlers/video-create.ts` triggers video creation:
    * Lines 23-84: if `storageSettings?.useTenantStorage` is set, utilizes MCP CheetahClaws engine render: `openclaw.mcp('cheetahclaws', 'renderVideo', ...)`.
    * Lines 86-135: otherwise, calls `createHeyGenVideo` to submit render jobs using the user's provider key.
  * File `apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts` receives HMAC-signed HeyGen webhook requests:
    * Line 152: `verifyHeyGenSignature(rawBody, sig, secret)` verifies payload validity.
    * Lines 162-182: maps successes to `completeVideoFromWebhook` and errors to `failVideoFromWebhook`.
  * File `apps/sophia-ai-factory/src/lib/fulfillment/complete-video-from-webhook.ts`:
    * Line 77: `completeVideoFromWebhook` downloads video using `downloadAndStore`, updates video record to `completed`, and fires a ready email.
  * File `apps/sophia-ai-factory/src/lib/video/video-storage-service.ts`:
    * Line 32: `downloadAndStore` performs the R2 upload (`r2.bucket.put`) and yields the persistent public URL.
  * File `apps/sophia-ai-factory/src/forest/inngest/functions/publish-execute.ts`:
    * Line 202: `claim-and-upload` steps claim scheduled jobs via Compare-And-Swap (Line 226).
    * Line 249: dispatches Telegram videos directly via Bot API.
    * Line 325: refreshes expiring channel credentials and uploads video to social provider APIs (YouTube, TikTok, Facebook, LinkedIn, Pinterest, Zalo, threads, etc.).

## 2. Logic Chain

1. **Standalone OpenNext Worker**: Next.js is configured for `standalone` output and compiled into `.open-next/worker.js` (wrangler main entry), meaning it handles all client requests and API logic in an Edge Worker context.
2. **Infrastructure Boundaries**: The routing relies on local environment binding proxies for D1, R2, and KV. D1 stores app data, R2 keeps video files and backup logs, KV caches A/B testing flags, and D1 `NEXT_TAG_CACHE_D1` tracks static rendering tags.
3. **Double-submit Protection (CAS)**: High concurrent webhook calls or automated cron retries could cause duplicate email alerts, double-refunding, or concurrent distribution uploads. To prevent this, the codebase implements Compare-And-Swap (CAS) locking during writes:
   * Video fulfillment updates `attempt_count` and state in `videos` only `WHERE status = 'queued'` or `WHERE status = 'pending'`.
   * Social media publishing claims scheduled jobs in `publishing_jobs` only `WHERE status = 'scheduled'`.
4. **Scoping & Security**:
   * API endpoints use `tenantIsolationMiddleware` to enforce SaaS partition bounds.
   * `resolveHeyGenWebhookSecret` returns a tenant owner UUID so that webhook calls can be scope-limited, blocking cross-user job updates.
   * SSRF protection `assertSafeVideoUrl` limits publishing script downloads to the configured `R2_PUBLIC_HOSTNAME`.

## 3. Caveats

* Local execution depends on sqlite/d1 simulation wrappers loaded at Node.js context start; we assume the production D1 executes with the same transaction behavior.
* In-progress publishing retries rely on Inngest event scheduling (`publish.scheduled`). We did not audit the Inngest runner infrastructure itself, only the client handler implementation.
* The local render engine `cheetahclaws` is invoked via `openclaw.mcp` dynamic tool calls. We assume the tool provider is configured inside the runtime context.

## 4. Conclusion

The Sophia AI Factory is a highly optimized, Cloudflare-centric monorepo application. The core logic utilizes Next.js server actions, D1/R2 storage bindings, and Inngest scheduled flows. It successfully protects transactional integrity using CAS locks on D1, scopes authentication securely on the edge middleware runtime, and segments resource consumption using smart LLM routing and BYOK provider management.

## 5. Verification Method

* Run vitest test suite targeting the smart LLM routing logic:
  ```bash
  npx vitest run src/lib/ai/llm-router.test.ts
  ```
* Run vitest test suite checking the transactional Compare-And-Swap webhook handler:
  ```bash
  npx vitest run src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts
  ```
* Inspect `apps/sophia-ai-factory/wrangler.toml` lines 10-92 to check bucket names, D1 IDs, and KV bindings.
* Inspect `apps/sophia-ai-factory/src/middleware.ts` to examine the edge auth gate and tenant isolation mapping.
