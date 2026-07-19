# Runbook: Quota Overrun

**Severity:** P2 (warning) / P1 if affecting many customers
**Owner:** Platform / Billing team

---

## Symptoms

- Customers reporting "quota exceeded" despite being within limits
- `quota_enforcer` logs showing excessive rejections
- D1 queries failing with `quota_exceeded` errors
- R2 storage approaching 100% of plan limit
- CPU time spikes in Cloudflare billing metrics

---

## Diagnosis

### 1. Check current quota usage

```bash
# Query per-customer quota usage (top 10)
npx wrangler d1 execute sophia-raas-db --remote --command "
  SELECT
    customer_id,
    tier,
    videos_generated,
    videos_limit,
    storage_bytes,
    storage_limit,
    (storage_bytes * 100.0 / storage_limit) as storage_pct
  FROM customer_quotas
  ORDER BY storage_pct DESC
  LIMIT 10;
"
```

Identify customers near or over limits.

### 2. Check global platform quotas

- Cloudflare Worker CPU time limit (10ms per request average, 500ms burst)
- D1 database size (10GB limit on free tier, 50GB on paid)
- R2 storage (per bucket limits)

```bash
npx wrangler d1 info sophia-raas-db
npx wrangler r2 bucket list  # check bucket sizes if possible
```

### 3. Check `quota_enforcer` logs

```bash
npx wrangler tail --name sophia-ai-factory --since 1h | grep -i quota
```

Look for patterns:
- Specific customer ID repeatedly blocked
- Time of day spikes (batch processing?)
- Particular operation (video generation, upload)

### 4. Verify billing tier configuration

```sql
SELECT tier, videos_limit, storage_limit_gb
FROM tier_configs;
```

Ensure tier limits match pricing plans.

### 5. Check for abuse

A single customer may be hitting hard limits due to:
- Bug in client causing infinite loops
- Bot/scraper making excessive requests
- Legitimate growth (needs tier upgrade)

---

## Remediation

### Case A: Legitimate customer growth (quota increase needed)

1. Contact customer about upgrading tier
2. Temporarily increase quota if justified:

```sql
UPDATE customer_quotas
SET videos_limit = videos_limit * 2,
    storage_limit = storage_limit * 2
WHERE customer_id = '<customer-uuid>';
```

3. Set expiry for temporary boost:

```sql
INSERT INTO quota_overrides (customer_id, videos_extra, storage_extra, expires_at)
VALUES ('<uuid>', 100, 10GB, datetime('now', '+7 days'));
```

### Case B: Bug causing excessive usage

1. Identify affected customers and reset their counters:

```sql
UPDATE customer_quotas
SET videos_generated = 0,
    storage_bytes = 0
WHERE customer_id IN ('<list>');
```

2. Deploy fix for bug (see `forest/quota/quota-enforcer.ts` and `land/billing/usage-aggregator.ts`)
3. Monitor to ensure reset took effect

### Case A: Platform-wide capacity exhausted (D1 size)

If D1 database is near 10GB limit:

1. Archive old logs:

```bash
node scripts/archive-old-logs.mjs --days 90
```

2. Increase plan (Cloudflare paid tier) if sustained usage

### Case D: R2 storage overrun

R2 buckets have per-object and total limits.

```bash
# Count objects and total size (approximate via listing)
npx wrangler r2 object list sophia-ai-factory-opennext-cache --summary
```

Clean up old cache objects:

```bash
# Delete objects older than 30 days
node scripts/cleanup-r2-cache.mjs --older-than 30
```

---

## Quota Enforcement Configuration

The `quota_enforcer` (in `forest/quota/quota-enforcer.ts`) checks:

1. **Hard limit** — immediate rejection if exceeded
2. **Soft limit** — warning but allow (configurable)
3. **Burst allowance** — short-term overage permitted

Adjust thresholds in `src/forest/quota/quota-config.ts`:

```typescript
export const QUOTA_CONFIG = {
  HARD_LIMIT_PCT: 100,    // reject at 100%
  SOFT_LIMIT_PCT: 80,    // warn at 80%
  BURST_ALLOWANCE: 10,   // allow 10% over soft limit temporarily
};
```

After modifying, redeploy to apply changes.

---

## Escalation

Escalate to CTO if:

- Multiple customers simultaneously over quota due to system bug
- D1 or R2 is at hard capacity and cannot be increased immediately
- Abuse detected that requires IP blocking or account suspension
- Quota accounting is incorrect (customer reports usage not reflected in counters)

---

## Prevention

- Daily quota usage report emailed to ops team
- Alert at 80% platform capacity (D1 size, R2 size)
- Quota counters reset monthly for non-enterprise tiers (cron job)
- Customer self-service quota monitoring in dashboard (already implemented)
- Grace period of 10% over soft limit before hard reject

---

## Monitoring Queries

Honeycomb (if enabled):

```
p99(storage_bytes) BY tier
count(quota_exceeded) WHERE tier != 'ENTERPRISE'
```

Cloudflare Analytics:

- Worker CPU time
- Requests by customer ID (if logged)

---

## Post-Incident

1. Identify root cause of overrun
2. Adjust quota limits or pricing if tiers are too restrictive
3. Add alerts for approaching limits (per-customer and platform-wide)
4. Consider implementing quota purchase flow for instant upgrades
5. Document lessons learned
