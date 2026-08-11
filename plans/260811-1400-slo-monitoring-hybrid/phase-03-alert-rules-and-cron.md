---
title: "Phase 03 — Alert Rules and Monthly Cron"
description: "Configure Sentry alert rules for SLO thresholds and create monthly burn-rate cron job"
status: pending
priority: P1
effort: 2.5h
branch: feat/slo-monitoring-hybrid
depends_on: ["phase-02-instrument-metrics-export.md"]
---

# Phase 03 — Alert Rules and Monthly Cron

## Context Links
- Plan: `../plan.md`
- Phase 02: `./phase-02-instrument-metrics-export.md`
- Cron patterns: `wrangler.toml` (lines 84-112)
- Existing cron routes: `src/app/api/cron/`
- SLO schema: `src/seed/db/migrations/0039_slo_burn.sql`

## Requirements

### Functional
- [ ] Create monthly cron job (`0 0 1 * *`) to compute burn-rate from WAE
- [ ] Cron reads WAE data via Cloudflare GraphQL API or SQL (if mirrored to D1)
- [ ] Write burn-rate results to `slo_burn` table
- [ ] Configure Sentry alert rules for: error_rate > 1%, latency_p95 > 800ms
- [ ] Alert routing: Telegram (on-call) + Email (team)
- [ ] Add cron trigger to `wrangler.toml`

### Non-Functional
- [ ] Cron completes within 60 seconds
- [ ] Idempotent: re-running same month overwrites safely
- [ ] Graceful handling of missing WAE data
- [ ] Alert rules use 5-minute evaluation windows to reduce noise

## Files to Modify/Create

| Action | File | Layer | Notes |
|--------|------|-------|-------|
| Create | `src/app/api/cron/slo-burn-rate/route.ts` | forest | Monthly burn-rate computation |
| Modify | `wrangler.toml` | config | Add cron trigger `0 0 1 * *` |
| Create | `sentry.alerts.json` | config | Sentry alert rule definitions |
| Create | `src/seed/db/slo-burn-ops.ts` | seed | D1 operations for slo_burn |
| Modify | `src/seed/db/index.ts` | seed | Export new operations |

## SLO Burn Rate Cron (`src/app/api/cron/slo-burn-rate/route.ts`)

```typescript
/**
 * Monthly SLO Burn Rate Computation
 * Runs: 1st of month 00:00 UTC (cron: "0 0 1 * *")
 * Reads: Workers Analytics Engine (via GraphQL) for previous month
 * Writes: slo_burn table with computed burn rates and alert levels
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { computeMonthlyBurnRate } from '@/seed/db/slo-burn-ops';
import { verifyCronSecret } from '@/seed/utils/cron-auth';

export const dynamic = 'force-dynamic';

const SLO_DEFINITIONS = [
  {
    name: 'availability',
    target: 0.995,
    operator: 'gte' as const,
    waeQuery: 'availability',
  },
  {
    name: 'api_latency_p95',
    target: 800,
    operator: 'lte' as const,
    waeQuery: 'latency_p95',
    routeFilter: '/api/%',
  },
  {
    name: 'health_latency_p95',
    target: 500,
    operator: 'lte' as const,
    waeQuery: 'latency_p95',
    routeFilter: '/api/health',
  },
  {
    name: 'webhook_delivery_p95',
    target: 300_000, // 5 minutes in ms
    operator: 'lte' as const,
    waeQuery: 'webhook_delivery_p95',
    routeFilter: '/api/webhooks/%',
  },
  {
    name: 'error_rate',
    target: 0.01,
    operator: 'lte' as const,
    waeQuery: 'error_rate',
  },
] as const;

interface WAEQueryResult {
  route: string;
  total_requests: number;
  good_requests: number;
  bad_requests: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  error_rate: number;
}

async function queryWAE(
  yearMonth: string,
  sloName: string,
  routeFilter?: string
): Promise<WAEQueryResult[]> {
  // Option A: Cloudflare GraphQL Analytics Engine API
  // Option B: If WAE data is mirrored to D1 (recommended for reliability), query D1
  
  // For now, implement D1 mirror approach — see slo-burn-ops.ts
  // This function is a placeholder for GraphQL implementation
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CF_ANALYTICS_API_TOKEN;
  
  if (!accountId || !apiToken) {
    console.warn('[slo-burn-rate] WAE credentials not configured, skipping');
    return [];
  }
  
  const start = `${yearMonth}-01T00:00:00Z`;
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const endStr = end.toISOString();
  
  const query = `
    SELECT 
      route,
      count() as total_requests,
      countIf(is_error = false) as good_requests,
      countIf(is_error = true) as bad_requests,
      quantile(0.50)(duration_ms) as p50_ms,
      quantile(0.95)(duration_ms) as p95_ms,
      quantile(0.99)(duration_ms) as p99_ms,
      avg(is_error) as error_rate
    FROM sophia_slo_metrics
    WHERE timestamp >= '${start}' AND timestamp < '${endStr}'
    ${routeFilter ? `AND route LIKE '${routeFilter}'` : ''}
    GROUP BY route
  `;
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`WAE query failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.result?.rows ?? [];
  } catch (error) {
    console.error('[slo-burn-rate] WAE query error:', error);
    return [];
  }
}

