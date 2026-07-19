# Telemetry + Cost-Attribution Infrastructure Inventory
**Sophia AI Factory — Brainstorm Phase 2 Evidence**  
**Date:** 2026-07-14  
**Scope:** All code under `apps/sophia-ai-factory/src/` + `apps/sophia-ai-factory/migrations/`

---

## 1. Usage Events / Cost Tracking

### 1.1 D1 Tables That Log Usage or Cost

| Table | Migration | Purpose | Column Highlights |
|-------|-----------|---------|-------------------|
| `signals_events` | `0005` | Founder-owned ops telemetry (source of truth for weekly digest) | `ts`, `event_type`, `actor`, `org_id`, `props_json` |
| `usage_events` | `0091` | Per-request API usage log (RAAS gateway) | `user_id`, `license_key_hash`, `service_name`, `endpoint`, `action`, `tokens_input/output`, `credits_used`, `model_name`, `tier_at_request`, `status_code`, `response_time_ms`, `idempotency_key` |
| `usage_log` | _legacy (`0001`)_ | Old RaaS usage table | `agency_id`, `sub_tenant_id`, `credits_used`, `job_type`, `job_id`, `created_at` |
| `video_jobs` | `0031` (app D1) | Video pipeline job state | `tenant_id`, `user_id`, `status`, `prompt`, `cost_usd`, `created_at`, `updated_at` |
| `video_cost_log` | `0031` (app D1) | Per-stage cost ledger | `job_id`, `stage`, `provider`, `units`, `cost_usd`, `recorded_at` |
| `video_usage_monthly` | `0033` (app D1) | Per-user monthly video quota counter | `user_id`, `year_month`, `count` |
| `user_mcu_balance` | `0053` | MCU credit balance tracking | `user_id`, `credits_remaining`, `credits_total_purchased`, `credits_total_used` |
| `mcu_transactions` | `0053` | MCU transaction ledger | `id`, `user_id`, `delta`, `reason`, `mission_id`, `metadata`, `created_at` |
| `tenant_storage_usage` | `0034` | Storage usage by tenant | `tenant_id`, `total_bytes`, `video_count`, `last_calculated_at` |
| `pipeline_checkpoints` | `0202` | Inngest pipeline stage checkpoints | `tenant_id`, `pipeline_id`, `stage`, `status`, `artifacts_json`, `error`, `metadata_json` |
| `pipeline_decision_logs` | `0202` | Append-only decision audit per pipeline | `tenant_id`, `pipeline_id`, `decision_id`, `decision_type`, `payload_json` |
| `agency_credit_ledger` | `0220` | Agency credit accounting | `agency_id`, `sub_tenant_id`, `credits_used`, `job_type`, `job_id` |
| `engagement_metrics` | `0223` | Social media engagement collector output | `channel`, `hour_of_day`, `day_of_week`, normalized metrics |
| `pending_topups` | `0207` | Pending MCU top-up invoices | `user_id`, `invoice_id`, `mcu_amount`, `price_cents`, `status` |
| `raas_api_usage` | `0001` (legacy root) | Per-request RaaS API log | linked via `raas_api_keys` |
| `webhooks` / `hook_registry` | `0037` | Webhook delivery tracking | `webhook_id`, `status`, `response`, `attempts` |

### 1.2 Cost-Attribution Code

**Key files:**
- `forest/telemetry/d1-event-types.ts` — 34 D1 event types with Zod schemas (whitelist safety)
- `forest/telemetry/event-types.ts` — 19 PostHog event types (client-safe + server-only split)
- `forest/telemetry/posthog-capture.ts` — Server-side PostHog capture with PII scrub
- `forest/telemetry/track.ts` — D1 signal emitter
- `land/video/templates/cost-ledger.ts` — `recordCost()` inserts into `video_cost_log` + bumps `video_jobs.cost_usd`
- `land/video/publishing/path-a-template.ts` — Template path: hardcoded cost estimate (~$0.25 avg)
- `land/video/publishing/path-b-cinematic.ts` — Cinematic path: hardcoded HunyuanVideo cost (~$8.0 est.)
- `land/observability/cost-snapshot.ts` — Admin cost dashboard: global/tenants by stage + provider
- `land/observability/api-key-usage-stats.ts` — Per-RAAS-key request count, error rate, latency
- `land/billing/usage-aggregator.ts` — Hourly/daily/monthly overage detection + forecast
- `land/billing/overage-topup.ts` — MCU credit top-up via NOWPayments

