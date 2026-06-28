# Codebase Exploration Report & Handoff

## 1. Observation

### 1.1. Directory Structure and Boundaries
* **Path:** `apps/sophia-ai-factory/` — Canonical production Next.js 16 app deployed to Cloudflare Pages.
* **Path:** `apps/84tea/` — Inactive, undocumented Next.js template.
* **Path:** `apps/sophia-video-bot/` — Contains a `pyproject.toml` file but has no Python source code files inside.
* **Path:** `services/moviepy-render/server.py` and `services/coqui-tts/server.py` — Sidecar microservices deployed as Docker images to Fly.io/Runpod.
* **Path:** `migrations/` (root) and `apps/sophia-ai-factory/migrations/` — Two identical directories containing 151 D1 SQLite migration files (`0001-init.sql` to `0147_thumbnail_variants.sql`).
* **Path:** `supabase/` — Legacy Postgres migrations.
* **Path:** `apps/sophia-ai-factory/src/seed/db/migrations/` — Contains 29 SQLite migrations, which include a comment in `0038-revenue-split.sql`:
  ```sql
  -- DEPRECATED — DO NOT RESTORE
  -- This file is kept ONLY as historical record. It was never applied to remote
  -- D1 because apply-migrations.sh does not walk src/seed/db/migrations/...
  ```
* **Path:** `apps/sophia-ai-factory/src/db/migrations/` — Contains 4 PostgreSQL migrations referencing Supabase schema structures (e.g. `REFERENCES auth.users(id)` and `JSONB`).

### 1.2. Architectural Flows and Entrypoints
* **Pages and API Routing:** Handled under `src/app/[locale]/` (multilingual routes) and internal/RaaS API routes under `src/app/api/`.
* **Middlewares:**
  - `src/middleware.ts` runs at Cloudflare Edge: injects CSP nonces, handles CSRF validations, checks MFA pending state, and enforces `MASTER` tier admin access.
  - `src/middleware-api-handler.ts` intercepts `/api/` endpoints, managing rate limits, tenant isolation, and checking RaaS licensing headers (`x-raas-tier`, etc.).
* **Better Auth Setup:**
  - Configured in `src/seed/auth/better-auth-server.ts`. Uses D1 database binding `DB` (`sophia-raas-db`).
  - Includes Magic Link and post-user creation database hooks (inserts row into `organizations`, `org_members`, `org_balances`, `subscriptions`, and `user_profiles`).
* **Database & Cache:**
  - SQLite/D1 is primary database via proxy adapter `D1Client` in `src/seed/db/client.ts`.
  - Supabase JWKS token validation in `src/seed/security/jwt-validator-jwks.ts` queries `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/jwks` for token signature verification in RaaS APIs.
  - Upstash Redis Cache is accessed via a REST client in `src/lib/redis.ts` for nonces and revoked keys.
* **Inngest Queues:**
  - Initialized in `src/forest/inngest/client.ts`. Served via `src/app/api/inngest/route.ts`.
* **External Integrations:**
  - HeyGen webhooks: Processed at `/api/webhooks/heygen`. Signatures are validated by retrieving user-specific secrets in `src/lib/webhooks/heygen-webhook-secret-resolver.ts` to ensure tenant isolation.
  - NOWPayments: Processed at `/api/webhooks/nowpayments` using `NOWPAYMENTS_IPN_SECRET` signature matching.
  - Telegram Bot: Handled at `/api/webhooks/telegram` with deep-linking JWT validation.
  - MoviePy: Called via `/compose` endpoint in `src/lib/video/composer-ffmpeg.ts`, wrapped in a circuit breaker (`withBreaker`) returning a stub MP4 upon timeout.

