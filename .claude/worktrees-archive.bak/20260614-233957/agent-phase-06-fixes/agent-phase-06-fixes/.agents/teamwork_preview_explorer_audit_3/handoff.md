# Subsystem Analysis & Codebase Audit Report

## 1. Observation
We conducted a comprehensive read-only investigation of the Sophia AI Factory codebase. Below is a detailed breakdown of all 11 core subsystems followed by codebase quality scan findings.

### Subsystem 1: Setup Wizard & Config
- **Purpose**: Business: First-time platform onboarding and wizard setup for new instances. Technical: Configures database and encrypts/stores initial admin credentials.
- **Entry Points**: 
  - Main Page: `src/app/[locale]/setup-wizard/page.tsx`
  - Steps: `src/tree/components/setup-wizard/`
  - API Routes: `src/app/api/setup-wizard/save-credentials/route.ts`
- **Runtime Lifecycle**:
  1. Middleware checks `IS_CONFIGURED` env/var. If false, redirects to `/setup-wizard`.
  2. The stepper UI guides the user through database setup, system check, API key inputs.
  3. API saves configuration and writes a `wizard_done` cookie.
- **State Management**: Writes to `user_provider_credentials` (AES-GCM encrypted) and creates organization bootstrap rows in D1.
- **Dependencies**: Web Crypto API, Kysely, `next-intl`.
- **Failure Modes**: Missing `RAAS_JWT_SECRET=REDACTED` prevents token verification; DB timeouts block step completion.
- **Recovery Behavior**: Graceful layout authentication check redirects unauthenticated requests to `/login?redirect=/setup-wizard`.
- **Scale Limits**: Single-run per user; scales with edge worker capacity.
- **Security Surface**: Unprotected setup routes if `IS_CONFIGURED` is improperly bypassed.
- **Observability**: Verification logs under `/api/setup-wizard/test-heygen` and `/test-resend`.
- **Technical Debt**: Legacy static redirection paths still present in `wrangler.toml` triggers.
- **Missing Knowledge**: The production certificate pinning scheme for the local Cloudflare tunnel.
- **Confidence Level**: High

### Subsystem 2: BYOK Key Management
- **Purpose**: Business: Zero vendor lock-in; customers bring their own AI keys. Technical: Safely stores, rotates, and decrypts individual API keys at runtime.
- **Entry Points**: 
  - SSR Page: `src/app/[locale]/dashboard/byok/page.tsx`
  - API Route: `src/app/api/user/byok/route.ts`
  - Core Logic: `src/tree/byok/byok-crypto.ts`
- **Runtime Lifecycle**:
  1. User enters keys on the dashboard form.
  2. POST `/api/user/byok` encrypts inputs with AES-GCM and inserts key hashes into `user_api_keys`.
  3. LLM/Video callers invoke `getUserApiKey` before making external requests.
- **State Management**: Encrypted records stored in `user_api_keys` D1 table.
- **Dependencies**: Web Crypto API, Kysely.
- **Failure Modes**: Corruption of `BYOK_MASTER_KEY` secret makes all encrypted keys unreadable.
- **Recovery Behavior**: Falls back to platform credentials via env when BYOK is disabled or not configured for a user.
- **Scale Limits**: Encryption occurs on V8 isolate at edge CPU; limited only by D1 query throughput.
- **Security Surface**: Leaking of master key decodes all stored API keys.
- **Observability**: Emits signal events `BYOK_KEY_SET` and `BYOK_KEY_CLEARED` to telemetry.
- **Technical Debt**: Overlapping namespaces with legacy `/src/lib/byok/key-format-validators.ts`.
- **Missing Knowledge**: Key backup protocols during manual DB exports.
- **Confidence Level**: High

### Subsystem 3: RaaS Supervisor Agent (OpenClaw)
- **Purpose**: Business: Multi-agent fleet execution of marketing campaigns and reasoning workflows. Technical: Dynamic skill loaders and circuit-breaker-protected LLM routing.
- **Entry Points**:
  - Fleet Spawner: `src/lib/openclaw/spawn-agent-fleet.ts`
  - LLM Router: `src/lib/openclaw/llm-router.ts`