### 1.3 What EXISTS vs What's MISSING for Per-Video Cost Tracking

**EXISTS:**
- `video_cost_log` columns: `job_id`, `stage`, `provider`, `units`, `cost_usd`, `recorded_at` — covers stage-level cost
- `video_jobs.cost_usd` — cumulative sum
- `land/observability/cost-snapshot.ts` — admin dashboard with tenant + stage + provider breakdown
- `usage_events.credits_used` — tracks credits consumed per API call

**MISSING for per-video cost tracking:**
- No `video_id` FK in `usage_events` (only `user_id` — ties to user but not specific video)
- No `video_job_id` reference in `mcu_transactions` (only `mission_id` — mismatch: video_jobs.id != mission_id)
- `video_cost_log` lacks `tenant_id` column (joins through `video_jobs` to get tenant)
- No aggregated "cost per video by model/provider" table in D1 — requires join of `video_cost_log` -> `video_jobs` -> `video_cost_log` again
- No cost attributed to OUTBOUND AI API costs (OpenRouter, ElevenLabs, etc.) — only internal pipeline stages
- No dollar-value column in `usage_events` for non-video API calls

**Gaps:**
- `cost_usd` in `video_jobs` and `video_cost_log` is cumulative per job, not per-stage unique — same stage may record multiple times (Inngest retries)
- No `video_id` → `usage_events` cross-reference for non-pipeline usage
- `signals_events.props_json` has `cost_usd` in `llm_call_trace` schema but no aggregate rollup for "cost per video"

---

## 2. Inngest Events

### 2.1 All Inngest Function Definitions

| Function ID | Event Trigger | Schedule | Status | Key Action |
|-------------|--------------|----------|--------|------------|
| `video-generate` | `video/generate.requested` | Event | **Active** | Full pipeline: TTS → Wan 2.1 → download → compose → escort_usage |
| `batch-video-fanout` | `batch/video.fanout` | Event | Active | Fan out batch CSV entries into individual generation events |
| `video-tts` | _(not shown — see below)_ | Event | Active | TTS generation step for Wave3+ paths |
| `video-visual` | _(not shown — see below)_ | Event | Active | Visual/scripting step for Wave3+ paths |
| `generate-campaign` | `campaign.created` | Event | **Active** | Full campaign orchestration (YouTube/TikTok/Telegram distribution) |
| `repurpose-analyze` | `repurpose/analyze.requested` | Event | Active | Scene detection + highlight scoring |
| `repurpose-clip-generate` | _(event)_ | Event | Active | Clip generation after analyze |
| `publish-execute` | `publish.scheduled` | Event | Active | Execute publishing workflow per channel |
| `conversion-to-ledger` | `conversion.created` | Event | Active | Affiliate commission → ledger (with VN PIT withholding) |
| `thumbnail-ab-selector` | _(event)_ | Event | Active | AB test thumbnail selection |
| `engagement-collector` | — | `cron: 0 * * * *` (hourly) | **Active** | Collect engagement_metrics from social channels |
| `token-refresh-cron` | — | `cron: 0 3 * * *` (daily 3am) | Active | Refresh expired platform_credentials tokens |
| `publish-token-refresh-cron` | — | `cron: 0 * * * *` (hourly) | Active | Refresh expiring publisher OAuth tokens |
| `account-delete-finalize-cron` | — | `cron: 0 */6 * * *` (every 6h) | Active | Finalize account deletion after 7-day cooldown |
| `auto-discover-affiliates` | — | `cron: 0 8 * * *` (daily 8am) | Active | Score affiliate programs, notify via Telegram |
| `analytics-sync` | — | `cron: 0 */12 * * *` (every 12h) | Active | YouTube analytics → video_analytics table |
| `dlq-reaper` | — | `cron: 0 * * * *` (hourly) | Active | Re-enqueue stale DLQ entries |
| `ab-winner-picker-cron` | — | _(cron)_ | Active | AB experiment winner selection |
| `key-rotation-reencrypt` | _(event)_ | Event | Active | Re-encrypt TOTP secrets |
| `key-rotation-cron` | — | `cron: 0 3 * * *` | Active | Key rotation scheduling |
| `url-revenue-video-handler` | _(event)_ | Event | Active | URL-to-revenue pipeline |
| `video-scripting` | `video.requested` | Event | **Deprecated** 2026-05-17 (ADR 0007) | video_jobs table never migrated to prod D1 |
| `video-compose` | `video.visual.ready` | Event | **Deprecated** 2026-05-17 | Same deprecation |
| `video-upload` | `video.composed` | Event | **Deprecated** 2026-05-17 | Same deprecation |
| `video-publish` | `video.uploaded` | Event | **Deprecated** 2026-05-17 | Same deprecation |
| `hello-world` | — | Event (not cron) | Active | Health check |