### 1.3. Newly Modified Paths
`git status` reveals the following modified files in the repository:
1. `apps/sophia-ai-factory/src/app/api/cron/dunning-advance/route.ts` — Restructured sequential loops to parallel `Promise.all` processing.
2. `apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` — Lazily requires `local-d1-mock` only when not on Edge to prevent bundler contamination.
3. `apps/sophia-ai-factory/src/seed/auth/require-admin.ts` — Hardened HMAC verification with correct padding checks and canonical signature representation to prevent signature malleability.
4. `apps/sophia-ai-factory/src/seed/cache/edge-cache.ts` — Streamlined response object construction from `.body` instead of buffering.
5. `apps/sophia-ai-factory/src/seed/db/client.ts` — Lazily requires `local-d1-mock` when not on Edge.
6. `apps/sophia-ai-factory/src/seed/security/cron-auth.ts` — Prevented developers from bypassing cron authentication when running under Playwright.
7. `apps/sophia-ai-factory/src/forest/components/dashboard/sidebar-quota-widget.tsx` — Added accessibility tag `aria-label="Quota usage progress"`.
8. `apps/sophia-ai-factory/src/app/[locale]/dashboard/agi/outcomes/page.tsx` & `components/outcomes-dashboard-client.tsx` — Replaced `{ ssr: false }` dynamic import with standard imports and resolved Next.js hydration issues using a `mounted` state wrapper.
9. `apps/sophia-ai-factory/src/app/[locale]/dashboard/analytics/page.tsx` & `components/analytics-dashboard-client.tsx` — Replaced `{ ssr: false }` dynamic import with standard imports and resolved Next.js hydration issues using a `mounted` state.
10. `apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` — Added TypeScript interfaces `StorageSettings` and `StorageForm` instead of `any` casts to resolve type compilation warnings.
11. `apps/sophia-ai-factory/scripts/e2e-bootstrap-user.ts` — Added `origin` headers in fetch requests to satisfy Better Auth CSRF protection.
12. `docs/troubleshooting.md` — Appended Section 11 (Cron Configuration Drift Issues) and Section 12 (Sidecar Connection Errors) in bilingual English/Vietnamese format.

### 1.4. Technical Debt and Pricing Scan
* **Silent Cron Trigger Failures (Configuration Drift):**
  - Triggers in `wrangler.toml` (line 66) list 18 cron schedules.
  - Mappings in `inject-scheduled-handler.mjs` (lines 34-86) omit 4 cron expressions:
    - `"0 7 * * *"` (llm-cache-purge)
    - `"0 */4 * * *"` (affiliate-scout)
    - `"10 * * * *"` (wallet-rebuild)
    - `"*/10 * * * *"` (heartbeat)
  - Result: Triggering these schedules outputs `No handler for cron pattern` and exits without executing target logic.
  - Stale endpoint directories in `src/app/api/cron/` (e.g., `daily-rollup`, `hourly-rollup`, `ab-winner-picker`, `memory-consolidation`, `quota-check`, `status-rollup`) are completely unmapped and dead.
* **Unregistered Inngest Handlers:**
  - Barrel file `src/forest/inngest/functions/index.ts` exports 15 functions, but `src/app/api/inngest/route.ts` registers only 7. Critical handlers (such as `videoGenerate`, `repurposeAnalyze`, and `sopExecute`) are omitted, causing silent queue failures.
* **Dead SOP Executor:**
  - `src/forest/sops/` directory is 100% dead. `sopExecute` listens to `'sop/execution.requested'`, which is never published. Active SOP engine runs synchronously via `runSop` inside `src/lib/sop/executor/sop-runner.ts`.
* **Critical Credit Balance Split Mismatch:**
  - User signup (Better Auth database hook in `better-auth-server.ts` line 158) inserts 50 starting credits into the `org_balances` table.
  - Coupon activation `/api/coupons/activate` line 91 updates `org_balances`.
  - But credits dashboard (`/dashboard/credits`) queries `user_mcu_balance` via `getBalance` in `src/lib/mcu/credits-repo.ts`.
  - LLM/video creation logic (`deductCredits` in `credits-repo.ts` line 72) updates `user_mcu_balance`.
  - Result: Newly registered users or coupon recipients have 0 usable credits in `user_mcu_balance` despite having credits in `org_balances`.
