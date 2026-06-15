# Phase 3 — AXIS 4: OBSERVABILITY Audit

**Date:** 2026-05-22
**Audit cycle:** Go-Live 100/100 (sophia-no-tech doctrine SUSPENDED — operator has provisioned Sentry, QStash, DMARC)
**Live anchors:** prod SHA `b8c4f6dd` · `@sentry/nextjs ^10.51.0` · OpenNext prod `1.17.3` (hardcoded `src/app/api/version/route.ts:33`) vs package `^1.19.5`

## Executive Summary

Honest observability score: **31.5 / 60**.

The chassis is wired (Sentry SDK init across 3 runtimes, structured logger module exists, Better Stack client coded, cron heartbeats use Sentry check-ins, alert runbook documented). But four load-bearing realities collapse the score:

1. **Logging pipeline is dead code.** `src/lib/telemetry/logger.ts` (Better Stack-shipping) has **0 production imports**. 595 source files use `@/seed/utils/logger-utility` which dispatches to `console.*` (`src/seed/utils/logger-internals.ts:129,144,147,150`) — i.e., logs land in CF Workers 7-day tail and nowhere else. Better Stack token defined but uningested.
2. **No metrics / APM.** Zero histograms, zero RED/USE instrumentation, zero p95/p99 tracking outside what Sentry Performance samples at 2-5%. No prometheus/otel export. CF Workers Analytics not surfaced.
3. **No distributed tracing across CF Worker → D1 → external APIs.** `tracesSampleRate` is set but no manual spans, no trace context propagation to D1 or to NOWPayments/OpenRouter/ElevenLabs HTTP calls.
4. **Alert rules + on-call documented but unverified live.** Runbook (`docs/handover/sentry-alerts-setup-runbook-260512.md`) describes 5 manual setup steps. No way to assert from repo that the alert rules are actually live in the Sentry project. No PagerDuty / Opsgenie integration; Slack webhook is the only fan-out per code.

35+ `console.*` in prod code (verified count after excluding tests + the logger-internals fallback: 36 raw + 4 legit logger fallbacks). OpenNext drift makes the `/api/version` payload lie about runtime version → corrupt release tag dimension in Sentry.

---

## Sub-Area 1: Error Tracking & Symbolication

**Score: 6.5 / 10**

### Evidence
- Sentry SDK init across 3 runtimes via thin wrappers — `sentry.client.config.ts:8-14`, `sentry.server.config.ts:8-12`, `sentry.edge.config.ts:8-12` — delegating to centralized `src/lib/observability/sentry-options.ts` (Round-11/Wave-10 dedup, good).
- Sample rates per `sentry-options.ts:154-233`: client `tracesSampleRate=0.02`, server/edge `0.05`, replays `replaysOnErrorSampleRate=1.0` (good), session replay `0.01`.
- PII stripping wired (`sentry-options.ts:107-120`, `buildBeforeBreadcrumb:124-147`) — strips token/secret/password/key/auth from extra + breadcrumb data; `BREADCRUMB_DATA_SAFELIST` for `mission_id`, `event_cursor`, `resume_cursor`.
- 4xx-drop rule (`sentry-options.ts:150-152`) — server-side noise filter, sensible.
- Cron-route tagging (`sentry-options.ts:184-195`) — `cron_route: <name>` dimension added to events whose URL matches `/api/cron/<name>` — enables filter-by-cron alert rules.
- SSE breadcrumb rate-sampling (`sentry-options.ts:80-104`) — well-designed: keep error-level + first-event-per-window per mission, then 10% sampling, hard cap 10/sec.
- Sourcemap upload script exists: `scripts/ci/sentry-upload-sourcemaps.sh` — uploads both `.next/` (client) and `.open-next/` (server) — invoked from `scripts/deploy-with-sha.sh:172-174`. **CONDITIONAL**: only runs if `SENTRY_AUTH_TOKEN` env is set at deploy time; deploy never blocks if absent. With doctrine suspended and operator provisioning the token, this should work — but no assertion in deploy log that upload actually succeeded (script exits 0 on failure: `sentry-upload-sourcemaps.sh:28-32`).
- Instrumentation hook (`instrumentation.ts:5-22`) — conditional runtime init, also installs usage-metering + overage shutdown handlers (good pattern).
- Sentry call sites in production code: only **8 grep hits** outside tests. That is thin — manual `captureException` is rare. Auto-instrumentation does most work.

