# Recon 04 — Section 7: Event / Orchestration Audit

## 1. Event Key Inventory

### Canonical Events Record (43 keys)

Defined at `src/seed/inngest/event-types.ts:250-294`:

| # | Event Key | Type |
|---|---|---|
| 1 | `campaign.created` | Campaign |
| 2 | `campaign.progress` | Campaign |
| 3 | `test/hello.world` | Test |
| 4 | `key.rotation.requested` | Security |
| 5 | `url_revenue.video.requested` | Revenue |
| 6 | `video.requested` | Video |
| 7 | `video.script.ready` | Video |
| 8 | `video.tts.ready` | Video |
| 9 | `video.visual.ready` | Video |
| 10 | `video.composed` | Video |
| 11 | `video.uploaded` | Video |
| 12 | `video.published` | Video |
| 13 | `publish.scheduled` | Publish |
| 14 | `publish.token.refresh` | Publish |
| 15 | `video/generate.requested` | Video |
| 16 | `batch/video.fanout` | Video |
| 17 | `sop/execution.requested` | SOP |
| 18 | `sop/step.completed` | SOP |
| 19 | `repurpose/analyze.requested` | Repurpose |
| 20 | `repurpose/clip.generate` | Repurpose |
| 21 | `analytics/sync.requested` | Analytics |
| 22 | `conversion.created` | Commerce |
| 23 | `distribution/plan.created` | Distribution |
| 24 | `commission.matured` | Payout |
| 25 | `revenue/event.recorded` | Revenue |
| 26 | `commerce/payment.confirmed` | Commerce |
| 27 | `payout.batched` | Payout |
| 28 | `payout.confirmed` | Payout |
| 29 | `payout.reconcile.alert` | Payout |
| 30 | `creative-memory/signal-accumulated` | Creative Memory |
| 31 | `youtube.content.pipeline.requested` | YouTube |
| 32 | `agent.mission.started` | Agent |
| 33 | `agent.approval.requested` | Agent |
| 34 | `agent.approval.resolved` | Agent |
| 35 | `agent.mission.completed` | Agent |
| 36 | `agent.mission.failed` | Agent |
| 37 | `production.graph.started` | Production |
| 38 | `production.graph.completed` | Production |
| 39 | `production.graph.failed` | Production |
| 40 | `production.graph.cancelled` | Production |
| 41 | `creative/image.requested` | Creative |
| 42 | `creative/image.completed` | Creative |
| 43 | `creative/image.failed` | Creative |

---

## 2. Inngest Function Registry

### Registered Functions (40 functions served)

From `src/app/api/inngest/route.ts:50-108`:

| # | Function ID | Trigger | Type |
|---|---|---|---|
| 1 | `hello-world` | `test/hello.world` | Event |
| 2 | `generate-campaign` | `campaign.created` | Event |
| 3 | `auto-discover-affiliates` | cron | Cron |
| 4 | `publish-execute` | `publish.scheduled` | Event |
| 5 | `publish-token-refresh-cron` | cron | Cron |
| 6 | `conversion-to-ledger` | `conversion.created` | Event |
| 7 | `pending-promoter-cron` | cron | Cron |
| 8 | `payout-batcher` | cron | Cron |
| 9 | `reconciliation-cron` | cron | Cron |
| 10 | `offer-sync-cron` | cron | Cron |
| 11 | `storage-tracker-daily` | cron | Cron |
| 12 | `account-delete-finalize-cron` | cron | Cron |
| 13 | `video-generate` | `video/generate.requested` | Event |
| 14 | `batch-video-fanout` | `batch/video.fanout` | Event |
| 15 | `repurpose-analyze` | `repurpose/analyze.requested` | Event |
| 16 | `repurpose-clip-generate` | `repurpose/clip.generate` | Event |
| 17 | `analytics-sync` | `analytics/sync.requested` | Event |
| 18 | `token-refresh-cron` | cron | Cron |
| 19 | `thumbnail-ab-selector` | cron | Cron |
| 20 | `variant-ab-selector` | cron | Cron |
| 21 | `ab-winner-picker-cron` | cron | Cron |
| 22 | `sop-execute` | `sop/execution.requested` | Event |
| 23 | `performance-aggregation-cron` | cron | Cron |
| 24 | `experiment-feedback-cron` | cron | Cron |
| 25 | `learning-velocity-cron` | cron | Cron |
| 26 | `strategy-feedback` | `creative-memory/signal-accumulated` | Event |
| 27 | `pattern-detection-cron` | cron | Cron |
| 28 | `auto-apply-monitor` | cron | Cron |
| 29 | `youtube-content-pipeline` | `youtube.content.pipeline.requested` | Event |
| 30 | `market-signals-ingest-cron` | cron | Cron |
| 31 | `agent-mission-executor` | `agent.mission.started` | Event |
| 32 | `agent-approval-handler` | `agent.approval.resolved` | Event |
| 33 | `agent-rollback-cron` | cron | Cron |
| 34 | `provenance-bridge` | `agent.mission.completed` | Event |
| 35 | `production-graph-runner` | `production.graph.started` | Event |
| 36 | `approval-timeout-cron` | cron | Cron |

