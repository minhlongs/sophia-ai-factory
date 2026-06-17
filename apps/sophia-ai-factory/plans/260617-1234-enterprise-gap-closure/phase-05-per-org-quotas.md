# Phase 05 — Per-Organization Quotas

## Context Links

- Primary source: `plans/260521-2342-go-live-100-audit/reports/phase5-go-live-scorecard.md` (Reliability + Scalability categories)
- Related: V-1.3 org_id enforcement shipped in Wave B; this extends to quota enforcement at org level
- Related: TIER_CONFIGS already have per-user campaign limits; need org-level aggregations

## Overview

- **Priority:** P1 (independent quick win; can run in parallel)
- **Status:** pending
- **Description:** Implement per-organization quota enforcement for missions, credentials, members, webhooks, and API rate limits. Audit existing data for overruns and define remediation path.

## Key Insights

- Current tier limits (`TIER_CONFIGS`) are per-user (`user_id` scope), not per-org
- Multi-tenant orgs may have multiple users sharing org quota; current code does not aggregate
- Gap: Reliability lost points on "quota enforcement" because org-level limits are missing
- This is a relatively contained change: modify quota check functions to aggregate by `org_id` instead of `user_id` where org exists

## Requirements

### Functional
1. **Org-level quota definitions** — Extend tier config with org quotas (missions, credentials, members, webhooks)
2. **Quota check middleware** — Update all quota enforcement points to check org aggregate, not just user
3. **Overage audit** — Query current data to identify orgs exceeding new quotas; report and remediate
4. **Admin dashboard** — View org quota usage; set custom overrides for high-value customers
5. **Soft limit enforcement** — Warn at 80%, hard block at 100% (except legacy overrunners)

### Non-functional
- Quota check adds < 5ms to request latency (cached org usage counts)
- Override mechanism allows admin to set custom limits per org (bypass defaults)
- Migrations must not block production during rollout (gradual feature flag)

## Architecture

### Extended Tier Config

```typescript
// src/seed/config/tiers/tier-configs.ts
interface OrgQuota {
  missions: number;
  credentials: number;
  members: number;
  webhooks: number;
  apiKeys: number;
}

const ORG_QUOTA_MULTIPLIER: Record<Tier, number> = {
  BASIC: 1,       // org quota = user quota × 1
  PREMIUM: 3,     // org quota = user quota × 3
  ENTERPRISE: 10, // org quota = user quota × 10
  MASTER: 100,    // org quota = user quota × 100 (effectively unlimited)
};

function getOrgQuota(tier: Tier, userCount: number): OrgQuota {
  const base = TIER_CONFIGS[tier];
  const multiplier = ORG_QUOTA_MULTIPLIER[tier];
  return {
    missions: base.maxCampaigns * multiplier,
    credentials: base.maxCredentials * multiplier,
    members: base.maxTeamMembers * multiplier,
    webhooks: base.maxWebhooks * multiplier,
    apiKeys: base.maxApiKeys * multiplier,
  };
}
```

### Quota Check Middleware

Update existing quota checkers (`src/forest/quota/`) to accept `orgId` parameter:

```typescript
// src/forest/quota/quota-checker.ts (existing)
export async function checkCampaignQuota(userId: string, tier: Tier): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();
  const { data } = await db
    .from('campaigns')
    .select('id')
    .eq('user_id', userId); // CURRENT: user-scoped

  return { allowed: data.length < TIER_CONFIGS[tier].campaignsPerMonth, current: data.length, limit: TIER_CONFIGS[tier].campaignsPerMonth };
}

// UPDATED
export async function checkCampaignQuota(userId: string, orgId: string | null, tier: Tier): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = createServerClient();

  // If orgId exists, check org aggregate; else fall back to user
  const filter = orgId ? { org_id: orgId } : { user_id: userId };
  const { data } = await db.from('campaigns').select('id').filter(filter);

  const effectiveLimit = orgId
    ? getOrgQuota(tier, /*userCount=*/1).missions // derive from tier
    : TIER_CONFIGS[tier].campaignsPerMonth;

  return { allowed: data.length < effectiveLimit, current: data.length, limit: effectiveLimit };
}
```

### Migration: Identify Overrunners

```sql
-- scripts/audit/org-overrunners.sql
WITH org_usage AS (
  SELECT org_id, COUNT(*) as mission_count
  FROM campaigns
  WHERE org_id IS NOT NULL
  GROUP BY org_id
),
org_tier AS (
  SELECT u.id as user_id, u.org_id, t.tier
  FROM users u
  JOIN raas_licenses rl ON u.id = rl.user_id
  JOIN user_tier ut ON u.id = ut.user_id
  JOIN tiers t ON ut.tier_id = t.id
  WHERE u.org_id IS NOT NULL
)
SELECT o.org_id, o.mission_count, t.tier, t.campaignsPerMonth as user_limit,
  (t.campaignsPerMonth * ORG_QUOTA_MULTIPLIER[t.tier]) as org_limit
FROM org_usage o
JOIN org_tier t ON o.org_id = t.org_id
WHERE o.mission_count > (t.campaignsPerMonth * ORG_QUOTA_MULTIPLIER[t.tier]);
```

Run this query and generate report `docs/quota-overrunners-audit.md`.