- **Runtime Lifecycle**:
  1. Scheduler/Action calls `spawnAgentFleet()` with a set of tasks.
  2. Checks iteration budgets against limits.
  3. Dispatches tasks to `routeLLM()` to execute.
  4. Qwen 3 32B (lite/standard) or Claude (max) processes the prompt.
  5. Audit entry is written upon completion.
- **State Management**: Writes audit events to `raas_audit_logs`.
- **Dependencies**: Anthropic SDK, local Ollama/Qwen.
- **Failure Modes**: Local Qwen instance crashes; circuit breaker trips.
- **Recovery Behavior**: Trips after 3 failures and falls back to Claude Haiku for 60 seconds.
- **Scale Limits**: Capped at `maxConcurrency=5` per fleet spawn to protect isolates.
- **Security Surface**: Code execution vulnerabilities through malicious model prompts.
- **Observability**: Detailed traces recorded in `raas_audit_logs`.
- **Technical Debt**: Mock executor used in `spawn-agent-fleet-executor.ts` local execution path.
- **Missing Knowledge**: Live deployment architecture of the local Qwen instance.
- **Confidence Level**: High

### Subsystem 4: n8n Automation Engine
- **Purpose**: Business: Low-code automation backend for campaign playbooks. Technical: External webhook coordinator for script/video pipelines.
- **Entry Points**: 
  - Action file: `src/app/actions/automation.ts`
  - Webhooks: `N8N_WEBHOOK_GENERATE_SCRIPT` and `N8N_WEBHOOK_RENDER_VIDEO`.
- **Runtime Lifecycle**:
  1. Next.js server actions insert draft campaigns in D1.
  2. POSTs campaign details to n8n webhook.
  3. n8n executes visual nodes and updates campaign status.
- **State Management**: Modifies `campaigns` table status fields.
- **Dependencies**: `fetch` API, environment variables.
- **Failure Modes**: n8n container unreachable; ngrok tunnel timeout.
- **Recovery Behavior**: Campaign status is stuck in `processing_video` or `processing_script`, requiring operator intervention.
- **Scale Limits**: Fire-and-forget; scales as an independent microservice.
- **Security Surface**: Unauthenticated webhook endpoints in n8n (SSRF vector).
- **Observability**: Logs errors upon webhook request failure.
- **Technical Debt**: Handled via simple HTTP posts; lacks direct SDK validation.
- **Missing Knowledge**: Full node-graph JSON file sync in the repository.
- **Confidence Level**: High

### Subsystem 5: Payment & Media Infrastructure
- **Purpose**: Business: Direct crypto subscription and bank transfer purchases. Technical: Signed checkout and webhook listener with automatic tier upgrades.
- **Entry Points**:
  - Webhook route: `src/app/api/webhooks/nowpayments/route.ts` and `payos/route.ts`
  - Payout client: `src/land/payouts/nowpayments-mass-payout.ts`
- **Runtime Lifecycle**:
  1. User triggers checkout; pending order recorded in `pending_orders`.
  2. User pays -> Payment gateway triggers IPN webhook.
  3. Webhook verifies signature (HMAC-SHA512 / HMAC-SHA256).
  4. Updates organization subscription tier and credits MCU balances.
- **State Management**: Mutates `subscriptions`, `org_balances`, and `payment_events`.
- **Dependencies**: Web Crypto API, Resend client, NOWPayments API.
- **Failure Modes**: Webhook signature verification fails; double-spend on duplicate webhooks.
- **Recovery Behavior**: Underpayment guard marks status `underpaid` and halts fulfillment. Idempotency checks block duplicate transactions.
- **Scale Limits**: Webhook rate limiting; D1 concurrent writes during massive campaigns.
- **Security Surface**: Signature key exposure allows free tier conversion.
- **Observability**: Events logged to `payment_events` table; metrics emitted to PostHog.
- **Technical Debt**: Underpayments require manual resolution.
- **Missing Knowledge**: PayOS sandbox bank transfer simulator behavior.
- **Confidence Level**: High

### Subsystem 6: Distribution Publishers
- **Purpose**: Business: Schedule and publish marketing videos across 13 networks. Technical: Abstracted OAuth adapters with automatic token refreshes.
- **Entry Points**:
  - Inngest Execution: `src/forest/inngest/functions/publish-execute.ts`
  - Adapters: `src/lib/publishing/`