function computeAlertLevel(burnRate: number): 'info' | 'warning' | 'critical' | 'emergency' {
  if (burnRate >= 10) return 'emergency';
  if (burnRate >= 5) return 'critical';
  if (burnRate >= 2) return 'warning';
  return 'info';
}

async function processSLO(
  db: ReturnType<typeof createServerClient>,
  yearMonth: string,
  slo: typeof SLO_DEFINITIONS[0]
): Promise<void> {
  const windowStart = `${yearMonth}-01T00:00:00Z`;
  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + 1);
  const windowEndStr = windowEnd.toISOString();
  
  // Query WAE (or D1 mirror)
  const results = await queryWAE(yearMonth, slo.name, slo.routeFilter);
  
  if (results.length === 0) {
    console.warn(`[slo-burn-rate] No data for ${slo.name} in ${yearMonth}`);
    return;
  }
  
  // Aggregate across routes
  let totalRequests = 0;
  let goodRequests = 0;
  let badRequests = 0;
  let allDurations: number[] = [];
  
  for (const r of results) {
    totalRequests += r.total_requests;
    goodRequests += r.good_requests;
    badRequests += r.bad_requests;
    // For percentile aggregation, we'd need raw data — approximate with weighted avg
    allDurations.push(r.p95_ms);
  }
  
  let measuredValue: number;
  let errorBudget: number;
  let errorBudgetConsumed: number;
  
  if (slo.operator === 'gte') {
    // Availability: good / total
    measuredValue = totalRequests > 0 ? goodRequests / totalRequests : 1;
    errorBudget = (1 - slo.target) * totalRequests;
    errorBudgetConsumed = badRequests;
  } else {
    // Latency/Error rate: p95 or rate
    measuredValue = allDurations.length > 0 
      ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length 
      : 0;
    errorBudget = slo.target * totalRequests; // Simplified
    errorBudgetConsumed = slo.name === 'error_rate' ? badRequests : 
      Math.round(totalRequests * (measuredValue / slo.target));
  }
  
  const burnRate = errorBudget > 0 ? errorBudgetConsumed / errorBudget * 100 : 0;
  const alertLevel = computeAlertLevel(burnRate);
  
  const metadata = {
    route_count: results.length,
    routes: results.map(r => ({
      route: r.route,
      total: r.total_requests,
      p95_ms: r.p95_ms,
      error_rate: r.error_rate,
    })),
  };
  
  await computeMonthlyBurnRate(db, {
    sloName: slo.name,
    yearMonth,
    windowStart,
    windowEnd: windowEndStr,
    targetValue: slo.target,
    targetOperator: slo.operator,
    totalRequests,
    goodRequests,
    badRequests,
    measuredValue,
    errorBudget,
    errorBudgetConsumed,
    burnRate,
    alertLevel,
    metadata: JSON.stringify(metadata),
  });
  
  console.log(`[slo-burn-rate] ${slo.name}: measured=${measuredValue.toFixed(4)}, burn_rate=${burnRate.toFixed(2)}%, alert=${alertLevel}`);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify cron secret
  const authResult = verifyCronSecret(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM (previous month)
  // Actually compute for PREVIOUS month
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const targetYearMonth = now.toISOString().slice(0, 7);
  
  console.log(`[slo-burn-rate] Computing burn rate for ${targetYearMonth}`);
  
  const db = createServerClient();
  const results = [];
  
  for (const slo of SLO_DEFINITIONS) {
    try {
      await processSLO(db, targetYearMonth, slo);
      results.push({ slo: slo.name, status: 'ok' });
    } catch (error) {
      console.error(`[slo-burn-rate] Failed ${slo.name}:`, error);
      results.push({ slo: slo.name, status: 'error', error: String(error) });
    }
  }
  
  return NextResponse.json({
    year_month: targetYearMonth,
    processed: results.length,
    results,
    computed_at: new Date().toISOString(),
  });
}
```

## D1 Operations (`src/seed/db/slo-burn-ops.ts`)

```typescript
/**
 * D1 operations for slo_burn table.
 * Uses synchronous createServerClient() pattern.
 */

import { createServerClient } from './client';