**Note:** 40 functions served, but 52 files in `forest/inngest/functions/`. The remaining 12 files are helpers, utilities, or deprecated (e.g., `video-generate-helpers.ts`, `video-generate-poll.ts`, `video-generate-tts.ts`, `video-generate-visual.ts`, `account-delete-finalize-email.ts`, `agent-mission-lifecycle.ts`, `agent-context.ts`, `key-rotation-cron.ts`).

---

## 3. Event Topology Map

### Video Pipeline (5-step chain)

```
video.requested → video-scripting → video.script.ready
    → video-tts → video.tts.ready
    → video-visual → video.visual.ready
    → video-compose → video.composed
    → video-upload → video.uploaded
    → video-publish → video.published
```

**Evidence:**
- `video-scripting.ts:81` — trigger `video.requested`, emits `video.script.ready`
- `video-tts.ts:64` — trigger `video.script.ready`, emits `video.tts.ready`
- `video-visual.ts:65` — trigger `video.tts.ready`, emits `video.visual.ready`
- `video-compose.ts:62` — trigger `video.visual.ready`, emits `video.composed`
- `video-upload.ts:27` — trigger `video.composed`, emits `video.uploaded`
- `video-publish.ts:32` — trigger `video.uploaded`, emits `video.published`

**Status:** Complete chain. All 6 steps wired.

---

### Creative Image Pipeline (1-step)

```
creative/image.requested → creative-image-generate
    → creative/image.completed (success)
    → creative/image.failed (failure)
```

**Evidence:** `creative-image-generate.ts:197` — trigger `creative/image.requested`, emits `.completed` or `.failed`

---

### Agent Mission Loop

```
agent.mission.started → agent-mission-executor
    → agent.mission.completed (success) → provenance-bridge
    → agent.mission.failed (failure)
    → agent.approval.requested → agent-approval-gate
    → agent.approval.resolved → agent-approval-handler
```

**Evidence:**
- `agent-mission-executor.ts:55` — trigger `agent.mission.started`
- `agent-mission-lifecycle.ts:32` — emits `agent.mission.completed`
- `agent-mission-lifecycle.ts:40` — emits `agent.mission.failed`
- `agent-approval-gate.ts:47` — trigger `agent.approval.resolved`
- `agent-approval-handler.ts:36` — trigger `agent.approval.resolved`
- `provenance-bridge.ts:65` — trigger `agent.mission.completed`

**Note:** Two handlers trigger on `agent.approval.resolved` — `agent-approval-gate` and `agent-approval-handler`. This is intentional: gate handles the approval decision, handler processes the outcome.

---

### Production Graph

```
production.graph.started → production-graph-runner
    → production.graph.completed (success)
    → production.graph.failed (failure)
    → production.graph.cancelled (cancel)
```

**Evidence:** `production-graph-runner.ts:148` — trigger `production.graph.started`, emits completed/failed/cancelled via `step.sendEvent`

---

### Commerce / Payout Flow

```
commerce/payment.confirmed → commerce-fulfillment
conversion.created → conversion-to-ledger
payout.batched → (payout-batcher cron)
payout.confirmed → (reconciliation cron)
payout.reconcile.alert → (reconciliation cron)
```

---

### Distribution Flow

```
distribution/plan.created → distribution-fanout
```

---

### SOP Flow

```
sop/execution.requested → sop-execute
sop/step.completed → (internal step completion)
```

---

### YouTube Flow

```
youtube.content.pipeline.requested → youtube-content-pipeline
```

---

### Campaign Flow

```
campaign.created → generate-campaign
    → FIRST_VIDEO_STARTED (internal)
    → FIRST_VIDEO_COMPLETED (internal)
    → CAMPAIGN_PUBLISHED (internal)
```

