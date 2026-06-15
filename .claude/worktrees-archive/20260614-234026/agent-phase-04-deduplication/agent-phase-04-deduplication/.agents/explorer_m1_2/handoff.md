# Handoff Report — Explorer 2 (Architectural Execution Flow Auditor)

This handoff details the findings of the architectural execution flow audit. The comprehensive analysis can be found in `flow_analysis.md`.

---

## 1. Observation

Directly observed files, logic, and configurations include:
1. **Inngest Serve Disconnect**:
   - `src/app/api/inngest/route.ts` registers a subset of background functions:
     ```typescript
     export const { GET, POST, PUT } = serve({
       client: inngest,
       functions: [
         helloWorld,
         generateCampaign,
         autoDiscoverAffiliates,
         publishExecute,
         publishTokenRefreshCron,
         conversionToLedger,
         pendingPromoterCron,
         payoutBatcher,
         reconciliationCron,
         offerSyncCron,
         storageTrackerDaily,
         accountDeleteFinalizeCron,
       ],
     });
     ```
   - However, `src/forest/inngest/functions/index.ts` re-exports several additional routines that are **never registered** in the serve endpoint:
     ```typescript
     export { videoGenerate } from './video-generate';
     export { batchVideoFanout } from './batch-video-fanout';
     export { repurposeAnalyze } from './repurpose-analyze';
     export { repurposeClipGenerate } from './repurpose-clip-generate';
     export { analyticsSync } from './analytics-sync';
     export { tokenRefreshCron } from './token-refresh-cron';
     export { thumbnailAbSelector } from './thumbnail-ab-selector';
     export { urlRevenueVideoHandler } from './url-revenue-video-handler';
     ```
   - The events corresponding to these functions (e.g. `video/generate.requested`) will fail to run when emitted.

2. **D1 Custom SQL Rate Limiting**:
   - `src/seed/db/d1-client-rpc.ts` implements a mock RPC function `increment_rate_limit` that performs SQLite Upserts directly because SQLite lacks native stored procedures.
   - `src/seed/security/sql-rate-limiter.ts` delegates IP and authentication rate limits to this SQLite table `rate_limits`.

3. **Lazy-Proxied Redis Client**:
   - `src/lib/redis.ts` utilizes a Proxy wrapping `@upstash/redis` to prevent edge execution errors during build time:
     ```typescript
     export const redis: Redis = new Proxy({} as Redis, {
       get(_target, prop, receiver) {
         if (!_redis) {
           _redis = createRedis()
         }
         return Reflect.get(_redis, prop, receiver)
       },
     })
     ```
   - Used for verifying nonces to prevent replay attacks and storing revoked license keys in a Redis set `raas:revoked_keys`.

4. **Better Auth D1 Adapter & Signup Workflow**:
   - `src/seed/auth/better-auth-server.ts` defines Magic Link login and runs a `user.create.after` hook creating default organizations, assigning starting balances, default subscriptions (`BASIC` tier), and user profiles.

5. **Tenant-Isolated HeyGen Webhooks**:
   - `src/lib/webhooks/heygen-webhook-secret-resolver.ts` parses the `video_id` inside incoming webhooks, performs a lookup on the `videos` table to discover the user_id (tenant), and resolves their custom `heygen_webhook_secret` from credentials, maintaining strict security boundaries.

6. **Circuit-Breaker Protected MoviePy Render Calls**:
   - `src/lib/video/composer-ffmpeg.ts` triggers `/compose` and `/compose-rich` endpoints on the FastAPI `moviepy-render` service (`services/moviepy-render/server.py`) wrapped in `withBreaker()`.

7. **Zod-Validated Percentage KV Feature Flags**:
   - `src/lib/feature-flags/index.ts` uses FNV-1a 32-bit hashing to map user IDs to buckets (0-99) for rollout percentage evaluation. The flag states are backed by `EXPERIMENT_KV` bindings with a 60-second in-memory memo cache.

8. **Turbopack Build Gate & Client Asset Stripping**:
   - `scripts/deploy-with-sha.sh` forces Turbopack compilation (`npm run build`) because webpack's NFTs collection causes M1 16GB out-of-memory OOM crashes during build trace tracking. It runs `scripts/strip-ssr-bloat.sh` to remove client-side packages from server chunks.

---

## 2. Logic Chain

1. **Inngest Serve Disconnect**:
   - *Premise*: If a function is not registered in the `serve()` call of an Inngest API endpoint, Inngest's event loop has no visibility of that handler.
   - *Observation*: `videoGenerate` (for `video/generate.requested`) is exported by the functions index but omitted from `serve`'s list in `/api/inngest/route.ts`.
   - *Conclusion*: Triggering video generation via `inngest.send({ name: 'video/generate.requested', ... })` (e.g. inside `video-generate-action.ts` or `batch-video-fanout.ts`) will fail to execute the underlying video compilation code.

2. **D1 Custom PostgREST/RPC Compatibility**:
   - *Premise*: SQLite on Cloudflare D1 doesn't support PL/pgSQL stored procedures.
   - *Observation*: The code mocks PostgREST RPC via `d1-client-rpc.ts`, mapping client-side `.rpc('increment_rate_limit', ...)` calls into raw SQLite UPSERT queries.
   - *Conclusion*: Core features originally designed for PostgreSQL (like credit debiting or rate limiting) are fully supported on Cloudflare D1 without altering client-side code structure.

3. **Tenant-Isolated Webhook Verification**:
   - *Premise*: A static webhook endpoint is a vector for spoofing.
   - *Observation*: `resolveHeyGenWebhookSecret()` looks up the video's owner in the database first, then retrieves their personal webhook credential to verify the payload signature.
   - *Conclusion*: Cross-tenant forgery of video completions is prevented since signature verification requires the specific user's HeyGen credentials.

---

## 3. Caveats

1. **Coqui TTS and RunPod Services**: The integration and exact API calls to the external `coqui-tts` FastAPI service (`services/coqui-tts/server.py`) and `runpod-hunyuan` handler were not traced deeply, as the core focus was the main Pages application pipeline.
2. **PostHog A/B Testing**: The exact integration details of PostHog experiment variants in `src/lib/signals/feature-flags.ts` were not examined.
3. **Inngest Execution Status**: We assume the Inngest runner is hosted in a standard cloud setup; if local dev tools are used, the missing function registration will block local emulation as well.

---

## 4. Conclusion

The Sophia AI Factory architecture is well-decoupled, leveraging Cloudflare Workers, D1 databases, R2 storage, Upstash Redis, and lightweight Python microservices on Fly.io (TTS, MoviePy Compose).

However, **there is a critical gap where `videoGenerate` (the Wan 2.1 + Fish Speech generation job) and other functions (like `batchVideoFanout`, `repurposeAnalyze`, `repurposeClipGenerate`) are NOT registered in the `/api/inngest` serve endpoint.** This prevents these events from executing. The implementer must update `src/app/api/inngest/route.ts` to register these exported functions.

---

## 5. Verification Method

To verify these observations:
1. **D1 Client RPC Verification**: Inspect [d1-client-rpc.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-client-rpc.ts) lines 55–60.
2. **Inngest Registration Verification**: Compare [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts) lines 24–44 with [index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) to verify the list of missing functions.
3. **Deploy Topology & Turbopack Verification**: Open [deploy-with-sha.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/deploy-with-sha.sh) and inspect comments on lines 25-36.
4. **Test Command**: Run `vitest run` under the `apps/sophia-ai-factory/` folder to check that current units tests pass.