- **Runtime Lifecycle**:
  1. Inngest triggers `publishExecute`.
  2. Claims scheduled job via Compare-And-Swap.
  3. Resolves canonical R2 video URL (SSRF guarded).
  4. Refreshes expired OAuth tokens.
  5. Decrypts access token and uploads media.
- **State Management**: Updates `publishing_jobs` status and creates `publishing_results`.
- **Dependencies**: Inngest, OAuth APIs, AES-GCM crypto token store.
- **Failure Modes**: API rate limits; OAuth refresh tokens revoked by social networks.
- **Recovery Behavior**: Exponential retry backoffs (2min -> 10min -> 30min); hourly token refresh cron.
- **Scale Limits**: Social network API limits; R2 bandwidth capacity.
- **Security Surface**: Decrypted OAuth keys exposure; SSRF through unverified video URLs.
- **Observability**: Job status tracked in `publishing_jobs`; metrics written to JSON logs.
- **Technical Debt**: Hardcoded API endpoints in individual publishers.
- **Missing Knowledge**: The exact TikTok Shop API scopes required.
- **Confidence Level**: High

### Subsystem 7: Video Generation Pipeline
- **Purpose**: Business: Automatic onboarding videos for Master tier and on-demand avatar rendering. Technical: HeyGen v2 SDK orchestrator with exponential retry cron.
- **Entry Points**:
  - Action logic: `src/lib/fulfillment/one-time-fulfillment.ts`
  - Webhook: `src/app/api/webhooks/heygen/route.ts`
  - Retry Cron: `src/app/api/cron/fulfillment-retry/route.ts`
- **Runtime Lifecycle**:
  1. Order paid -> queue-first record inserted into `videos` table.
  2. Submits script and avatar metadata to HeyGen.
  3. HeyGen processes -> triggers callback webhook `/api/webhooks/heygen`.
  4. Video MP4 is saved to R2 and user notified via Resend.
- **State Management**: Updates `videos` status fields.
- **Dependencies**: HeyGen API, R2 video bucket, Resend.
- **Failure Modes**: HeyGen API downtime; webhook delivery failure.
- **Recovery Behavior**: `fulfillment-retry` runs every 2min. After 5 attempts, fails permanently, sends render-failed email, and credits user account.
- **Scale Limits**: HeyGen API concurrent slot limit.
- **Security Surface**: Unverified HeyGen webhooks; credentials exposure.
- **Observability**: Uptime monitored via `/api/health/heygen` to gate pricing cards.
- **Technical Debt**: Deprecated `video_jobs` code blocks remain in export list.
- **Missing Knowledge**: D-ID fallback logic details.
- **Confidence Level**: High

### Subsystem 8: Telegram Command Center
- **Purpose**: Business: User onboarding and campaign management bot. Technical: D1-backed Finite State Machine (FSM) processing command sequences.
- **Entry Points**:
  - Webhook: `src/app/api/webhooks/telegram/route.ts`
  - Controller: `src/tree/telegram/telegram-bot.ts`
- **Runtime Lifecycle**:
  1. Webhook receives message from Telegram Bot API.
  2. Resolves user pairing token.
  3. Checks FSM state in `telegram_fsm_states`.
  4. Routes user to appropriate prompt handler.
- **State Management**: `telegram_fsm_states` D1 table; FSM transitions.
- **Dependencies**: Telegram Bot API, Kysely.
- **Failure Modes**: Bot API rate limits (429); invalid states written to DB.
- **Recovery Behavior**: Rate limiter fail-open branches emit metrics; FSM throws checks on invalid states.
- **Scale Limits**: 30 messages/sec limit.
- **Security Surface**: Spoofed pairing tokens; message injection.
- **Observability**: Emits telemetry event `telegram_fsm_invalid_state` on DB drift.
- **Technical Debt**: State integers stored directly in D1 instead of string enums.
- **Missing Knowledge**: Local test mock configuration for the Bot API.
- **Confidence Level**: High

### Subsystem 9: SOP Execution System - Path 1 & Path 2
- **Purpose**: Business: Automated marketing playbook execution. Technical: Two distinct executors (synchronous vs event-driven DAGs).
- **Entry Points**:
  - Path 1: `src/lib/sop/executor/sop-runner.ts` (dashboard synchronous).
  - Path 2: `src/forest/sops/sop-executor.ts` (Inngest asynchronous).