**Evidence:** `generate-campaign.ts:241,280,367` — emits internal campaign events

---

### Repurpose Flow

```
repurpose/analyze.requested → repurpose-analyze
repurpose/clip.generate → repurpose-clip-generate
```

---

### Revenue Flow

```
revenue/event.recorded → revenue-events-ingest
```

---

### Creative Memory Flow

```
creative-memory/signal-accumulated → strategy-feedback
```

---

### URL Revenue Flow

```
url_revenue.video.requested → url-revenue-video-handler
```

---

### Key Rotation Flow

```
key.rotation.requested → key-rotation-reencrypt
```

---

## 4. Cron Jobs (Inngest-native)

| Cron ID | Schedule | Location |
|---|---|---|
| `ab-winner-picker-cron` | `0 */6 * * *` (6h) | `ab-winner-picker-cron.ts:22` |
| `account-delete-finalize-cron` | `0 */6 * * *` (6h) | `account-delete-finalize-cron.ts:37` |
| `agent-rollback-cron` | `*/5 * * * *` (5min) | `agent-rollback-cron.ts:243` |
| `approval-timeout-cron` | cron | `approval-timeout-cron.ts:24` |
| `audience-analysis-cron` | cron | `audience-analysis-cron.ts:97` |
| `auto-apply-monitor` | cron | `auto-apply-monitor.ts:34` |
| `auto-discover-affiliates` | cron | `auto-discover-affiliates.ts:26` |
| `dlq-reaper` | `0 * * * *` (hourly) | `dlq-reaper.ts:23` |
| `experiment-feedback-cron` | `0 3 * * *` (daily 03:00) | `experiment-feedback-cron.ts:75` |
| `learning-velocity-cron` | cron | `learning-velocity-cron.ts` |
| `market-signals-ingest-cron` | cron | `market-signals-ingest-cron.ts` |
| `offer-sync-cron` | `0 * * * *` (hourly) | `forest/jobs/offer-sync-cron.ts:106` |
| `pattern-detection-cron` | cron | `pattern-detection-cron.ts` |
| `payout-batcher` | `0 12 * * 0` (weekly Sun) | `forest/jobs/payout-batcher.ts:40` |
| `pending-promoter-cron` | `0 2 * * *` (daily 02:00) | `forest/jobs/pending-promoter-cron.ts:22` |
| `performance-aggregation-cron` | cron | `performance-aggregation.ts` |
| `publish-token-refresh-cron` | cron | `publish-token-refresh-cron.ts` |
| `reconciliation-cron` | `0 4 * * *` (daily 04:00) | `forest/jobs/reconciliation.ts:74` |
| `storage-tracker-daily` | `0 3 * * *` (daily 03:00) | `forest/quota/storage-tracker-cron.ts:113` |
| `thumbnail-ab-selector` | cron | `thumbnail-ab-selector.ts:15` |
| `token-refresh-cron` | cron | `token-refresh-cron.ts:6` |
| `variant-ab-selector` | cron | `variant-ab-selector.ts:15` |

**Total: 22 Inngest-native cron jobs**

---

## 5. HTTP Cron Routes (Cloudflare Workers)

From `src/app/api/cron/` — 30+ routes. These are NOT Inngest functions; they are HTTP endpoints triggered by Cloudflare Workers cron triggers (configured in `wrangler.toml`).

