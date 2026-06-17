# Phase 07 — Multi-Region Strategy

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Scalability + Infra & Cost categories)
- Gap: "Wrangler-from-M1" single-machine deploy bus-factor 1; single-region CF Workers
- Milestone C requires multi-region or documented single-region risk acceptance

## Overview

- **Priority:** P2 (can start after Phase 5; long pole for Milestone C)
- **Status:** pending
- **Description:** Implement multi-region read replica strategy for D1 database, or document and accept single-region risk with customer SLA reflection. Establish cross-region DR capability.

## Key Insights

- Current architecture: Single Cloudflare region (likely `https://sophia.agencyos.network` in US East)
- D1 is single-region by default; read replicas available in other CF regions (EU, APAC)
- No active-active setup; failover is manual via DNS update
- Infra score was 5/10 partly due to single-point deploy and no region redundancy
- Milestone C 100/100 requires either multi-region or explicit risk acceptance with customer-facing SLA

## Requirements

### Functional
1. **D1 read replica configuration** — At minimum 1 read replica in EU region for latency reduction
2. **Read/write splitting** — Application logic to route reads to nearest replica, writes to primary
3. **Failover procedure** — Documented steps to promote read replica to primary in case of US region outage
4. **Cross-region backup** — R2 bucket replication to EU region (or separate provider)
5. **Risk acceptance SLA** — If single-region maintained, publish availability SLA reflecting single-point-of-failure

### Non-functional
- Read replica replication lag < 1 second (target)
- Failover RTO < 1 hour (manual DNS + promotion)
- Application must handle replica lag (read-after-write consistency concerns)
- Cost analysis: D1 read replica ~$0.10/GB-month + egress; evaluate vs benefit

## Architecture

### D1 Read Replicas

Cloudflare D1 supports read replicas in other regions via `d1 replicas create`:

```bash
# Create read replica in Frankfurt (eu-central)
npx wrangler d1 replicas create sophia-raas-db --region eu-central

# List replicas
npx wrangler d1 replicas list sophia-raas-db
```

Output:
```
┌─────────────────────────────────────────────┬─────────────┬──────────────────────┐
│ ID                                          │ Region      │ Last Replicated At   │
├─────────────────────────────────────────────┼─────────────┼──────────────────────┤
│ sophia-raas-db-read-eu-central              │ eu-central  │ 2026-06-17T12:00:00Z │
└─────────────────────────────────────────────┴─────────────┴──────────────────────┘
```

Replica connection string format: `<database_name>_read` binding in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sophia-raas-db"
database_id = "xxx"

[[d1_databases]]
binding = "DB_READ_EU"
database_name = "sophia-raas-db-read-eu-central"
database_id = "yyy"
```

### Read/Write Splitting

```typescript
// src/seed/db/client.ts (extended)
import { getRequestContext } from '@cloudflare/workers-types';

function createServerClient(options: { readOnly?: boolean; region?: string } = {}): D1Database {
  const ctx = getRequestContext();

  // Route reads to appropriate replica based on request CF region
  if (options.readOnly && ctx?.cf?.colo) {
    if (ctx.cf.colo.startsWith('FRA') || ctx.cf.colo.startsWith('MRS')) {
      return DB_READ_EU; // EU region
    }
    // Add more regions as replicas come online
  }

  return DB; // primary for writes or default read
}
```

**Usage pattern:**
```typescript
// Writes → always primary
const db = createServerClient(); // default = primary
await db.from('campaigns').insert(...);

// Reads → can use replica
const dbRead = createServerClient({ readOnly: true });
const { data } = await dbRead.from('campaigns').select('*').eq('user_id', userId);
```

### Application-Level Routing

For more sophisticated routing (latency-based), use edge middleware:

```typescript
// src/app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const cf = request.cf;
  const region = cf?.colo || 'DFW'; // default US

  // Attach preferred read region to request headers for downstream handlers
  const preferredReadRegion = region.startsWith('FRA') ? 'eu' : 'us';

  const response = NextResponse.next();
  response.headers.set('x-preferred-read-region', preferredReadRegion);
  return response;
}
```

Then in read handlers:
```typescript
const region = request.headers.get('x-preferred-read-region') || 'us';
const db = createServerClient({ readOnly: true, region });
```

### Failover Procedure (`docs/runbooks/FAILOVER.md`)

1. **Assess outage** — Confirm primary region (US) unavailable; check CF status page
2. **Promote EU replica** — `npx wrangler d1 replicas promote sophia-raas-db-read-eu-central`
3. **Update wrangler.toml** — Change primary binding to use promoted replica as new primary
4. **Deploy with updated config** — `npm run deploy:full` (new primary region)
5. **Update DNS** — If using custom domain with CF proxy, no change; if direct workers URL, update any hardcoded region refs
6. **Recreate old primary as new replica** — After US region recovers, recreate original primary as read replica in US
7. **Notify customers** — Post incident to status page; communicate brief outage

**RTO target:** < 1 hour from decision to traffic flowing
**RPO:** < 1 minute (D1 replication lag typically < 1s)

### R2 Cross-Region Replication

Instead of S3 mirror (Phase 2), consider R2 built-in replication:

```bash
# Create replication rule
npx wrangler r2 replication create sophia-ai-factory-opennext-cache \
  --destination-bucket sophia-ai-factory-opennext-cache-eu \
  --region eu-central