**Deprecated Wave functions (video-scripting, video-compose, video-upload, video-publish):**  
All marked `@deprecated 2026-05-17 (ADR 0007)`. Migration `0031` (`video_jobs`, `video_cost_log`) exists in app D1 but CLAUDE notes confirm "video_jobs table was never applied to prod D1." The **active** pipeline is `video-generate` (single Inngest function) which replaces all deprecated Wave functions.

### 2.2 Event Names Fired on Video Generation Lifecycle

The active pipeline (`video-generate`) fires these events:
- `video/generate.requested` — inbound trigger (entry point)
- `campaign.progress` — emitted via `inngest.send()` for SSE streaming (step: `scripting` → `tts` → `visual` → `compose` → `publish` → `complete` / `error`)
- `campaign.ready` (via `update-mission` step) — not an inngest event but triggers downstream

The deprecated Wave3 WSM pipeline fired these events:
- `video.requested`
- `video.script.ready`
- `video.visual.ready`
- `video.composed`
- `video.uploaded`
- `campaign.progress` (SSE)

**Gap:** No per-video `video/generate.completed` event is fired — the pipeline ends with `emitProgress('complete', 100)` and `recordCost()`. Downstream consumers (Telegram notifications, analytics) depend on `engine_mission` status polling instead of events. This means observability on "did the full pipeline succeed?" requires querying `engine_missions.status = 'succeeded'` rather than an event stream.

---

## 3. Observability Modules

### 3.1 Module Locations and Contents

**`land/observability/` (8 files, no `__tests__/` subfolder in listing):**
| File | Purpose |
|------|---------|
| `cost-snapshot.ts` | Global/tenant cost by stage + provider over time window |
| `api-key-usage-stats.ts` | Per-RAAS-key request volume, error rate, latency |
| `audit-log-stats.ts` | Admin audit log analytics |
| `cron-run-stats.ts` | Per-cron last execution status from `cron_run_log` |
| `email-outbox-stats.ts` | Email queue depth, delivery rates |
| `storage-usage-stats.ts` | Tenant storage consumption |
| `tenant-summary.ts` | One-shot 360 snapshot (user, storage, API keys, audit log) |
| `webhook-delivery-stats.ts` | Webhook endpoint delivery success/failure |

**`forest/telemetry/` (8 files + `digest/` subfolder):**
| File | Purpose |
|------|---------|
| `d1-event-types.ts` | 34 D1 signal event types + Zod schemas (founder-owned) |
| `event-types.ts` | 19 PostHog event types (client + server-only split) |
| `posthog-capture.ts` | Server-side PostHog capture with PII scrub |
| `track.ts` | D1 signal emitter (validates + inserts into `signals_events`) |
| `ab-experiment.ts` | AB experiment tracking |
| `auth-helper.ts` | Auth telemetry helpers |
| `experiments-registry.ts` | Experiment definitions |
| `feature-flags.ts` | Feature flag system |
| `digest/` | Weekly signals digest generation |

**`seed/observability/` (4 files + `telemetry/` subfolder):**
| File | Purpose |
|------|---------|
| `cron-check-in.ts` | Start/finish/fail cron heartbeat in `signals_events` |
| `sentry-forwarder.ts` | Forward structured errors to Sentry |
| `sentry-options.ts` | Sentry configuration |
| `telemetry/` | OpenTelemetry, Langfuse, LLM trace, log buffer, PII scrubber |

