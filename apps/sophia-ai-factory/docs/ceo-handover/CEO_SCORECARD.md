# CEO SCORECARD — SOPHIA AI FACTORY

> Baseline SHA: `5dd1f071` | Generated: 2026-09-02
> **Status: READ-ONLY AUDIT.** No metrics were created, modified, or deployed.
> Every metric is marked: **AVAILABLE NOW** / **PARTIALLY AVAILABLE** / **NOT YET INSTRUMENTED**

---

## How to Read This Scorecard

Each metric answers: *what would I see if I opened the dashboard tomorrow morning?*

- **AVAILABLE NOW** — queryable today via an existing endpoint, table, or report
- **PARTIALLY AVAILABLE** — exists but needs a join, a filter, or a manual step
- **NOT YET INSTRUMENTED** — nothing is captured; this is a gap

**Do not build a dashboard yet.** This document defines what a CEO dashboard *must* show. Building it is a separate decision.

---

## A. PRODUCT HEALTH

| Metric | Status | Source | What to Query |
|---|---|---|---|
| Active users | AVAILABLE NOW | `src/land/` user tables | Count distinct users with ≥1 mission in trailing 30d |
| Mission completion rate | AVAILABLE NOW | mission lifecycle tables | `completed / total` per tier |
| Mission failure rate | AVAILABLE NOW | mission status enum | `failed / total` |
| Human approval rate | AVAILABLE NOW | approval loop tables | `approved / review_requests` |
| Agent success rate | AVAILABLE NOW | `src/app/api/analytics/agent-performance/` | Per-agent success % |
| Creative acceptance rate | AVAILABLE NOW | creative output tables | accepted / generated |
| Mission abandonment rate | AVAILABLE NOW | `src/app/api/cron/mission-abandon-scan/` | abandoned / started |

---

## B. CUSTOMER HEALTH

| Metric | Status | Source | What to Query |
|---|---|---|---|
| New customers | AVAILABLE NOW | user signups | trailing 30d |
| Activated customers | AVAILABLE NOW | Setup Wizard completion | users who completed onboarding |
| Active customers | AVAILABLE NOW | active users | trailing 30d |
| Retention | PARTIALLY AVAILABLE | cohort tables (`src/app/api/analytics/cohorts/`) | exists; needs monthly cohort view |
| Churn | PARTIALLY AVAILABLE | subscription/cancellation tables | exists; needs definition of "churned" |
| Support issues | NOT YET INSTRUMENTED | — | no ticketing system found |
| NPS / feedback | NOT YET INSTRUMENTED | — | no survey capture found |

---

## C. ECONOMIC HEALTH

| Metric | Status | Source | What to Query |
|---|---|---|---|
| MRR | AVAILABLE NOW | billing/subscription tables | sum of active recurring revenue |
| ARR run rate | AVAILABLE NOW | MRR × 12 | derived |
| Revenue | AVAILABLE NOW | `src/app/api/analytics/revenue/` | trailing 30d |
| Refunds | AVAILABLE NOW | `src/land/refunds/` | count + amount |
| Payment failures | AVAILABLE NOW | NOWPayments IPN + PayOS | failure events by provider |
| Gross margin | PARTIALLY AVAILABLE | revenue − AI execution cost | AI cost tracked; infra cost not allocated |
| AI / model costs | AVAILABLE NOW | agent cost overrun tables | per-mission provider spend |
| Cost per successful mission | PARTIALLY AVAILABLE | AI cost / completed missions | needs join |
| Contribution margin per customer | PARTIALLY AVAILABLE | customer revenue − customer variable cost | needs allocation |

---

## D. OPERATIONAL HEALTH

| Metric | Status | Source | What to Query |
|---|---|---|---|
| API health | AVAILABLE NOW | `GET /api/health` | 200 + component checks |
| Background job failures | AVAILABLE NOW | 43 cron routes + Inngest | failure count per job |
| Deployment status | AVAILABLE NOW | `GET /api/version` | `shortSha` vs local commit |
| Error rate | AVAILABLE NOW | `GET /api/metrics` (Bearer `METRICS_BEARER_TOKEN`) | p50/p95/p99 per route |
| Latency | AVAILABLE NOW | `GET /api/metrics` | p50/p95/p99 per route |
| Provider outages | PARTIALLY AVAILABLE | circuit breaker state (`src/seed/security/circuit-breaker`) | per-provider open/half-open/closed |
| Sentry capture | AVAILABLE NOW | `sentry.server.config.ts` | error events (minified unless `SENTRY_AUTH_TOKEN` set) |
| Real-time ops view | AVAILABLE NOW | `GET /api/analytics/realtime` (Admin only) | SSE snapshot every 10s |

---

## E. STRATEGIC HEALTH

| Metric | Status | Source | What to Query |
|---|---|---|---|
| Top customer requests | NOT YET INSTRUMENTED | — | no feedback capture |
| Top failure categories | PARTIALLY AVAILABLE | alert types (`src/tree/alerts/realtime-alert-types.ts`) | alert type distribution |
| Top rejected outputs | NOT YET INSTRUMENTED | — | no rejection capture |
| Top successful workflows | AVAILABLE NOW | mission completion by workflow | top-N by completion |
| Memory learning quality | NOT YET INSTRUMENTED | — | no learning-quality metric |
| Product hypotheses | NOT YET INSTRUMENTED | — | no experiment registry found |

---

## Scorecard Gaps (Priority Order)

1. **Support tickets / NPS** — no customer feedback channel instrumented
2. **Product hypotheses / experiment registry** — no A/B or hypothesis tracking
3. **Memory learning quality** — no measure of how well the system learns
4. **Top rejected outputs** — no capture of what customers reject
5. **Infra cost allocation** — AI cost tracked; Cloudflare/D1/R2/Inngest cost not attributed
6. **Cohort retention view** — data exists; monthly cohort report not built
7. **Churn definition** — data exists; "churned" not formally defined

---

## Access Required to Read These Metrics

| Endpoint | Auth Required | Notes |
|---|---|---|
| `GET /api/health` | Public | Component checks are non-blocking |
| `GET /api/version` | Public | `shortSha`, `deployedAt`, `opennextVersion` |
| `GET /api/metrics` | Bearer `METRICS_BEARER_TOKEN` | p50/p95/p99 per route |
| `GET /api/analytics/realtime` | Admin (MASTER tier or `role=admin`) | SSE, 10s snapshot |
| `GET /api/analytics/*` | Authenticated | 12 analytics routes |
| D1 queries | `wrangler d1 execute` | Read-only SQL against `sophia-raas-db` |

---

## Doctrine Note

Per the **no-tech / BYOK** doctrine, the CEO operates the *platform only*. All third-party credentials (AI keys, payment keys, Telegram token) are customer-owned and entered via the Setup Wizard. The CEO dashboard must therefore show *platform* metrics, not customer-side configuration status.

*Generated by CEO HANDOVER AUDIT, Phase 3.*