| Route | Purpose |
|---|---|
| `cron/ab-winner-picker` | A/B winner selection |
| `cron/affiliate-scout` | Affiliate discovery |
| `cron/agent-cost-overrun-scan` | Cost overrun detection |
| `cron/billing-anomaly-scan` | Billing anomaly detection |
| `cron/circuit-breaker-scan` | Circuit breaker health |
| `cron/clearance-promote` | Clearance promotion |
| `cron/creative-quality-drift-scan` | QA drift detection |
| `cron/d1-backup` | Database backup |
| `cron/daily-rollup` | Daily aggregation |
| `cron/distribution-pipeline-scan` | Distribution scan |
| `cron/dlq-retry` | Dead letter queue retry |
| `cron/dunning-advance` | Dunning advancement |
| `cron/email-drip` | Email drip campaigns |
| `cron/email-outbox-flush` | Email outbox flush |
| `cron/error-digest` | Error digest |
| `cron/fulfillment-reconcile` | Fulfillment reconciliation |
| `cron/fulfillment-retry` | Fulfillment retry |
| `cron/handover-status-sync` | Handover sync |
| `cron/hash-chain-verification` | Hash chain verification |
| `cron/heartbeat` | Heartbeat check |
| `cron/hourly-rollup` | Hourly aggregation |
| `cron/llm-cache-purge` | LLM cache purge |
| `cron/mcu-monthly-reset` | MCU quota reset |
| `cron/memory-consolidation` | Memory consolidation |
| `cron/mission-abandon-scan` | Abandoned mission scan |
| `cron/mission-reaper` | Mission cleanup |
| `cron/onboarding-check` | Onboarding check |
| `cron/pending-orders-cleanup` | Order cleanup |
| `cron/promo-cleanup` | Promo cleanup |
| `cron/promo-trial-expiry` | Trial expiry |
| `cron/quota-check` | Quota check |
| `cron/reset-quotas` | Quota reset |
| `cron/scheduled-campaigns` | Campaign scheduling |
| `cron/slo-burn-rate` | SLO burn rate |
| `cron/smoke-one-time` | One-time smoke test |
| `cron/sop-scheduler` | SOP scheduling |
| `cron/status-rollup` | Status rollup |
| `cron/subscription-reminders` | Subscription reminders |
| `cron/uptime-check` | Uptime check |
| `cron/video-status-sync` | Video status sync |
| `cron/wallet-rebuild` | Wallet rebuild |
| `cron/weekly-signals-digest` | Weekly signals |
| `cron/workflow-stepper` | Workflow stepper |

**Total: ~43 HTTP cron routes**

---

## 6. Webhook Endpoints

From `src/app/api/webhooks/`:

| Endpoint | Provider |
|---|---|
| `webhooks/telegram` | Telegram Bot |
| `webhooks/nowpayments` | NOWPayments IPN |
| `webhooks/nowpayments-payout` | NOWPayments Payout |
| `webhooks/payos` | PayOS (VN backup) |
| `webhooks/clickbank` | ClickBank |
| `webhooks/awin` | Awin |
| `webhooks/amazon` | Amazon Associates |
| `webhooks/accesstrade` | Accesstrade |
| `webhooks/heygen` | HeyGen video |
| `webhooks/stripe-connect` | Stripe Connect |
| `webhooks/tiktok-shop` | TikTok Shop |
| `webhooks/tiktok-notification` | TikTok notifications |
| `webhooks/youtube-notification` | YouTube notifications |
| `webhooks/overage-billing` | Overage billing |

**Total: 14 webhook endpoints**

---

## 7. Orphan Events (Defined but No Handler)

| Event Key | Defined At | Handler |
|---|---|---|
| `campaign.progress` | `event-types.ts:43-51` | NONE — no Inngest function triggers on this |
| `video.published` | `event-types.ts:262` | NONE — terminal event, no downstream handler |
| `publish.token.refresh` | `event-types.ts:264` | `publish-token-refresh-cron` (cron, not event) |
| `payout.batched` | `event-types.ts:277` | NONE — emitted by payout-batcher, no consumer |
| `payout.confirmed` | `event-types.ts:278` | NONE — terminal event |
| `payout.reconcile.alert` | `event-types.ts:279` | NONE — emitted by reconciliation, no consumer |
| `sop/step.completed` | `event-types.ts:268` | NONE — internal step signal |
| `agent.approval.requested` | `event-types.ts:283` | NONE — emitted by agent-approval-gate, consumed via step.sendEvent (internal) |
| `key.rotation.requested` | `event-types.ts:254` | `key-rotation-reencrypt` (registered in index.ts) |

**Note:** Some "orphan" events are intentional terminal events (e.g., `video.published`, `payout.confirmed`). Others like `campaign.progress` are emitted for SSE streaming, not for Inngest handlers.

---

## 8. Duplicate / Overlapping Handlers

| Event | Handlers | Status |
|---|---|---|
| `agent.approval.resolved` | `agent-approval-gate` + `agent-approval-handler` | INTENTIONAL — gate makes decision, handler processes outcome |
| `video.requested` | `video-scripting` (Inngest) + HTTP cron routes | SEPARATE PATHS — Inngest for event-driven, cron for scheduled |
| DLQ retry | `dlq-reaper` (Inngest cron) + `cron/dlq-retry` (HTTP route) | DUPLICATE — two mechanisms for same purpose |