export interface SLOBurnInput {
  sloName: string;
  yearMonth: string;
  windowStart: string;
  windowEnd: string;
  targetValue: number;
  targetOperator: 'gte' | 'lte';
  totalRequests: number;
  goodRequests: number;
  badRequests: number;
  measuredValue: number;
  errorBudget: number;
  errorBudgetConsumed: number;
  burnRate: number;
  alertLevel: 'info' | 'warning' | 'critical' | 'emergency';
  metadata: string;
}

export function computeMonthlyBurnRate(
  db: ReturnType<typeof createServerClient>,
  input: SLOBurnInput
): void {
  const stmt = db.prepare(`
    INSERT INTO slo_burn (
      slo_name, year_month, window_start, window_end,
      target_value, target_operator,
      total_requests, good_requests, bad_requests,
      measured_value, error_budget, error_budget_consumed,
      burn_rate, alert_level, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slo_name, year_month) DO UPDATE SET
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      target_value = excluded.target_value,
      target_operator = excluded.target_operator,
      total_requests = excluded.total_requests,
      good_requests = excluded.good_requests,
      bad_requests = excluded.bad_requests,
      measured_value = excluded.measured_value,
      error_budget = excluded.error_budget,
      error_budget_consumed = excluded.error_budget_consumed,
      burn_rate = excluded.burn_rate,
      alert_level = excluded.alert_level,
      metadata = excluded.metadata,
      computed_at = datetime('now')
  `);
  
  const result = stmt.bind(
    input.sloName,
    input.yearMonth,
    input.windowStart,
    input.windowEnd,
    input.targetValue,
    input.targetOperator,
    input.totalRequests,
    input.goodRequests,
    input.badRequests,
    input.measuredValue,
    input.errorBudget,
    input.errorBudgetConsumed,
    input.burnRate,
    input.alertLevel,
    input.metadata
  ).run();
  
  if (result.meta.changes === 0) {
    throw new Error(`No changes for ${input.sloName}/${input.yearMonth}`);
  }
}

export function getCurrentMonthBurnRate(
  db: ReturnType<typeof createServerClient>
): Array<{
  slo_name: string;
  year_month: string;
  target_value: number;
  measured_value: number;
  burn_rate: number;
  alert_level: string | null;
  computed_at: string;
  metadata: string;
}> {
  const stmt = db.prepare(`
    SELECT slo_name, year_month, target_value, measured_value,
           burn_rate, alert_level, computed_at, metadata
    FROM v_slo_current_month
  `);
  
  return stmt.all().results as Array<{
    slo_name: string;
    year_month: string;
    target_value: number;
    measured_value: number;
    burn_rate: number;
    alert_level: string | null;
    computed_at: string;
    metadata: string;
  }>;
}