**`seed/telemetry/` (13 files):**
| File | Purpose |
|------|---------|
| `opentelemetry-setup.ts` | OpenTelemetry instrumentation bootstrap |
| `langfuse-client.ts` | Langfuse LLM observability client |
| `llm-trace.ts` | LLM call tracing |
| `log-buffer.ts` | Buffered log shipping |
| `pii-scrubber.ts` | PII redaction before log/trace emission |
| `safe-log.ts` | Safe logger (no sensitive data) |
| `track.ts` | Telemetry track primitive |
| `metrics.ts` | Metrics collection |
| `better-stack-client.ts` | Better Stack integration |
| `error-tracker.ts` | Error tracking |

### 3.2 What's Instrumented vs Uninstrumented

**Instrumented:**
- Video pipeline stages (TTS, visual, compose) → `recordCost()` → `video_cost_log`
- BYOK calls → `signals_events` (BYOK_CALL, BYOK_TIMEOUT)
- Payment flow → `signals_events` (TIER_CONVERSION, PAYMENT_SUCCESS, PAYMENT_FAILED) + `payment_events` atomic lock
- LLM calls → `signals_events` (LLM_CALL_TRACE) + Langfuse
- Campaign lifecycle → `signals_events` (WORKFLOW_STARTED/COMPLETED/FAILED) + PostHog
- Cron health → `cron_run_log` + `signals_events` (cron_check_in)
- RaaS API → `raas_api_usage` (per-key request + error + latency)
- Telegram bot → `signals_events` (agent_dispatch, agent_task_start/complete/fail)
- Affiliate conversions → `commission_events` → `commission_ledger`
- Prompt injection → `signals_events` (PROMPT_INJECTION_DETECTED)

**Uninstrumented:**
- **Per-video dollar cost in `signals_events`** — no event fires when cost is recorded. Cost only goes to `video_cost_log` (D1), not to D1 signals or PostHog.
- **User-facing analytics** — no dashboard page that shows "your videos cost $X this month" to customers (only admin cost-snapshot exists).
- **Video generation failure reasons** — `engine_missions.error` exists but no aggregation of WHY videos fail (Wan timeout? TTS error? etc.).
- **MOE (Message of the Entry) / dropout** — Setup Wizard steps logged to PostHog (WIZARD_STEP, WIZARD_COMPLETED) but no D1 signal.
- **Overage events** — `markEventsAsBillable()` exists but the flow from overage detection → user notification → top-up conversion is not instrumented with events.

---

## 4. Cron Jobs

### 4.1 All Cron Definitions

**Inngest Crons (declared in `forest/inngest/functions/`):**

| Cron | Schedule | What It Does |
|------|----------|-------------|
| `engagement-collector` | `0 * * * *` (hourly) | Collect engagement_metrics from social channels (youtube, tiktok, telegram, instagram, facebook). Max 50 rows/run. |
| `publish-token-refresh-cron` | `0 * * * *` (hourly) | Refresh expiring publisher OAuth tokens |
| `dlq-reaper` | `0 * * * *` (hourly) | Re-enqueue stale DLQ entries older than 1h |
| `token-refresh-cron` | `0 3 * * *` (daily 3am) | Refresh expired platform_credentials tokens |
| `key-rotation-cron` | _(via key-rotation-reencrypt)_ | Key rotation scheduling |
| `analytics-sync` | `0 */12 * * *` (every 12h) | YouTube analytics → video_analytics table |
| `account-delete-finalize-cron` | `0 */6 * * *` (every 6h) | Finalize account deletion after 7-day cooldown |
| `auto-discover-affiliates` | `0 8 * * *` (daily 8am) | Score affiliate programs, Telegram notification |
| `ab-winner-picker-cron` | `0 0 * * *` (daily midnight) | AB experiment winner selection |
| `hello-world` | _(manual trigger)_ | Health check |

**API Cron Routes (`app/api/cron/`):**