**Issue:** DLQ retry has dual implementation:
- Inngest cron: `dlq-reaper.ts:23` — runs hourly
- HTTP route: `cron/dlq-retry/route.ts` — separate implementation

This is a maintenance risk: two code paths for the same business logic.

---

## 9. Dead Handlers (Registered but No Sender)

| Function | Trigger | Sender |
|---|---|---|
| `hello-world` | `test/hello.world` | NONE in production code — test-only |
| `account-delete-finalize-email` | N/A | Utility function, not a registered Inngest function |

---

## 10. Hidden Synchronous Dependencies

| Dependency | Location | Risk |
|---|---|---|
| `generateImageAction` (Server Action) | `app/actions/image-generate-action.ts:82` | Synchronous MuAPI call in request path — blocks HTTP response |
| `media_jobs` INSERT | `app/actions/image-generate-action.ts:91` | Synchronous D1 write in request path |
| `submitMediaJob` | `tree/clients/muapi-media-client.ts` | External HTTP in synchronous Server Action |

**Issue:** `generateImageAction` makes a synchronous external HTTP call to MuAPI during the HTTP request. This violates the Inngest pattern (long-running work should be offloaded to Inngest). If MuAPI is slow or down, the HTTP request fails.

---

## 11. Duplicated Orchestration

| Pattern | Locations | Issue |
|---|---|---|
| Video generation | `video-generate.ts` (Inngest) + `generate-campaign.ts` (Inngest) + `campaign-orchestrator.ts` (land) | Three orchestrators for video — overlapping scope |
| Cron triggers | Inngest-native cron (22) + HTTP cron routes (43) | Two cron systems — different trigger mechanisms, potential timing conflicts |
| DLQ retry | `dlq-reaper.ts` (Inngest) + `cron/dlq-retry/route.ts` (HTTP) | Same logic, two implementations |

---