- **Runtime Lifecycle**:
  - Path 1: User runs SOP -> `sop-runner.ts` executes sequentially -> writes to `sop_runs`.
  - Path 2: Event `sop/execution.requested` -> `sop-executor.ts` runs DAG waves -> writes to `sop_executions` and logs analytical steps.
- **State Management**: `sop_runs` and `sop_executions` tables in D1.
- **Dependencies**: Inngest, D1 Database.
- **Failure Modes**: Step errors abort subsequent steps.
- **Recovery Behavior**: Path 2 fails silently because the Inngest function is **unregistered**.
- **Scale Limits**: Worker request timeout (30s) limits Path 1.
- **Security Surface**: Malicious DAG payload injections.
- **Observability**: Execution logs stored in `sop_execution_analytics`.
- **Technical Debt**: Maintaining duplicate code systems. Path 2 is completely unregistered at runtime.
- **Missing Knowledge**: The roadmap for migrating Path 1 fully into Path 2.
- **Confidence Level**: High

### Subsystem 10: Affiliate Network & Payouts
- **Purpose**: Business: Manage referral commissions and execute mass USDT TRC20 payouts. Technical: Attributor cron with 14-day clawback logic and payout batching.
- **Entry Points**:
  - Payout Batcher: `src/land/payouts/payout-batcher.ts`
  - Webhook: `src/app/api/webhooks/nowpayments-payout/route.ts`
- **Runtime Lifecycle**:
  1. Click attributed to user -> adds pending row to `commission_ledger`.
  2. Holds pending commissions for 14 days.
  3. Payout batcher cron rolls up approved commissions and creates NOWPayments payout batch.
  4. Webhook updates ledger status to `paid`.
- **State Management**: `commission_ledger`, `payout_batches`, `affiliate_clicks`.
- **Dependencies**: NOWPayments API.
- **Failure Modes**: Empty hot wallet; duplicate payouts due to cron race conditions.
- **Recovery Behavior**: 14-day hold ensures validation check; unique batch indexes block double-fulfillment.
- **Scale Limits**: NOWPayments API threshold constraints.
- **Security Surface**: Spoofed payout webhook confirmations.
- **Observability**: Transaction hash logging in `payout_batches`.
- **Technical Debt**: Underpayments or ledger correction queries require manual DB intervention.
- **Missing Knowledge**: Wallet private key rotation intervals.
- **Confidence Level**: High

### Subsystem 11: Multi-tenant Isolation Layer
- **Purpose**: Business: Prevent data leakage in multi-tenant environments. Technical: Kysely client scope wrapper and API route access validator.
- **Entry Points**:
  - Scope: `src/seed/db/with-tenant-scope.ts`
  - Middleware: `src/forest/middleware/tenant-isolation.ts`
- **Runtime Lifecycle**:
  1. Request arrives at `/api/*`.
  2. Extraction module extracts tenant ID (via headers, JWT, or DB key).
  3. Access validator queries ownership in D1.
  4. Blocks request with 403 if mismatch. At query level, `withTenantScope` automatically injects `tenant_id = ?`.
