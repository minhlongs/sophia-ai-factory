# Phase 4: Monitoring + Alerts

## Overview

- **Priority:** P1
- **Status:** pending
- **Mục tiêu:** Finalize quota enforcement, real-time alerts, usage metering, observability

## Requirements

### Functional
- Quota enforcer: check usage vs tier limit per request, block when exceeded
- Real-time alerts: email + Telegram khi quota gần hết, payment fail, system error
- Usage metering: track every AI call, video render, storage byte — rollup to daily/weekly/monthly
- Health dashboard: system status, error rates, latency, cost per tenant

### Non-functional
- Quota check < 10ms per request
- Alert delivery < 60s from trigger
- Usage rollup: real-time (KV) + hourly (D1) + daily (D1)
- Dashboard load < 3s

## Architecture

```
Request Flow:
User Request → Quota Check → Allow/Deny → Process → Meter Event → KV/D1

Alert Flow:
Trigger (quota 80%, payment fail, error spike) → Rule Eval → Delivery (email/Telegram)

Metering:
Event → Collector → Rollup Engine → KV (real-time) → D1 (hourly/daily)
```

## Related Code Files

| Action | Path |
|--------|------|
| Quota enforcer | `forest/quota/` |
| Usage metering | `forest/usage-metering/` |
| Alert delivery | `forest/alerts/` |
| Inngest functions | `forest/inngest/functions/` |

## Implementation Steps

1. **Quota enforcer** — enforce tier limits per request (API calls, video renders, storage)
2. **Usage metering finalize** — event collector + rollup engine + D1 persistence
3. **Alert system** — rule evaluator + multi-channel delivery (email, Telegram, in-app)
4. **Health dashboard** — admin view for system status + tenant metrics
5. **Wire everything** — quota → metering → alerts → billing

## Todo List

- [ ] Implement quota enforcer (per-request check)
- [ ] Wire quota → API routes (block when exceeded)
- [ ] Finalize usage metering (event → rollup → D1)
- [ ] Build alert rule evaluator
- [ ] Implement alert delivery (email + Telegram)
- [ ] Build admin health dashboard
- [ ] Add quota warning (80%, 90%, 100%)
- [ ] E2E test: usage → quota → alert → billing

## Success Criteria

- Quota enforced: requests blocked when tier limit reached
- Alerts delivered within 60s of trigger
- Usage data accurate (spot-check: compare API provider billing vs internal meter)
- Health dashboard shows real-time metrics

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quota false-positive block | HIGH | Configurable grace period + admin override |
| Metering drift vs actual | MEDIUM | Daily reconciliation job |
| Alert fatigue | LOW | Rate-limit + severity levels |
| D1 write throughput | LOW | Batch writes, KV for hot data |