### Admin Dashboard Override API

```typescript
// src/app/api/admin/orgs/[orgId]/quota/route.ts
export const PATCH = withAuth(async (req: Request, { params, user }: { params: { orgId: string }, user: User }) => {
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { campaigns, credentials, members, webhooks, apiKeys } = await req.json();

  // Upsert custom quota for this org
  const db = createServerClient();
  await db.from('org_quota_overrides').insert({
    org_id: params.orgId,
    campaigns,
    credentials,
    members,
    webhooks,
    apiKeys,
    set_by: user.id,
    set_at: Math.floor(Date.now() / 1000),
  }).onConflict('org_id').doUpdate();

  return NextResponse.json({ status: 'overridden' });
});
```

## Related Code Files

**Files to create:**
- `src/seed/config/tiers/org-quota-multiplier.ts` — multiplier mapping
- `src/forest/quota/org-quota-checker.ts` — new org-aware quota functions
- `migrations/0124-org-quota-overrides-table.sql`
- `scripts/audit/org-overrunners.sql`
- `docs/quota-overrunners-audit.md` (auto-generated)
- `src/app/api/admin/orgs/[orgId]/quota/route.ts`
- `docs/runbooks/QUOTA-ENFORCEMENT.md`

**Files to modify:**
- `src/app/api/v1/campaigns/create/route.ts` — call org-quota checker if `org_id` present
- `src/app/actions/credentials/add-credential/` — add org quota check
- `src/app/actions/orgs/add-member/` — add org member quota check
- `src/app/actions/webhooks/create/` — add org webhook quota check
- `src/forest/quota/quota-checker.ts` — extend to support org parameter
- `src/seed/db/get-user-tier.ts` — expose orgId lookup

## Implementation Steps

1. **Define org quota multipliers** — decide tier multipliers (1/3/10/100)
2. **Create `org-quota-multiplier.ts`** — export `getOrgQuota()` function
3. **Build `org-quota-checker.ts`** — mirror existing user-quota functions but org-aware
4. **Write audit query** — `org-overrunners.sql`; generate report
5. **Create `org_quota_overrides` table** — migration `0124`
6. **Instrument mutation endpoints** — replace user-quota calls with org-quota where applicable
   - Campaign create (`/api/v1/campaigns/create`)
   - Credential add (BYOK)
   - Org member add
   - Webhook create
7. **Add admin override API** — `PATCH /api/admin/orgs/[orgId]/quota`
8. **Run overrunners audit** — execute query; publish report; contact affected orgs
9. **Feature flag rollout** — use `ENABLE_ORG_QUOTAS` env var; gradually enable
10. **Monitor enforcement** — watch for blocked legitimate users; adjust overrides
11. **Document runbook** — how to handle overage complaints, set custom limits

## Todo List

- [ ] Define org quota multipliers per tier (product decision)
- [ ] Create `org-quota-multiplier.ts`
- [ ] Build `org-quota-checker.ts` with tests
- [ ] Write `org-overrunners.sql` audit query; run on prod
- [ ] Create `0124-org-quota-overrides-table.sql` migration
- [ ] Update campaign create endpoint to use org quota
- [ ] Update credentials add action to use org quota
- [ ] Update org member add action to use org quota
- [ ] Update webhook create action to use org quota
- [ ] Build admin override API
- [ ] Feature flag: add `ENABLE_ORG_QUOTAS`
- [ ] Run end-to-end test on staging
- [ ] Generate `docs/quota-overrunners-audit.md` report
- [ ] Soft launch with 10% of org traffic; monitor errors
- [ ] Full rollout to 100%
- [ ] Document runbook; train support team

## Success Criteria

- ✅ All quota check endpoints use org-aware logic when `org_id` present
- ✅ `org_quota_overrides` table populated for any needed custom limits
- ✅ Audit report `docs/quota-overrunners-audit.md` exists with list of overrunning orgs
- ✅ Admin dashboard (or API) can view and modify org quotas
- ✅ No regression: user-only accounts (no org) still respect per-user limits
- ✅ Feature flag rollout: start 10% → 100% with zero Sev-2 incidents

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Org quota too low blocks legitimate usage | High | Med | Start with conservative (high) multipliers; overrides available |
| Migration misses org_id assignments | Med | High | Audit all users for org_id; backfill missing |
| Performance: org count queries slow | Low | Med | Cache org usage in memory (5min TTL) |
| Override API unauthorized access | Low | High | Strict admin check; audit log all changes |
| Customer backlash on sudden enforcement | High | Med | Gradual rollout; communicate; use soft warnings first |

## Security Considerations

- Org membership must be verified before quota aggregation (prevent quota sharing attacks)
- Admin override API must be protected by `role='admin'` and logged to `audit_log`
- Override values should have upper bound (e.g., no org can exceed MASTER tier × 10)
- Quota checks must be idempotent (no race condition where 2 requests both see < limit and both succeed)

## Next Steps

1. **Product decision:** Org quota multipliers per tier — meet with CEO to confirm
2. **Week 1:** Build org-quota-checker; write tests
3. **Week 2:** Instrument endpoints; build admin override API
4. **Week 3:** Overrunners audit; generate report; prepare customer comms template
5. **Week 4:** Staging test; feature flag rollout