## 12. Simplified Event Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SENDERS (Actions / Webhooks / Cron)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  land/creative-mission/actions.ts  → agent.mission.started                  │
│  land/creative-mission/actions.ts  → agent.approval.resolved                │
│  land/campaigns/create-campaign-core.ts → campaign.created                  │
│  land/commerce/commerce-payment.ts → commerce/payment.confirmed             │
│  land/video/generation/video-job-pipeline.ts → video/generate.requested     │
│  land/youtube/actions.ts → youtube.content.pipeline.requested               │
│  app/actions/batch-generate-action.ts → batch/video.fanout                  │
│  app/actions/analytics-action.ts → analytics/sync.requested                 │
│  app/actions/repurpose-action.ts → repurpose/analyze.requested              │
│  app/api/webhooks/* → various commerce/webhook events                       │
│  app/api/admin/keys/rotate → key.rotation.requested                         │
│  app/api/webhooks/nowpayments-payout → payout events                        │
│  app/api/v1/missions/[id]/generate-video → video/generate.requested         │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INNGEST FUNCTIONS (Event Handlers)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ AGENT LOOP      │    │ VIDEO PIPELINE  │    │ CREATIVE CELL   │         │
│  │                 │    │                 │    │                 │         │
│  │ mission.started │    │ video.requested │    │ image.requested │         │
│  │       ↓         │    │       ↓         │    │       ↓         │         │
│  │ executor        │    │ scripting       │    │ generate        │         │
│  │       ↓         │    │       ↓         │    │       ↓         │         │
│  │ mission.done    │    │ tts             │    │ image.completed │         │
│  │       ↓         │    │       ↓         │    │     OR          │         │
│  │ provenance      │    │ visual          │    │ image.failed    │         │
│  │                 │    │       ↓         │    │                 │         │
│  │ approval.resolved│   │ compose         │    └─────────────────┘         │
│  │       ↓         │    │       ↓         │                                │
│  │ gate + handler  │    │ upload          │    ┌─────────────────┐         │
│  │                 │    │       ↓         │    │ PRODUCTION      │         │
│  └─────────────────┘    │ publish         │    │                 │         │
│                         │                 │    │ graph.started   │         │
│  ┌─────────────────┐    └─────────────────┘    │       ↓         │         │
│  │ CAMPAIGN        │                           │ runner          │         │
│  │                 │    ┌─────────────────┐    │       ↓         │         │
│  │ campaign.created│    │ SOP             │    │ graph.done      │         │
│  │       ↓         │    │                 │    └─────────────────┘         │
│  │ generate-       │    │ sop.requested   │                                │
│  │ campaign        │    │       ↓         │    ┌─────────────────┐         │
│  └─────────────────┘    │ sop-execute     │    │ COMMERCE        │         │
│                         └─────────────────┘    │                 │         │
│  ┌─────────────────┐                           │ payment.confirmed│        │
│  │ YOUTUBE         │    ┌─────────────────┐    │       ↓         │         │
│  │                 │    │ REPURPOSE       │    │ fulfillment     │         │
│  │ youtube.requested│   │                 │    └─────────────────┘         │
│  │       ↓         │    │ analyze.requested│                               │
│  │ pipeline        │    │       ↓         │                                │
│  └─────────────────┘    │ clip.generate   │                                │
│                         └─────────────────┘                                │
│  ┌─────────────────┐                                                       │
│  │ DISTRIBUTION    │    ┌─────────────────┐    ┌─────────────────┐         │
│  │                 │    │ REVENUE         │    │ CREATIVE MEMORY │         │
│  │ plan.created    │    │                 │    │                 │         │
│  │       ↓         │    │ revenue.recorded│    │ signal-accum    │         │
│  │ fanout          │    │       ↓         │    │       ↓         │         │
│  └─────────────────┘    │ ingest          │    │ strategy-feed   │         │
│                         └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CRON JOBS (22 Inngest + 43 HTTP)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Inngest-native:                                                            │
│    agent-rollback (5min)  ab-winner (6h)  experiment-feedback (daily)       │
│    pattern-detection      learning-velocity  performance-aggregation         │
│    market-signals         auto-apply-monitor  audience-analysis              │
│    dlq-reaper (hourly)    offer-sync (hourly)  token-refresh                │
│    storage-tracker (daily)  reconciliation (daily)  payout-batcher (weekly) │
│    pending-promoter (daily)  account-delete (6h)  approval-timeout          │
│                                                                             │
│  HTTP Routes (Cloudflare Workers cron):                                     │
│    43 routes — billing, quota, fulfillment, email, backup, monitoring       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Retry Mechanisms

| Mechanism | Location | Config |
|---|---|---|
| Inngest function-level | `creative-image-generate.ts:196` | `retries: 3` |
| Internal retry loop | `creative-image-generate.ts:~130-170` | `MAX_RETRIES = 3`, exponential backoff |
| Agent rollback | `agent-rollback-cron.ts:243` | `*/5 * * * *` cron + per-row backoff |
| DLQ retry | `dlq-reaper.ts:23` + `cron/dlq-retry/route.ts` | Hourly cron |
| Fulfillment retry | `cron/fulfillment-retry/route.ts` | HTTP cron |
| Step memoization | Inngest built-in | `step.run` memoization prevents re-execution |

**Issue:** Dual retry layers in `creative-image-generate.ts` (Inngest + internal) — redundant but safe due to idempotency.

---

## Summary

```
SECTION 7 — EVENT / ORCHESTRATION TOPOLOGY
═══════════════════════════════════════════════════════════════════
Event keys (canonical):        43 defined in event-types.ts
Inngest functions (files):     52 in forest/inngest/functions/
Inngest functions (served):    40 registered in route.ts
Inngest cron jobs:             22
HTTP cron routes:              ~43
Webhook endpoints:             14

Orphan events (no handler):    9 (mostly terminal events — intentional)
Duplicate handlers:            1 intentional (approval.resolved)
Dead handlers:                 1 (hello-world — test only)
Hidden sync dependencies:      1 (generateImageAction — sync MuAPI call)
Duplicated orchestration:      3 areas (video, cron, DLQ retry)

Key Findings:
  1. Video pipeline is complete (6-step chain, all wired)
  2. Agent mission loop is closed (executor → approval → provenance)
  3. Creative Cell V1 is single-step (image only, no edit)
  4. generateImageAction violates Inngest pattern (sync external HTTP)
  5. DLQ retry has dual implementation (Inngest + HTTP cron)
  6. Two cron systems (Inngest + Cloudflare Workers) — maintenance risk
  7. campaign.progress is SSE-only, no Inngest consumer
  8. payout.batched/payout.confirmed are terminal events (no consumer)

Architecture Health:
  ✅ Event contract is canonical (single source of truth)
  ✅ All event keys are typed (TypeScript union)
  ✅ Idempotency is handled at handler level
  ⚠️  Two cron systems create maintenance burden
  ⚠️  Synchronous external calls in Server Actions
  ⚠️  DLQ retry duplicated across two implementations
```