### Gaps
1. **No post-deploy verification that sourcemaps actually uploaded.** `sentry-upload-sourcemaps.sh:35-46` swallows failures with `|| echo "warn: ..."`. Deploy log captures warn but no health probe confirms Sentry org has the release with maps. (Severity: **P1**)
2. **Release tag pollution from OpenNext drift.** `sentry-options.ts:13-19` builds release from `COMMIT_SHA` — correct. But `/api/version` returns hardcoded `OPENNEXT_VERSION = "1.17.3"` (`src/app/api/version/route.ts:33`) while `package.json:113` is `^1.19.5`. Operator/Sentry users may correlate to wrong OpenNext version when triaging. (Severity: **P1**)
3. **No instrumented PII regression test.** `sentry-options.test.ts` exists but a sample event with `token=xxx` flowing E2E from a handler is not asserted post-deploy. (Severity: **P2**)
4. **`@sentry/cli releases new` non-fatal failure** (`sentry-upload-sourcemaps.sh:23`) — if release creation fails silently, sourcemap upload runs but events never associate to release. (Severity: **P2**)

---

## Sub-Area 2: Logging Pipeline

**Score: 3 / 10**

### Evidence
- Two competing loggers exist:
  - **A. Console-only:** `src/seed/utils/logger-utility.ts` + `logger-internals.ts:129,144,147,150` — dispatches to `console.error/warn/debug/log`. **595 production import sites** (`grep -rln "from '@/seed/utils/logger-utility'" src | wc -l`).
  - **B. Better Stack-shipping:** `src/lib/telemetry/logger.ts:34-50` — buffers via `LogBuffer`, ships via `pushBatch` (`src/lib/telemetry/better-stack-client.ts:23-42`) to `https://in.logtail.com/`. **0 production import sites** (`grep -rln "from '@/lib/telemetry/logger'" src | wc -l` → 0).
- Better Stack code path only invoked from 3 cron routes for heartbeat/fatal-log (`src/app/api/cron/d1-backup/route.ts:21`, `src/app/api/cron/heartbeat/route.ts:16`, `src/app/api/cron/error-digest/route.ts:12`) — NOT the buffered batch path; only one-off `pushHeartbeat`/`pushFatalLog`.
- `BETTER_STACK_LOGS_TOKEN` env consumed at `lib/telemetry/logger.ts:18` but logger is never imported anywhere → token is dead config.
- Retention documented in `docs/runbooks/application-log-retention.md` — accurate inventory:
  - CF Workers runtime logs → 7-day CF default (free tier, cannot extend without paid plan)
  - Sentry errors → 30 days
  - BetterStack → 30 days (but only heartbeats reach it)
  - D1 `cron_runs` / `quota_alerts` tables → 90 days
- Logs are **structured JSON in production** per `logger-internals.ts` formatting — good when shipped, but they aren't shipped.

### Gaps
1. **Logging pipeline is fundamentally broken.** 595 files write structured JSON to `console.*`, which lands only in CF Workers tail (7 days, dev-only via `wrangler tail`). No log aggregator. No grep across deploys. No retention beyond 7d. (Severity: **P0**)
2. **Decision needed:** delete dead `lib/telemetry/logger.ts` OR migrate `seed/utils/logger-utility.ts` to call the Better Stack buffered path. With doctrine suspended, option B is mandatory. (Severity: **P0**)
3. **35+ raw `console.*` in production code** (`grep -rn "console\." src --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v ".test." | wc -l` → 36). Examples: `src/app/[locale]/welcome/[token]/welcome-page-client.tsx:80`, `src/app/api/health/cron-heartbeat/route.ts:104`, all `src/sdk/examples/*` (SDK examples are arguably fine; client-side welcome page is not). (Severity: **P1**)
4. **No log → trace correlation.** Structured logger has `requestId` binding (`logger-utility.ts:41`) but no Sentry trace ID propagated into log context. Can't pivot from a Sentry event to its log line. (Severity: **P1**)
5. **No log-level-based alerting.** No rule that says "5 fatal logs in 5 min → page". With Better Stack drain dead, this is impossible anyway. (Severity: **P1**)