export function getBurnRateHistory(
  db: ReturnType<typeof createServerClient>,
  sloName: string,
  months: number = 12
): Array<{
  year_month: string;
  burn_rate: number;
  alert_level: string | null;
  measured_value: number;
}> {
  const stmt = db.prepare(`
    SELECT year_month, burn_rate, alert_level, measured_value
    FROM slo_burn
    WHERE slo_name = ?1
    ORDER BY year_month DESC
    LIMIT ?2
  `);
  
  return stmt.bind(sloName, months).all().results as Array<{
    year_month: string;
    burn_rate: number;
    alert_level: string | null;
    measured_value: number;
  }>;
}
```

## Sentry Alert Rules (`sentry.alerts.json`)

```json
{
  "alerts": [
    {
      "name": "SLO: Error Rate > 1%",
      "condition": "metrics.slo.error_rate > 0.01",
      "evaluationWindow": "5m",
      "threshold": 0.01,
      "operator": ">",
      "severity": "critical",
      "tags": {
        "team": "platform",
        "slo": "error_rate"
      },
      "actions": [
        { "type": "telegram", "chatId": "${TELEGRAM_ONCALL_CHAT_ID}" },
        { "type": "email", "recipients": ["oncall@sophia.agencyos.network"] }
      ],
      "description": "Error rate exceeded 1% SLO target over 5-minute window. Check Sentry issues and Workers logs."
    },
    {
      "name": "SLO: API Latency p95 > 800ms",
      "condition": "metrics.slo.latency_p95 > 800",
      "evaluationWindow": "5m",
      "threshold": 800,
      "operator": ">",
      "severity": "warning",
      "tags": {
        "team": "platform",
        "slo": "api_latency_p95"
      },
      "actions": [
        { "type": "telegram", "chatId": "${TELEGRAM_ONCALL_CHAT_ID}" },
        { "type": "email", "recipients": ["platform@sophia.agencyos.network"] }
      ],
      "description": "API p95 latency exceeded 800ms SLO target. Check for cold starts, DB contention, or upstream latency."
    },
    {
      "name": "SLO: Health Latency p95 > 500ms",
      "condition": "metrics.slo.latency_p95{route=\"/api/health\"} > 500",
      "evaluationWindow": "5m",
      "threshold": 500,
      "operator": ">",
      "severity": "warning",
      "tags": {
        "team": "platform",
        "slo": "health_latency_p95"
      },
      "actions": [
        { "type": "telegram", "chatId": "${TELEGRAM_ONCALL_CHAT_ID}" }
      ],
      "description": "Health endpoint p95 latency exceeded 500ms. Indicates Worker runtime issues."
    },
    {
      "name": "SLO: Webhook Delivery p95 > 5min",
      "condition": "metrics.slo.webhook_delivery_p95 > 300000",
      "evaluationWindow": "10m",
      "threshold": 300000,
      "operator": ">",
      "severity": "critical",
      "tags": {
        "team": "platform",
        "slo": "webhook_delivery_p95"
      },
      "actions": [
        { "type": "telegram", "chatId": "${TELEGRAM_ONCALL_CHAT_ID}" },
        { "type": "email", "recipients": ["oncall@sophia.agencyos.network", "payments@sophia.agencyos.network"] }
      ],
      "description": "Webhook delivery p95 exceeded 5 minutes. Payment/webhook processing degraded."
    },
    {
      "name": "SLO: Availability < 99.5%",
      "condition": "metrics.slo.availability < 0.995",
      "evaluationWindow": "15m",
      "threshold": 0.995,
      "operator": "<",
      "severity": "critical",
      "tags": {
        "team": "platform",
        "slo": "availability"
      },
      "actions": [
        { "type": "telegram", "chatId": "${TELEGRAM_ONCALL_CHAT_ID}" },
        { "type": "email", "recipients": ["oncall@sophia.agencyos.network", "leadership@sophia.agencyos.network"] }
      ],
      "description": "Availability dropped below 99.5% over 15-minute window. Major incident likely."
    }
  ]
}
```

## Wrangler Cron Addition

Add to `wrangler.toml` crons array (after line 95):

```toml
# Existing crons...
crons = [
  # ... existing entries ...
  "0 0 1 * *",  # Monthly 1st 00:00 UTC → /api/cron/slo-burn-rate (SLO burn rate computation)
]
```

## Implementation Steps

1. **Create SLO burn ops**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/slo-burn-ops.ts << 'EOF'
   # [content from above]
   EOF
   ```

2. **Export from db index**
   ```bash
   # Add to src/seed/db/index.ts:
   # export { computeMonthlyBurnRate, getCurrentMonthBurnRate, getBurnRateHistory } from './slo-burn-ops';
   ```

3. **Create cron route**
   ```bash
   mkdir -p /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/slo-burn-rate
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/cron/slo-burn-rate/route.ts << 'EOF'
   # [content from above]
   EOF
   ```

4. **Create Sentry alerts config**
   ```bash
   cat > /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/sentry.alerts.json << 'EOF'
   # [content from above]
   EOF
   ```

5. **Add cron to wrangler.toml**
   ```bash
   # Edit wrangler.toml, add "0 0 1 * *" to crons array
   ```

6. **Apply Sentry alerts** (manual via Sentry UI or API)
   ```bash
   # Use Sentry CLI or UI to import alert rules from sentry.alerts.json
   npx @sentry/cli alerts import --org sophia-ai-factory --project sophia-ai-factory sentry.alerts.json
   ```

7. **Test cron locally**
   ```bash
   cd /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
   npm run dev
   # Trigger: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/slo-burn-rate
   ```

8. **Deploy and verify**
   ```bash
   git push origin main
   npm run deploy:full
   # Verify cron appears in CF dashboard
   ```

## Tests / Validation

- [ ] `npm run type-check` passes
- [ ] Unit tests for `slo-burn-ops.ts`: insert, upsert, query
- [ ] Integration test: cron route returns 200 with valid cron secret
- [ ] Cron computes correct burn rate for mocked WAE data
- [ ] Sentry alerts fire on threshold breach (test with synthetic metrics)
- [ ] Monthly cron triggers on schedule (verify in CF Workers cron tab)
- [ ] `slo_burn` table populated with correct data

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WAE GraphQL API unavailable / rate limited | Medium | High | Mirror WAE to D1 daily; fallback to D1 mirror |
| Cron runs before WAE data is complete | Medium | Medium | Run cron at 00:00 UTC (24h after month end); add 1h buffer |
| Sentry alert rules not imported correctly | Low | Medium | Verify via Sentry UI; document manual import steps |
| Burn rate calculation wrong for latency SLOs | Medium | High | Unit test with known datasets; compare with manual calc |
| Alert fatigue from noisy metrics | Medium | Medium | 5-min evaluation windows; tune after 2 weeks |

## Next Steps

After Phase 03 completes:
- Phase 04: Add `perf:check` CI gate script
- Phase 04: Document runbooks and SLO dashboard