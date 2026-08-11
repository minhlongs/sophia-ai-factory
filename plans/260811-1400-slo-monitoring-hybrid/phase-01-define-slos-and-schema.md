---
title: "Phase 01 — Define SLOs and D1 Schema"
description: "Document SLO targets and create D1 migration for slo_burn table"
status: pending
priority: P1
effort: 1.5h
branch: feat/slo-monitoring-hybrid
depends_on: []
---

# Phase 01 — Define SLOs and D1 Schema

## Context Links
- Plan: `../plan.md`
- Audit recommendations: `.claude/rules/sophia-no-tech-doctrine.md` (Layer 7, 10 scoring)
- Current metrics: `src/seed/observability/telemetry/metrics.ts`
- Migrations: `src/seed/db/migrations/`

## Requirements

### Functional
- [ ] Create SLO targets documentation (`docs/slo-targets.md`)
- [ ] Create D1 migration for `slo_burn` table
- [ ] Migration applies cleanly via `bash scripts/apply-migrations.sh`

### Non-Functional
- [ ] Migration is idempotent (IF NOT EXISTS)
- [ ] Schema supports monthly partitions by `year_month` (e.g., `2026-08`)
- [ ] Index on `slo_name`, `year_month` for query performance
- [ ] No breaking changes to existing tables

## Files to Modify/Create

| Action | File | Layer |
|--------|------|-------|
| Create | `src/seed/db/migrations/0039_slo_burn.sql` | seed |
| Create | `docs/slo-targets.md` | docs |
| Read | `src/seed/db/migrations/20260603_01_batch_jobs_idempotency_key.sql` (reference) | — |

## SLO Targets Document (`docs/slo-targets.md`)

```markdown
# Sophia AI Factory — Service Level Objectives

**Effective:** 2026-08-11
**Review:** Monthly (first business day)
**Owner:** Platform Team

## SLO Definitions

| SLO Name | Metric | Target | Window | Measurement Source |
|----------|--------|--------|--------|-------------------|
| `availability` | Successful requests / Total requests | ≥ 99.5% | 30-day rolling | Workers Analytics Engine |
| `api_latency_p95` | p95 response duration (API routes) | < 800ms | 30-day rolling | Workers Analytics Engine |
| `health_latency_p95` | p95 response duration (/api/health) | < 500ms | 30-day rolling | Workers Analytics Engine |
| `webhook_delivery_p95` | p95 webhook completion time | < 5 min | 30-day rolling | Workers Analytics Engine |
| `error_rate` | Error requests / Total requests | < 1% | 30-day rolling | Workers Analytics Engine + Sentry |

## Error Budget Calculation

```
Error Budget = (1 - SLO Target) × Total Requests in Window
Burn Rate = Errors Consumed / Error Budget
```

| Burn Rate | Alert Level | Action |
|-----------|-------------|--------|
| < 2% | Info | Log only |
| 2% - 5% | Warning | Page on-call (non-urgent) |
| 5% - 10% | Critical | Page on-call (urgent), incident channel |
| > 10% | Emergency | All-hands, war room |

## Webhook SLOs (Specific)

| Webhook | SLO Name | Target |
|---------|----------|--------|
| NOWPayments IPN | `webhook_nowpayments_p95` | < 5 min |
| ClickBank IPN | `webhook_clickbank_p95` | < 5 min |
| Telegram Bot | `webhook_telegram_p95` | < 5 min |
| D-ID Callback | `webhook_did_p95` | < 5 min |
| HeyGen Callback | `webhook_heygen_p95` | < 5 min |

## Measurement Methodology

- **Availability**: 2xx + 3xx responses / all responses (excludes 4xx from client errors)
- **Latency**: Measured at edge (Worker entry → response sent), includes cold starts
- **Error Rate**: 5xx responses / all responses
- **Webhook Delivery**: Timestamp from webhook received → downstream ACK / processing complete

## Exclusions

- Scheduled maintenance windows (published 48h advance)
- Client-side errors (4xx) — not counted in availability/error rate
- DDoS attack traffic (identified via CF WAF)
- Local development / preview deployments
```