| Route | Schedule | What It Does |
|-------|----------|-------------|
| `dunning-advance` | Daily (via CF Cron Trigger) | Advances dunning states (past_due → suspended, delinquent → suspended) |
| `clearance-promote` | Daily midnight UTC | Promotes affiliate_conversions from `pending_clearance` → `available` after 60-day hold |
| `quota-check` | Daily (CF Cron Trigger) | Checks Cloudflare free-tier quota (workers requests, D1 reads/writes, R2 storage) |
| `mission-reaper` | _(cron)_ | Cleans up stale engine_missions |
| `email-outbox-flush` | _(cron)_ | Sends queued emails from email_outbox |
| `email-drip` | _(cron)_ | Sends drip sequence emails |
| `scheduled-campaigns` | _(cron)_ | Triggers scheduled campaign starts |
| `promo-trial-expiry` | _(cron)_ | Expires promo trial codes |
| `pending-orders-cleanup` | _(cron)_ | Cleans up stale pending_orders |
| `onboarding-check` | _(cron)_ | Checks if users completed onboarding |
| `fulfillment-retry` | _(cron)_ | Retries failed video fulfillments |
| `memory-consolidation` | _(cron)_ | Memory consolidation |
| `subscription-reminders` | _(cron)_ | Sends subscription renewal reminders |
| `d1-backup` | Daily | Dumps all user tables to SQL and uploads to R2 |
| `dlq-retry` | _(manual/cron)_ | Re-processes stale DLQ entries |
| `smoke-one-time` | _(cron)_ | Smoke test for one-time payments |
| `weekly-signals-digest` | Weekly | Delivers weekly AI-generated signals digest |
| `ab-winner-picker` | Daily | AB winner picking |

### 4.2 Which Crons Handle Expiry, Quota Rollover, Billing

| Concern | Cron / Mechanism | Details |
|----------|------------------|---------|
| **Quota rollover** | None found | No monthly MCU or video quota auto-rollover cron. `video_usage_monthly` table exists but no mechanism resets it at month boundary. |
| **Subscription expiry / dunning** | `dunning-advance` (daily) | Moves past_due → suspended after grace period |
| **Overage billing** | `usage-aggregator.ts` (on-demand, called per request) + `overage-topup.ts` | User-initiated top-up via NOWPayments, not automated |
| **Payment expiry** | NOWPayments IPN `expired` status → marks `pending_orders` expired | Handled in IPN handler, not a separate cron |
| **D1 backup** | `d1-backup` (daily) | R2 lifecycle (30d) is the de-facto backup strategy |
| **DLQ retry** | `dlq-retry` (route) + `dlq-reaper` (Inngest hourly) | NOWPayments IPN dead-letter queue |

**Critical gap:** No cron resets `video_usage_monthly` or `user_mcu_balance.credits_total_used` at billing period boundaries. Monthly resets must happen somewhere (likely in `handleFinished` when subscription activates) but there's no standalone month-rollover cron visible.

---

## 5. Protected Flows

### 5.1 NOWPayments IPN Handler

**File:** `land/billing/nowpayments-ipn-handlers.ts` (267 lines)  
**Route:** `app/api/webhooks/nowpayments/route.ts`  
**Entry point flow on `finished` status:**

1. `processNowPaymentsIpn()` acquires atomic lock via `INSERT INTO payment_events ... ON CONFLICT DO NOTHING`
2. Dispatches to `dispatchFinished()` which calls `handleFinished()` in `nowpayments-ipn-subscription.ts`
3. `handleFinished()`:
   - Validates underpayment (1% tolerance)
   - Audits overpayment (>1% expected)
   - Looks up tier by invoice ID (`NOWPAYMENTS_INVOICE_IDS` in tier-configs.ts)
   - Calls `activateSubscriptionForOrg()` — creates/updates subscriptions, sets period_end
   - Calls `runPostActivationWorkflow()`:
     - Creates onboarding video via `createOnboardingVideo()`
     - Triggers auto-handover (`triggerAutoHandover`)
     - Marks pending order as completed
     - Sends receipt email (`sendReceiptEmail`)
     - Enqueues welcome email
     - Dispatches refund if needed (promo codes)
4. Uses `d1.batch()` for atomic multi-table update
5. DLQ on failure → `nowpayments-ipn-dead-letter.ts` + `dlq-reaper` cron re-enqueues

**Refunds:** `dispatchRefunded()` calls refund processor, reconciles with commission ledger, adjusts `pending_orders`.

### 5.2 Setup Wizard Flow

**Component tree:** `tree/components/setup-wizard/` with 5 steps:  
`welcome-step` → `api-keys-step` → `provider-credentials-step` → `review-step` → `finish-step`