- **State Management**: Stateless middleware check; DB queries scoped dynamically.
- **Dependencies**: `jose` JWT, Kysely.
- **Failure Modes**: Tables omitted from `TENANT_SCOPED_TABLES` list (permits potential leaks if query isn't explicitly scoped).
- **Recovery Behavior**: Fails closed, returns 403 Forbidden.
- **Scale Limits**: Extra database lookup overhead.
- **Security Surface**: Header manipulation (bypassed by prioritizing token validation).
- **Observability**: Logs all checks with a validation receipt (`logValidationWithReceipt`).
- **Technical Debt**: Inconsistent scoping column names: `tenant_id` vs `org_id` / `user_id`.
- **Missing Knowledge**: Full coverage audit on all future tables.
- **Confidence Level**: High

---

### Codebase Scan Findings: Dead Code, Duplicate Logic, and Gaps
1. **Unregistered Inngest Functions (Abandoned Paths)**:
   In `src/forest/inngest/functions/index.ts`, several legacy video functions (`videoScripting`, `videoTTS`, etc.) and the Advanced SOP executor (`sopExecute`) are exported, but they are **not registered** in `src/app/api/inngest/route.ts` (lines 31-59). Consequently, any asynchronous event-driven SOP executions (Path 2) will fail to resolve at runtime, rendering the DAG-based executor completely abandoned in production.
2. **Unscheduled Core Cron Jobs (Cron Drift)**:
   In `scripts/inject-scheduled-handler.mjs`, the post-build scheduled handler script matches wrangler triggers and maps them to internal API routes. However, several active routes in the source tree are omitted from the `CRON_ROUTES` map:
   - `daily-rollup/route.ts` (Never rolls up daily database summary logs)
   - `hourly-rollup/route.ts` (Never rolls up hourly database summary logs)
   - `status-rollup/route.ts` (Never performs daily status aggregates or purges old checks)
   - `quota-check/route.ts` (Never checks free-tier resources)
   - `memory-consolidation/route.ts` (Never runs background episodic memory consolidations)
   
   Because these routes are omitted from the injection script, Cloudflare cron events will fire without invoking them, resulting in silent background failures (e.g. data bloat from unpurged checks, uncalculated rollups).
3. **Legacy Supabase Artifacts**:
   The repository still contains folders under `supabase/migrations/` and codebase files under `src/lib/supabase/` that are legacy. The production app canonically uses Cloudflare D1 SQL database.
4. **Stale Documentation**:
   `docs/codebase-summary.md` claims that several cron patterns lack mappings in `CRON_ROUTES` (`0 5`, `*/10`, etc.). However, our analysis of `inject-scheduled-handler.mjs` shows that these patterns *have* been mapped to routes (e.g., `heartbeat` and `d1-backup`), but the documentation remains laggy and outdated.

---

## 2. Logic Chain
1. **Observation**: `/api/cron/status-rollup/route.ts` is in the codebase but missing from the `CRON_ROUTES` map in `inject-scheduled-handler.mjs`.
2. **Observation**: `inject-scheduled-handler.mjs` default exports the Cloudflare `scheduled()` handler, routing cron triggers strictly based on the `CRON_ROUTES` mapping.
3. **Reasoning**: If a cron route is not in `CRON_ROUTES`, the injected scheduled handler will print "No handler for cron pattern" and return without firing the endpoint.
4. **Conclusion**: `status-rollup` is dead code at the cron layer. Over time, the `status_check` D1 table will grow without limit because the deletion step is never executed.
5. **Observation**: `/api/cron/hourly-rollup/route.ts` and `daily-rollup/route.ts` are missing from `CRON_ROUTES`.
6. **Reasoning**: Summaries of database logs will not be calculated.
7. **Conclusion**: Status page charts and analytics dashboards will display stale or empty data.
8. **Observation**: `sopExecute` is missing from `src/app/api/inngest/route.ts`.
9. **Reasoning**: Inngest's serve endpoint handles only registered functions.
10. **Conclusion**: Path 2 (DAG-based SOP execution) is currently dead at runtime.

---

## 3. Caveats
- **Local Qwen Integration**: We did not verify the local Ollama Qwen instance execution status or prompt routing because we are operating in CODE_ONLY mode and do not have local Docker services running.
- **PayOS Bank Checkout Sandbox**: Sandbox payments were not simulated with bank transfer checksums.
- **Stale Logs**: Sentry logs were not checked directly on the web dashboard.

---

## 4. Conclusion
1. **Critical Action**: Register `sopExecute` in `src/app/api/inngest/route.ts` so the advanced DAG SOP executor is active in the Inngest serve client.
2. **Critical Action**: Map `daily-rollup`, `hourly-rollup`, `status-rollup`, `quota-check`, and `memory-consolidation` to their respective cron intervals inside the `CRON_ROUTES` map of `inject-scheduled-handler.mjs`.
3. **Clean Up**: Remove the deprecated `videoScripting` and `video_jobs` functions from `src/forest/inngest/functions/index.ts` to avoid confusion.

---

## 5. Verification Method
- **Test Command**: Run `npm run ci:test` to verify type safety and ensure that the test suites pass.
- **Injected Routes Check**: Run `node scripts/inject-scheduled-handler.mjs` and inspect the output logs to check if the route maps parse correctly.
- **API Endpoint Verification**: Send an authenticated GET request with the correct Bearer token to `/api/cron/status-rollup` to verify that the table aggregates and purges successfully.