---

## Sub-Area 3: Metrics & APM (RED/USE, p95/p99)

**Score: 2 / 10**

### Evidence
- Zero histograms, zero counters, zero gauges in source. Grep `histogram|prometheus|metric` in `src/**/*.ts` returns only RaaS gateway business metrics (`src/forest/raas-gateway-client.ts:89,97,111,119`) and affiliate leaderboards — no system metrics.
- `tracesSampleRate=0.02` (client) / `0.05` (server) per `sentry-options.ts:161,203,223` — Sentry Performance is sampled but with low rate, p95/p99 at the platform level are blind without a baseline metrics pipeline.
- Cloudflare Workers Analytics exists at CF dashboard level but no surfacing in code, no SLO doc, no error budget tracking.
- No `/api/metrics` endpoint, no prometheus scrape target, no OpenTelemetry exporter wired.
- D1 query timing: no instrumentation. `createServerClient()` from `seed/db/client` doesn't wrap with span timing.
- External API call timing (NOWPayments, OpenRouter, ElevenLabs, D-ID, Telegram, HeyGen): no consistent timing wrapper, no circuit-breaker metrics surfaced.

### Gaps
1. **No RED metrics** (Rate, Errors, Duration) per route or per external dependency. Cannot answer "what is the p95 of `/api/cron/d1-backup`?" without scraping Sentry samples. (Severity: **P1**)
2. **No USE metrics** (Utilization, Saturation, Errors) for D1 connection-saturation, R2 throughput, KV-key cardinality. (Severity: **P2**)
3. **No SLO definition.** No error budget. No burn-rate alerts. Score `phase3-axis2-scalability.md` cited 5.8/10 for scalability — without metrics that score is unfalsifiable. (Severity: **P1**)
4. **No CF Workers Analytics ingestion into the platform.** Operator must alt-tab to CF dashboard. (Severity: **P2**)

---

## Sub-Area 4: Distributed Tracing (CF Worker → D1 → external APIs)

**Score: 3 / 10**

### Evidence
- `tracesSampleRate` set in all 3 Sentry options builders (client 0.02, server 0.05, edge 0.05) — enables Sentry's auto-instrumentation of fetch + HTTP server.
- `@sentry/nextjs` auto-wraps Next.js route handlers — partial trace coverage for `/api/*` routes by default.
- **No manual span creation** for D1 calls. `seed/db/client.ts` returns a raw client; D1 calls do not appear as child spans in Sentry traces.
- **No traceparent / trace-context propagation** to outbound fetches. NOWPayments IPN, OpenRouter, ElevenLabs, D-ID, Telegram calls do not carry `sentry-trace` / `baggage` headers — even if they did, external providers don't honor them, so the trace ends at the Worker egress.
- Inngest functions (`src/forest/inngest/functions/*`) — no Sentry trace context attached to Inngest events. Cron → Inngest fanout traces are disjoint.
- No OpenTelemetry: no `@opentelemetry/*` deps, no exporter.

### Gaps
1. **D1 calls invisible in traces.** Operator triaging a slow cron has no span breakdown — only the top-level handler duration. (Severity: **P1**)
2. **Inngest cron fanout breaks trace continuity.** Cron handler completes → Inngest event → step function — three disjoint Sentry transactions. (Severity: **P1**)
3. **External API spans rely entirely on Sentry's fetch auto-instrumentation.** No assertion in repo that this is enabled for Workers runtime. (Severity: **P2**)
4. **No tracing for Better Auth session lookup, BYOK decrypt, tier check.** Hot paths invisible. (Severity: **P2**)

---

## Sub-Area 5: Alerting (rules, channels, on-call)

**Score: 6 / 10**