**API endpoints touched (from search results):**
- `POST /api/setup-wizard/save-credentials` — Encrypted credential storage (HE, HeyGen, OpenRouter, ElevenLabs, D-ID, Resend)
- `GET /api/setup-wizard/list-credentials` — List stored credentials (decrypted on demand)
- `POST /api/setup/save` — Setup config save
- `POST /api/setup/verify` — Verify API keys are valid
- `POST /api/setup/skip` — Skip wizard
- `POST /api/setup-wizard/save-credentials/test-{provider}` — Per-provider validation
- `POST /api/user/byok` — BYOK key management (save/test)
- `GET/POST /api/voice/clone` — Voice cloning (uses ElevenLabs)
- `POST /api/setup-wizard/heygen` — HeyGen-specific config
- `GET/POST /api/admin/keys/rotate` — Admin key rotation

**What it touches in the data layer:**
- Encrypts + stores API keys via credential manager
- Updates `user_profiles` onboarding state
- Fires `WIZARD_COMPLETED` PostHog event + `BYOK_CONFIGURED`

### 5.3 Telegram Bot Handlers

**Core file:** `tree/telegram/telegram-bot.ts` (menu dispatch)  
**Protected entry commands:**
- `/campaign` → `handleCampaign()` — creates video campaign (tier-gated via `TIER_RANK` check)
- `/status` → `handleStatus()` — shows campaign status
- `/results` → `handleResults()` — shows published video results
- `/subscribe` → `handleSubscribe()` — subscription checkout link
- `/discover` → `handleDiscover()` — affiliate discovery
- `/help` → `handleHelp()`

**Key constraint from `campaign-handler.ts`:** Campaign creation checks TIER_RANK — lower tier cannot create campaigns that higher tiers can. This is enforced server-side.

### 5.4 Entry Points New Code MUST NOT Break

| Flow | Risk Level | Critical files |
|------|-----------|-----------------|
| NOWPayments IPN → tier activation | **CRITICAL** | `land/billing/nowpayments-ipn-handlers.ts`, `nowpayments-ipn-subscription.ts`, `nowpayments-ipn-db.ts` |
| Setup Wizard credential save | **CRITICAL** | `app/api/setup-wizard/save-credentials/route.ts` |
| Telegram /campaign command | **HIGH** | `tree/telegram/handlers/campaign-handler.ts` |
| `/api/videos/generate` → Inngest `video/generate.requested` | **HIGH** | `app/api/videos/generate/route.ts` → `forest/inngest/functions/video-generate.ts` |
| Payment event atomic lock | **HIGH** | Uses `payment_events` table — any new billing code must use the same INSERT ON CONFLICT pattern |
| Checkout flow | **HIGH** | `app/api/checkout/route.ts`, `app/api/payments/one-time-checkout/route.ts` |
| Subscription state machine | **HIGH** | `land/billing/dunning/dunning-state-machine.ts` |

---

## 6. Tier / Feature System

### 6.1 Tier Config Location and Structure

**Canonical source:** `seed/config/tiers/tier-configs.ts` + `seed/config/tiers/unified-limits.ts`

**Tiers:** BASIC ($199/mo) | PREMIUM ($399/mo) | ENTERPRISE | MASTER (lifetime)

**`UnifiedTierLimits` interface** — the comprehensive limits object:
- `templates`, `campaignPerMonth`, `youtubeChannels` (video factory)
- `mcuMonthly`, `aiCommands`, `teamMembers`, `apiAccess`, `webhooks`, `customIntegrations`, `whiteLabel` (RaaS)
- `billingType` (monthly vs lifetime), `sopInstallLimit`, `yearlyPrice`

### 6.2 Feature Flags Per Tier (today)

| Feature Flag | BASIC | PREMIUM | ENTERPRISE | MASTER |
|--------------|-------|---------|------------|--------|
| `enable_affiliate_engine` | YES | YES | YES | YES (implied) |
| `enable_roi_calculator` | YES | YES | YES | YES (implied) |
| `enable_api_integrations` | NO | YES | YES | YES (implied) |
| `enable_admin_dashboard` | NO | NO | YES | YES (implied) |
| `enable_auto_update` | NO | NO | YES | YES (implied) |

**Feature gating mechanism:**
- `tierHasFeature(tier, feature)` in `tier-configs.ts` — checks `TIER_CONFIGS[tier].features.includes(feature)`
- Used by middleware + component-level guards
- `TIER_ALLOWED_VIDEO = ['PREMIUM', 'ENTERPRISE', 'MASTER']` — blocks BASIC from generating AI videos

