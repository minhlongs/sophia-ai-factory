---
title: "SLO/Monitoring Hybrid Approach"
description: "Implement SLO targets with Workers Analytics Engine + Sentry metrics export, monthly cron burn-rate job, and CI perf gate"
status: pending
priority: P1
effort: 8h
branch: feat/slo-monitoring-hybrid
tags: [slo, monitoring, observability, workers-analytics, sentry, cron, ci-gate]
created: 2026-08-11
---

# SLO/Monitoring Hybrid Approach

**Goal:** Implement production-ready SLO monitoring using Cloudflare Workers Analytics Engine for high-cardinality metrics, Sentry for error tracking + alerting, and a monthly cron job to compute burn-rate against error budget.

## SLO Targets (from audit recommendations)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.5% monthly | Workers Analytics Engine (success / total requests) |
| p95 Latency (API) | < 800ms | Workers Analytics Engine (duration percentiles) |
| p95 Latency (Health) | < 500ms | Workers Analytics Engine (duration percentiles) |
| p95 Latency (Webhook delivery) | < 5 min | Workers Analytics Engine (webhook completion time) |
| Error Rate | < 1% | Workers Analytics Engine + Sentry |
| Webhook Delivery SLA | < 5 min | Workers Analytics Engine (nowpayments, clickbank, telegram) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Workers                          │
├─────────────────────────────────────────────────────────────────┤
│  Middleware → recordMetrics(route, duration, status, isError)   │
│                           ↓                                      │
│  Workers Analytics Engine (high-cardinality, sampled)           │
│                           ↓                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  Monthly Cron Job    │    │  Sentry Alert Rules          │   │
│  │  (burn-rate calc)    │    │  (error rate, latency spike) │   │
│  └──────────┬───────────┘    └──────────────┬───────────────┘   │
│             ↓                               ↓                   │
│  D1: slo_burn table               Telegram / Email alerts      │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | File | Description | Dependencies | Effort |
|-------|------|-------------|--------------|--------|
| 01 | `phase-01-define-slos-and-schema.md` | SLO targets doc + D1 `slo_burn` table migration | — | 1.5h |
| 02 | `phase-02-instrument-metrics-export.md` | Workers Analytics Engine + Sentry metrics export | 01 | 2.5h |
| 03 | `phase-03-alert-rules-and-cron.md` | Sentry alert rules + monthly cron job | 02 | 2.5h |
| 04 | `phase-04-ci-gate-and-docs.md` | `perf:check` script + documentation | 03 | 1.5h |

## Acceptance Criteria

- [ ] D1 migration `slo_burn` table applied and verified
- [ ] Middleware records metrics to Workers Analytics Engine on every request
- [ ] Sentry receives custom metrics (error rate, latency p95) via metric alerts
- [ ] Monthly cron job (`0 0 1 * *`) computes burn-rate and writes to `slo_burn`
- [ ] Sentry alert rules fire on: error rate > 1%, p95 latency > 800ms (API)
- [ ] `npm run perf:check` validates SLO targets against last 30 days data
- [ ] Documentation updated: runbooks, SLO dashboard links, escalation paths

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Workers Analytics Engine sampling loses low-volume routes | Medium | Medium | Use `dataset` per route group; supplement with Sentry custom metrics |
| D1 write contention on monthly cron | Low | Low | Single-writer cron; use INSERT OR REPLACE |
| Sentry metric alert false positives | Medium | Medium | Tune thresholds after 2 weeks; use 5-min evaluation windows |
| Cron job fails silently | Low | High | Add health check endpoint + Better Stack ping |

## File Ownership

| Phase | Files Modified/Created | Owner Layer |
|-------|------------------------|-------------|
| 01 | `src/seed/db/migrations/XXXX_slo_burn.sql`, `docs/slo-targets.md` | seed (migration), docs |
| 02 | `src/seed/observability/telemetry/metrics.ts` (extend), `src/middleware.ts` (instrument) | seed (metrics), forest (middleware) |
| 03 | `src/app/api/cron/slo-burn-rate/route.ts`, `sentry.alerts.json`, `wrangler.toml` (cron) | forest (cron), config |
| 04 | `package.json` (perf:check script), `scripts/perf-check.ts`, `docs/runbooks/slo-burn-rate.md` | scripts, docs |

## Success Metrics

- SLO dashboard (Grafana/Sentry) shows real-time burn-rate
- Zero SLO violations undetected for > 15 min
- Monthly burn-rate report auto-generated and posted to team channel
- `npm run perf:check` passes in CI on main branch