### Evidence
- Sentry cron monitoring wired: `src/app/api/health/cron-heartbeat/route.ts:78-104` uses `Sentry.captureCheckIn(...)` with per-cron `monitorSlug` and `checkinMargin: 5` minutes. Sentry fires "missed check-in" alert if 2× interval elapses without ping.
- Valid cron names enumerated (`cron-heartbeat/route.ts:39+`) — covers `d1-backup`, `dunning-advance`, `email-outbox-flush`, `error-digest`, `fulfillment-reconcile`, etc.
- BetterStack heartbeat path for `d1-backup` cron (`src/app/api/cron/d1-backup/route.ts:21,91`) — even on skip, ping fires to keep heartbeat alive.
- Slack alert primitive: `src/lib/monitoring/slack-alert.ts` (referenced from runbook line 32) — used by circuit breaker (HeyGen failures) and smoke tests per runbook.
- Reconcile alerts: `src/lib/monitoring/reconcile-alert.ts` exists (not inspected deeply).
- Quota alerts: `src/lib/alerts/quota/*` (5 files) — rule evaluator, delivery service, schedule manager, channel senders, email templates. Wired into Inngest cron paths.
- Realtime alert dispatcher: `src/forest/worker/lib/realtime-alert-dispatcher*.ts` — KV-backed event handler.
- Setup runbook: `docs/handover/sentry-alerts-setup-runbook-260512.md` documents 5 manual ops steps (Sentry project create, Slack webhook, wrangler secret put, deploy, force-error test). Required env vars enumerated.
- 18 cron triggers in `wrangler.toml` (per `triggers.crons` array) — all should ping Sentry check-in via the heartbeat route.

### Gaps
1. **No assertion that alert rules are actually live in the Sentry project.** Runbook says "create alert in Sentry UI" — there's no Terraform/IaC, no `sentry-cli` rules sync, no health probe. We don't know from the repo whether the rules exist. (Severity: **P1**)
2. **No on-call rotation defined.** No PagerDuty / Opsgenie config in repo. Slack webhook fan-out is single-channel. Founder-only escalation per the no-tech doctrine, but with doctrine suspended this is now P1. (Severity: **P1**)
3. **`SLACK_OPS_WEBHOOK_URL` fallback is silent.** Runbook line 34: "If Slack webhook unavailable, logs to app logger" — but app logger writes to `console.*` only (see Sub-Area 2). Failed Slack post = lost alert. (Severity: **P1**)
4. **No verification heartbeat probe in CI / deploy.** Operator does not learn that `cron-heartbeat` itself is broken until 2× interval elapses (up to ~30 min for a 15-min cron). (Severity: **P2**)
5. **18 crons, but only the heartbeat code path is shared.** Each cron handler must remember to POST to `/api/health/cron-heartbeat?name=<slug>` at end-of-run. No enforcement, no test. Audit didn't verify every cron actually calls it. (Severity: **P1**)
6. **Alert noise unbounded.** No deduplication rules in repo. No alert fatigue mitigation (e.g., max 5 alerts/hr per channel). (Severity: **P2**)

---

## Sub-Area 6: Dashboards & Runbooks (alert → runbook links)

**Score: 6 / 10**

### Evidence
- Runbooks present in `docs/runbooks/`:
  - `INDEX.md`, `application-log-retention.md`, `backup-restore-drill.md`, `cf-quota-response.md`, `cost-monitoring.md`, `d1-migration-hygiene.md`, `d1-region-failure.md`, `r2-storage-policy.md`.
- Additional ops runbooks at `docs/`: `payout-operations-runbook.md`, `load-testing-runbook.md`, `gitlab-migration-runbook.md`, `sophia-supervisor-agent-runbook.md`.
- Handover runbooks: `docs/handover/sentry-alerts-setup-runbook-260512.md`, `free100-vip-runbook.md`, `founder-cheat-sheet-260512.md`.
- Application log retention doc has clear stream-by-stream table (`docs/runbooks/application-log-retention.md:13-21`) including sink + retention + cost driver.
- No SLO/SLI dashboard. No Grafana/Datadog. CF Workers Analytics is the only dashboard, and operator-only.

### Gaps
1. **Alerts don't link to runbooks.** Sentry alert config (per runbook step 4) does not embed a runbook URL in the alert payload. Operator sees "missed check-in: d1-backup" and must manually find `backup-restore-drill.md`. (Severity: **P1**)
2. **No public status page.** `/api/version` and `/api/health` exist but no consumer-facing status.sophia.agencyos.network. (Severity: **P2**)
3. **No dashboard surfaces system-level RED/USE.** Even when metrics exist, no place to view them. (Severity: **P1** — but contingent on Sub-Area 3 being fixed first)
4. **No runbook for `cron-heartbeat` itself failing.** If the heartbeat route is broken, operator gets cascading "missed check-in" alerts for every cron with no triage doc. (Severity: **P2**)
5. **Runbook drift risk.** No CI step asserts runbook references match code (e.g., `cron-heartbeat/route.ts:11` mentions `docs/runbooks/cron-escalation-contacts.md` — that file does **not** exist in `docs/runbooks/` per `ls` output). (Severity: **P1**)