### 6.3 How a New "Credits" Feature Slots In

**Pattern for adding a new feature:**
1. Add new string literal to `FeatureFlag` type in `seed/types/index.ts` (e.g., `"enable_credit_topup"` or `"enable_usage_analytics"`)
2. Add to `features` array in `TIER_CONFIGS` for eligible tiers in `tier-configs.ts`
3. Use `tierHasFeature(tier, 'your_new_feature')` in middleware/components
4. Update `UnifiedTierLimits` if numeric limits change (e.g., `mcuMonthly`, add `monthlyCreditTopupLimit`)

**For a credits/overage system specifically:**
- MCU credits already exist (`user_mcu_balance`, `mcu_transactions`, `TOPUP_PRICE_PER_MCU` constant)
- Overage detection already exists (`land/billing/usage-aggregator.ts`)
- Top-up flow already exists (`land/billing/overage-topup.ts`) — creates NOWPayments invoice
- **Missing:** No feature flag gates top-up; any user with credits can top-up
- **Missing:** No "credits remaining" visibility to users in UI (admin has `cost-snapshot`, customer has none)
- **Missing:** No expiration of purchased top-up credits (table `TOPUP_CREDIT_EXPIRY_DAYS` constant exists in overage-topup-types but no cron to apply it)

### 6.4 Existing Overage/Credit-Topup Code

| Module | Purpose |
|--------|---------|
| `land/billing/overage-topup.ts` | Create top-up invoice, process IPN, update balance |
| `land/billing/overage-topup-types.ts` | Types + constants (`TOPUP_PRICE_PER_MCU`, `TOPUP_CREDIT_EXPIRY_DAYS`) |
| `land/billing/usage-aggregator.ts` | Aggregate usage per billing period, detect overage |
| `land/billing/usage-aggregator-query.ts` | SQL queries for usage rollup (hourly/daily/monthly windows from `usage_events`) |
| `land/billing/usage-aggregator-analysis.ts` | Overage prediction, forecast, estimate |
| `seed/db/overage-billing-ops.ts` | `markEventsAsBillable()` — marks overage events as billed |
| `seed/kv/quota-cache-ops.ts` | `invalidateQuotaCache()` — KV cache invalidation on balance change |
| `migrations/0053-mcu-credits.sql` | `user_mcu_balance` + `mcu_transactions` tables |
| `migrations/0207_overage_topup.sql` | `pending_topups` + `topup_events` tables |

---

## Summary: What EXISTS, What's MISSING, What Needs Building

### EXISTS (Ready to Use)
1. **Stage-level cost ledger** — `video_cost_log` records per-stage USD costs; `cost-snapshot.ts` provides admin dashboards
2. **D1 signals layer** — 34 event types with Zod schemas, writes to `signals_events`
3. **PostHog capture** — Server-side with PII scrub + whitelist
4. **Usage events table** — `usage_events` with full per-request telemetry
5. **Inngest pipeline** — 20+ functions including video generation, publishing, engagement, DLQ reaping
6. **Tier system** — 4 tiers with feature flags (`tierHasFeature`), MCU limits, video limits
7. **NOWPayments IPN** — Atomic lock, DLQ, subscription activation, refund handling
8. **Setup Wizard** — 5-step BYOK credential onboarding with encrypted storage
9. **Telegram bot** — /campaign, /status, /results with tier gating
10. **Cron infrastructure** — 17+ cron routes + 10+ Inngest cron functions
11. **Usage aggregator** — Hourly/daily/monthly overage detection + forecast
12. **Top-up flow** — MCU credit purchase via NOWPayments (partially built)
13. **Observability stack** — Sentry, Langfuse, OpenTelemetry, Better Stack, PII scrubber

### MISSING (Gaps for Phase 2)