* **MASTER Tier Pricing Margin Risk:**
  - `unified-limits.ts` (line 121) sets `MASTER` tier to $4,999 lifetime one-time price, with 999 video campaigns/month.
  - `video-production-cost-constants.ts` (line 13) sets variable API cost per video to ~$0.57 (HeyGen + ElevenLabs + OpenRouter).
  - 999 videos generated in a month costs the platform ~$569.43.
  - A user maxing out their monthly quota becomes unprofitable in less than 9 months unless BYOK is strictly enforced. BYOK fallback to env keys creates severe margin risk.

---

## 2. Logic Chain

1. **Monorepo Clutter & Deprecations:**
   - Inactive apps (`apps/84tea/` and `apps/sophia-video-bot/`) increase lockfile size and workspace noise.
   - Deprecated migrations in `src/seed/db/migrations/` and PostgreSQL schemas in `src/db/migrations/` are not executed by `apply-migrations.sh` but may mislead developers and agents.
2. **Cron Failure Path:**
   - wrangler.toml cron schedules → Pages Worker runtime `scheduled` hook → `inject-scheduled-handler.mjs` injected router.
   - Because `0 7 * * *`, `0 */4 * * *`, `10 * * * *`, and `*/10 * * * *` are omitted in `inject-scheduled-handler.mjs` router, these 4 schedules trigger but fail to match a route, printing `No handler for cron pattern` and terminating silently.
3. **Queue Failure Path:**
   - Events are published to Inngest. Inngest tries to invoke `/api/inngest`.
   - Inngest serve endpoint registers only 7 functions. Unregistered functions (like `videoGenerate`) cannot be invoked, leading to silent event drops.
4. **Functional Billing Split (Critical Bug):**
   - Better Auth user signup inserts to `org_balances`. Coupon activation updates `org_balances`.
   - `dashboard/credits` page reads `user_mcu_balance`. `credits-repo.ts` deducts from `user_mcu_balance`.
   - Since no trigger or sync code copies or inserts from `org_balances` to `user_mcu_balance`, the balances diverge, locking new users out from running AI commands.
5. **Pricing Margin Deficit:**
   - Lifetime fee ($4,999) / Variable monthly cost maxed out ($569.43) = 8.78 months.
   - Therefore, a MASTER tier user generating 999 videos monthly makes the platform unprofitable after ~9 months if they use system-wide API keys instead of BYOK.

---

## 3. Caveats

* We analyzed only the server-side code and API endpoints. We did not run visual browser checks on the deployment URLs since we operate as a read-only explorer.
* We assume that `process.env.BYOK_ENABLED === '1'` is enabled in production, which forces users to use their own keys and protects the platform from margin deficits. If BYOK is disabled, the financial risk is high.
* We did not review the specific database contents in the remote Cloudflare D1 environment, relying on local codebase mappings and SQL migrations.

---

## 4. Conclusion

The Sophia AI Factory codebase has transitioned to Next.js 16 and D1 SQLite, but retains critical technical debt and configuration drift that must be resolved:
1. **Critical functional bug:** Sync the signup hook and coupon activation logic to write to `user_mcu_balance` instead of `org_balances` to restore credit systems.
2. **High operational risk:** Add missing cron mappings in `inject-scheduled-handler.mjs` to restore automated affiliate scouting, cache purges, wallet rebuilding, and heartbeat checks.
3. **Execution gaps:** Register the 15 missing Inngest functions in the serve route to ensure background video generation runs successfully.
4. **Cleanup:** Consolidate migrations, remove inactive app directories, and purge dead routes to reduce workspace noise.

---

## 5. Verification Method

### 5.1. Automated Verification Commands
Run the canonical test suite and checks inside `apps/sophia-ai-factory/`:
```bash
cd apps/sophia-ai-factory
# Verify type checks (no lint/type errors on modified files)
npm run type-check
# Run unit and integration tests
npm run test
# Run migration coverage checks
bash scripts/check-migration-coverage.sh
```

### 5.2. Files to Inspect
* Inspect `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` to verify if the 4 missing cron mappings have been added.
* Inspect `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts` to verify if unregistered background functions are added to the serve array.
* Inspect `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts` and `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/coupons/activate/route.ts` to verify if credit provisioning writes to `user_mcu_balance` (using `addCredits` from `credits-repo`).