---

## Top P0/P1 Observability Gaps (Prioritized)

| # | Severity | Gap | Sub-Area | Fix Size |
|---|---|---|---|---|
| 1 | **P0** | Logging pipeline dead — 595 files log to `console.*`, Better Stack drain has 0 imports | 2 | Medium (migrate `seed/utils/logger-utility` to call `lib/telemetry/logger`) |
| 2 | **P0** | Decision: delete OR adopt Better Stack logger — currently confusing dual-logger state | 2 | Small (decision) + Medium (execution) |
| 3 | **P1** | No metrics / RED / USE / SLO — all p95 questions unanswerable | 3 | Large (otel + exporter wiring) |
| 4 | **P1** | No D1 / Inngest / external-API spans → traces are top-level only | 4 | Medium (manual `Sentry.startSpan` wrappers) |
| 5 | **P1** | Alert rules unverified in Sentry — no IaC, no health probe | 5 | Medium (sentry-cli rules sync) |
| 6 | **P1** | OpenNext version drift (`1.17.3` hardcoded vs `^1.19.5` installed) pollutes release tag dimension | 1 | Small (read from `package.json` at build) |
| 7 | **P1** | Sourcemap upload non-blocking + non-verified → minified prod stacks if any env var hiccup | 1 | Small (post-deploy `sentry-cli releases artifacts list` assertion) |
| 8 | **P1** | No on-call rotation; Slack webhook is single channel + silent-fail fallback | 5 | Small (PagerDuty webhook secret + dual-channel) |
| 9 | **P1** | Cron heartbeat enforcement unverified — not all 18 cron handlers proven to POST heartbeat | 5 | Small (lint rule / contract test) |
| 10 | **P1** | Alerts don't link to runbooks; runbook references broken (`cron-escalation-contacts.md` missing) | 6 | Small (alert payload templating + fix dangling refs) |
| 11 | **P1** | 36 raw `console.*` in prod code (welcome page, cron-heartbeat route, etc.) | 2 | Small |

## Score Breakdown

| Sub-Area | Score |
|---|---:|
| 1. Error tracking & symbolication | 6.5 / 10 |
| 2. Logging pipeline | 3 / 10 |
| 3. Metrics & APM | 2 / 10 |
| 4. Distributed tracing | 3 / 10 |
| 5. Alerting | 6 / 10 |
| 6. Dashboards & runbooks | 6 / 10 |
| **TOTAL** | **26.5 / 60** |

> Correction to executive summary: actual sum is **26.5 / 60**, not 31.5. Honest score.

## Unresolved Questions

1. Is `BETTER_STACK_LOGS_TOKEN` actually set as a wrangler secret in prod? (Cannot verify from repo; `wrangler.toml` has no plaintext.) If yes — even more wasteful that no code drains it.
2. Did operator complete all 5 manual steps in `sentry-alerts-setup-runbook-260512.md`? Specifically — are Sentry alert rules + cron monitors actually created in the Sentry project UI? Without an IaC sync, this is a trust-me artifact.
3. Why is `OPENNEXT_VERSION` hardcoded at `src/app/api/version/route.ts:33` instead of read from `package.json` at build? Decision history not in commit log surfaced here.
4. Is `cron-escalation-contacts.md` actually missing or just not yet committed? Referenced from `cron-heartbeat/route.ts:11` but `ls docs/runbooks/` does not show it.
5. Are `lib/telemetry/logger.ts` + `lib/telemetry/better-stack-client.ts` historical artifacts from a prior plan that never landed, or in-flight work? `safe-log.ts` + `log-buffer.ts` siblings suggest a near-complete implementation that was never integrated.
6. With doctrine suspended, what is the formal SLO target for Sophia? Without a number, score 3/10 for metrics is hard to action — operator needs to say "99.5% monthly uptime, p95 < 800ms" before metrics work prioritizes.