| # | Gap | Impact | Area |
|---|-----|--------|------|
| G1 | **No per-video cost aggregation for customers** | Customers cannot see "this video cost $X" | Customer UX |
| G2 | **No monthly quota rollover cron** | `video_usage_monthly` + MCU balances don't auto-reset | Billing |
| G3 | **No top-up credit expiry enforcement** | `TOPUP_CREDIT_EXPIRY_DAYS` constant exists but no cron applies it | Billing |
| G4 | **No cost event → PostHog/D1** | Cost recording is D1-only (no signal, no event) | Telemetry |
| G5 | **`usage_events` lacks `video_job_id`** | Cannot join usage events to specific videos for cost analysis | Data model |
| G6 | **`video_cost_log` lacks `tenant_id`** | Requires join through `video_jobs` to attribute | Data model |
| G7 | **No customer-facing billing analytics page** | Only admin sees cost snapshots | Customer UX |
| G8 | **`video_jobs` table not in prod D1** | Active pipeline uses `engine_missions` for output but `video_cost_log` may not receive writes | Infrastructure |
| G9 | **No pipeline completion event** | Downstream consumers poll `engine_missions.status` instead of subscribing to events | Architecture |
| G10 | **No "credits" feature flag** | Top-up is available to all users without tier gating | Feature gating |

### What Needs Building (Prioritized for L-Plan)

**P0 (Must-build for Phase 2 launch):**
- L1: Add `video_cost_log` write path in active `video-generate` Inngest function (verify it fires after ADR 0007 migration)
- L2: Add `video_job_id` column to `usage_events` (or maintain cross-reference table)
- L3: Monthly quota rollover cron (reset `video_usage_monthly` + `user_mcu_balance` where period ended)

**P1 (Should-build):**
- L4: Customer-facing "My Costs" page (read from `video_cost_log` + `mcu_transactions`)
- L5: Top-up credit expiry enforcement cron
- L6: `video/generate.completed` Inngest event (replace `engine_missions` polling)
- L7: `enable_credit_topup` feature flag + tier gating

**P2 (Nice-to-have):**
- L8: Cost event → PostHog/D1 signals bridge (fire `video_cost_recorded` signal)
- L9: Per-provider cost breakdown for BYOK (OpenRouter API costs in `video_cost_log`)
- L10: Video failure reason analytics dashboard

---

## Protected Flow Entry Points (DO NOT BREAK — Summary)

| Flow | Entry Point | What It Touches |
|------|------------|-----------------|
| NOWPayments IPN | `POST /api/webhooks/nowpayments` | `payment_events` (atomic lock), `subscriptions`, `pending_orders`, `user_mcu_balance`, onboarding, auto-handover |
| Setup Wizard | `POST /api/setup-wizard/save-credentials` | Encrypted credential store, `user_profiles` |
| Telegram Bot | Webhook → `tree/telegram/telegram-bot.ts` | `engine_missions`, `campaigns`, checkout redirect |
| Video Generation | `POST /api/videos/generate` | Inngest → `video-generate` → `recordCost()`, `engine_missions`, R2 |
| Checkout | `POST /api/checkout` | NOWPayments invoice, `pending_orders`, `subscriptions` |

---

## Key File References

| Area | Primary Files |
|------|--------------|
| D1 migrations (app) | `apps/sophia-ai-factory/migrations/0031`, `0033`, `0053`, `0091`, `0202`, `0207`, `0220`, `0221`, `0223` |
| Cost ledger | `apps/src/land/video/templates/cost-ledger.ts` |
| Cost snapshot | `apps/src/land/observability/cost-snapshot.ts` |
| Usage aggregator | `apps/src/land/billing/usage-aggregator.ts` |
| NOWPayments IPN | `apps/src/land/billing/nowpayments-ipn-handlers.ts`, `nowpayments-ipn-subscription.ts` |
| Overage top-up | `apps/src/land/billing/overage-topup.ts` |
| Tier config | `apps/src/seed/config/tiers/tier-configs.ts`, `unified-limits.ts` |
| Inngest functions | `apps/src/forest/inngest/functions/*.ts` (27 files) |
| D1 events | `apps/src/forest/telemetry/d1-event-types.ts` |
| PostHog | `apps/src/forest/telemetry/posthog-capture.ts`, `event-types.ts` |
| Telegram bot | `apps/src/tree/telegram/telegram-bot.ts`, `handlers/` |
| Setup Wizard | `apps/src/tree/components/setup-wizard/` |
| API crons | `apps/src/app/api/cron/*/route.ts` (17 routes) |
| Admin APIs | `apps/src/app/api/admin/*/route.ts` (93 routes) |
| OpenTelemetry | `apps/src/seed/observability/telemetry/opentelemetry-setup.ts` |