```

Or use Phase 2's S3 mirror as EU cold storage.

## Related Code Files

**Files to create:**
- `migrations/0125-d1-read-replica-config.sql` (no schema change; just documentation)
- `docs/runbooks/FAILOVER.md`
- `docs/architecture/MULTI-REGION.md` — design decision record
- `src/seed/db/client.ts` — add readOnly parameter and region routing
- `src/app/middleware.ts` — add region header

**Files to modify:**
- `wrangler.toml` — add `DB_READ_EU` binding (if EU replica created)
- `src/app/api/cron/d1-backup/route.ts` — backup from whichever region is primary
- `deploy-with-sha.sh` — document cross-region deploy considerations

## Implementation Steps

1. **Cost-benefit analysis** — Estimate egress costs; evaluate if EU latency justifies replica
2. **Decision point:** Multi-region vs risk-acceptance SLA
   - If multi-region → proceed with steps below
   - If risk-acceptance → create `docs/legal/SINGLE-REGION-RISK.md` and update customer SLA docs
3. **Create read replica** — `wrangler d1 replicas create sophia-raas-db --region eu-central`
4. **Update wrangler.toml** — add replica binding
5. **Deploy to staging** — Test read routing; verify replication lag < 1s
6. **Implement client routing** — update `createServerClient()` with readOnly option
7. **Add middleware** — `x-preferred-read-region` header
8. **Roll out read splitting** — gradually increase % of reads to replica; monitor errors
9. **Test failover in staging** — simulate primary outage; promote replica; verify
10. **Document runbook** — `docs/runbooks/FAILOVER.md` with step-by-step commands
11. **Second-operator drill** — Have different operator execute failover from runbook
12. **SOC 2 evidence** — Document multi-region architecture; include replication lag metrics

## Todo List

- [ ] Cost-benefit analysis: EU replica egress ~$/month vs latency benefit
- [ ] Decision: multi-region or risk-acceptance SLA
- [ ] If multi-region: create D1 read replica in eu-central
- [ ] Update wrangler.toml with DB_READ_EU binding
- [ ] Modify createServerClient() with readOnly + region routing
- [ ] Add middleware to detect CF region
- [ ] Staging test: verify reads go to replica, writes to primary
- [ ] Measure replication lag over 24h; ensure < 1s p95
- [ ] Write FAILOVER.md runbook
- [ ] Test failover on staging (replica promotion)
- [ ] Gradual rollout: 10% reads → replica, monitor, then 50%, 100%
- [ ] Second-operator failover drill; document RTO achieved
- [ ] If risk-acceptance: publish SLA doc with single-region disclaimer
- [ ] SOC 2 evidence: architecture diagram + replication metrics

## Success Criteria

- ✅ At least 1 D1 read replica exists in different CF region (verify `wrangler d1 replicas list`)
- ✅ Application routes >50% of reads to replica (measured by query logs)
- ✅ Replication lag p95 < 1 second (monitor via `wrangler d1 replicas status`)
- ✅ Failover runbook exists and tested by second operator (RTO < 1h documented)
- ✅ If multi-region: cross-region backup (R2 replication or Phase 2 mirror) in place
- ✅ If single-region accepted: `docs/legal/SINGLE-REGION-RISK.md` signed off by CEO

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Read replica replication lag >1s | Low | Med | Monitor lag; fallback to primary if lag >5s |
| Replica out of sync during failover | Med | High | Test failover regularly (monthly with DR drill) |
| Cross-region egress costs explode | Med | Low | Set budget alerts; cache aggressively |
| Stale reads after write (consistency issue) | High | Med | Document eventual consistency; route recent writes to primary |
| Replica creation fails (D1 limits) | Low | High | Open support ticket; have rollback plan |

## Security Considerations

- Replica inherits primary's encryption at rest; no extra measures needed
- Replication traffic is within Cloudflare network (no public internet)
- Failover procedure must require admin auth; log all replica promotions to `audit_log`
- If risk-acceptance SLA published, ensure legal review of outage liability

## Next Steps

1. **Immediate:** Cost-benefit decision — is EU replica worth ~$100-300/month?
2. **If yes:** Create replica this week; begin integration testing
3. **If no:** Draft single-region risk SLA for legal review; publish to customer docs
4. **Week 2-3:** Implement read routing; test staging
5. **Week 4:** Failover test; second-operator drill
