# Cost Monitoring & Burn-Rate Tracking

**Document ID:** RUN-COST-001
**Effective Date:** 2026-05-20
**Review Date:** 2026-08-20 (Quarterly)
**Owner:** Platform Ops
**Scope:** Operator-side platform costs (does NOT cover customer BYOK costs).

---

## 1. Cost Surfaces (Operator-Owned)

| Surface | Provider | Free tier | Paid trigger | Tracked by |
|---|---|---|---|---|
| Workers requests | Cloudflare | 100k/day | $5/mo + $0.30/M | `runQuotaCheck()` |
| D1 reads | Cloudflare | 5M/day | $0.001/M after | `runQuotaCheck()` |
| D1 writes | Cloudflare | 100k/day | $1/M after | `runQuotaCheck()` |
| R2 storage | Cloudflare | 10 GB | $0.015/GB-mo | `r2-storage-policy.md` |
| R2 Class A ops | Cloudflare | 1M/mo | $4.50/M | (untracked) |
| R2 Class B ops | Cloudflare | 10M/mo | $0.36/M | (untracked) |
| Sentry events | Sentry | 5k errors/mo | $26/mo Team | manual review |
| BetterStack heartbeats | BetterStack | unlimited free | n/a | n/a |
| Domain + DNS | Cloudflare | $0 (included) | n/a | n/a |
| Email (Resend) | Resend | 3k/mo, 100/day | $20/mo Pro | manual review |

**Customer BYOK costs (NOT operator-owned):** OpenRouter, ElevenLabs, D-ID, NOWPayments, PayOS — each customer is billed directly by upstream.

---

## 2. Active Monitoring

### 2.1 Daily quota check (CF resources)
- Route: `/api/cron/quota-check` — schedule placeholder (operator-registered, optional per no-tech doctrine)
- Calls `runQuotaCheck()` from `src/seed/observability/quota-check.ts`
- Alerts via Sentry when bucket > 70% / 90% / 100% of daily quota
- Source: see `cf-quota-response.md` for response runbook

### 2.2 Monthly billing review (manual)
**Frequency:** 1st of each month
**Steps:**
1. Login to Cloudflare dashboard → **Workers & Pages** → Usage
2. Note: requests, D1 reads/writes, R2 storage, R2 ops
3. Login to Sentry → Settings → Subscription → Usage
4. Login to Resend → Dashboard → Usage
5. Login to BetterStack — confirm still free tier
6. Record month-over-month deltas in this section's "Cost Trend" appendix below
7. If MoM growth > 50% on any surface → investigate cause before next month

### 2.3 Sentry quota
- Free Team plan: 5,000 errors/mo
- Approaching limit → triage noisy capture sites, downgrade `captureException` → `captureMessage` for low-severity, or upgrade plan
- See `application-log-retention.md` → §2.2 Sentry retention

---

## 3. Cost Anomaly Triggers

| Symptom | Likely cause | First action |
|---|---|---|
| D1 reads spike 10× | Missing index → table scan | `EXPLAIN QUERY PLAN` on recent queries; add index |
| Workers requests 5× | Bot traffic / loop | CF Bot Management; check error logs for runaway client |
| R2 storage +5 GB/wk | Video cleanup never ran | Run manual cleanup per `r2-storage-policy.md` |
| Sentry errors 10× | Bad deploy | Roll back; fix root cause |
| Resend > 100/day | Email loop | Disable affected route; investigate |

---

## 4. Cost Optimization Patterns

- **D1 query pruning:** Audit `cron_runs`, `quota_alerts` retention (currently 90d). Tighten if storage matters.
- **R2 cold storage:** `sophia-videos` indefinite — recommend 90d expiry (see RUN-R2-001)
- **Sentry sampling:** add `tracesSampleRate: 0.1` in `sentry.client.config.ts` if perf events dominate
- **Workers bundle size:** keep `.open-next/worker.js` < 1 MB to avoid cold-start cost (currently well under)

---

## 5. Out of Scope (No-Tech Doctrine)

The following cost surfaces are **customer-owned** and operator does NOT monitor:

- OpenRouter API spend → customer's OpenRouter dashboard
- ElevenLabs character usage → customer's ElevenLabs dashboard
- D-ID minutes → customer's D-ID dashboard
- NOWPayments transaction fees → deducted from customer payouts upstream
- PayOS transaction fees → deducted from customer payouts upstream

When a customer's BYOK provider quota exhausts, the upstream 4xx/5xx is surfaced verbatim in their campaign run log (see `docs/api-rate-limits.md` §5).

---

## 6. Cross-References

- `docs/runbooks/cf-quota-response.md` — quota alert response procedure
- `docs/runbooks/r2-storage-policy.md` — R2 bucket retention (RUN-R2-001)
- `docs/runbooks/application-log-retention.md` — Sentry quota context (RUN-LOG-001)
- `docs/api-rate-limits.md` — BYOK upstream surface (API-LIMITS-001)
- `apps/sophia-ai-factory/src/seed/observability/quota-check.ts` — runQuotaCheck source

---

## 7. Cost Trend (operator-updated monthly)

| Month | Workers req | D1 reads | D1 writes | R2 GB | Sentry events | Resend sends | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| _baseline_ | — | — | — | — | — | — | populate first month post-launch |

---

## 8. Unresolved

- No automated MoM cost diff (operator manually populates §7 each month). Consider scripted CF API pull post-launch.
- Per-tenant cost attribution missing — cannot answer "which customer drove this $X spike" without query logging by `user_id`. Defer until cost matters.
- R2 Class A/B ops untracked — invisible until billing surprise.