## D1 Migration (`src/seed/db/migrations/0039_slo_burn.sql`)

```sql
-- SLO Burn Rate Tracking Table
-- Stores monthly burn-rate calculations for each SLO
-- Run: npx wrangler d1 execute sophia-raas-db --file=src/seed/db/migrations/0039_slo_burn.sql --remote

CREATE TABLE IF NOT EXISTS slo_burn (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slo_name TEXT NOT NULL,                    -- e.g., 'availability', 'api_latency_p95'
  year_month TEXT NOT NULL,                  -- 'YYYY-MM' format, e.g., '2026-08'
  window_start TEXT NOT NULL,                -- ISO timestamp, window start (inclusive)
  window_end TEXT NOT NULL,                  -- ISO timestamp, window end (exclusive)
  
  -- SLO configuration
  target_value REAL NOT NULL,                -- SLO target (e.g., 0.995 for 99.5%)
  target_operator TEXT NOT NULL,             -- 'gte' or 'lte'
  
  -- Measured values
  total_requests INTEGER NOT NULL DEFAULT 0,
  good_requests INTEGER NOT NULL DEFAULT 0,
  bad_requests INTEGER NOT NULL DEFAULT 0,
  measured_value REAL,                       -- Actual measured value (e.g., 0.997)
  
  -- Error budget
  error_budget REAL,                         -- (1 - target) * total for availability
  error_budget_consumed REAL,                -- bad_requests for availability
  burn_rate REAL,                            -- error_budget_consumed / error_budget
  
  -- Alert state
  alert_level TEXT,                          -- 'info', 'warning', 'critical', 'emergency'
  alert_fired_at TEXT,                       -- ISO timestamp when alert fired
  alert_acknowledged_at TEXT,                -- ISO timestamp when acknowledged
  
  -- Metadata
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,                             -- JSON: {p50, p95, p99, sample_count, ...}
  
  UNIQUE(slo_name, year_month)
);

CREATE INDEX IF NOT EXISTS idx_slo_burn_slo_month ON slo_burn(slo_name, year_month);
CREATE INDEX IF NOT EXISTS idx_slo_burn_computed ON slo_burn(computed_at);
CREATE INDEX IF NOT EXISTS idx_slo_burn_alert ON slo_burn(alert_level) WHERE alert_level IS NOT NULL;

-- View for current month burn-rate dashboard
CREATE VIEW IF NOT EXISTS v_slo_current_month AS
SELECT 
  slo_name,
  year_month,
  target_value,
  measured_value,
  burn_rate,
  alert_level,
  alert_fired_at,
  computed_at,
  metadata
FROM slo_burn
WHERE year_month = strftime('%Y-%m', 'now')
ORDER BY slo_name;
```

## Implementation Steps

1. **Create SLO targets doc**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/docs/slo-targets.md << 'EOF'
   # [content from above]
   EOF
   ```

2. **Create migration file**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/migrations/0039_slo_burn.sql << 'EOF'
   -- [SQL from above]
   EOF
   ```

3. **Verify migration syntax**
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npx wrangler d1 execute sophia-raas-db --file=src/seed/db/migrations/0039_slo_burn.sql --local
   ```

4. **Apply to production (after plan approval)**
   ```bash
   bash scripts/apply-migrations.sh
   ```

5. **Verify table exists**
   ```bash
   npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM slo_burn LIMIT 1" --remote
   ```

## Tests / Validation

- [ ] Migration applies locally without errors
- [ ] Table `slo_burn` exists with correct columns
- [ ] Unique constraint on `(slo_name, year_month)` works
- [ ] Indexes created successfully
- [ ] View `v_slo_current_month` returns expected columns
- [ ] Documentation renders correctly in docs site

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration conflicts with existing migration numbers | Low | High | Check latest migration number before creating; use sequential numbering |
| Unique constraint violation on re-run | Low | Medium | Migration uses `IF NOT EXISTS` and `UNIQUE` — idempotent |
| View references non-existent table | Low | Low | View created after table in same migration |

## Next Steps

After Phase 01 completes:
- Phase 02: Instrument metrics export to Workers Analytics Engine
- Phase 03: Create monthly cron job to populate `slo_burn`