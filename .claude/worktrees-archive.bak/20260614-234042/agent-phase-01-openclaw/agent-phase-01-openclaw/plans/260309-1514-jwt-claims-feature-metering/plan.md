---
title: "Phase 6: JWT Claims Enrichment + Feature-Level Metering"
description: "Implement JWT claims enrichment with license context and feature-level usage metering for granular billing tracking"
status: pending
priority: P1
effort: 8h
branch: main
tags: [jwt, metering, billing, raas, phase-6]
created: 2026-03-09
---

# Phase 6: JWT Claims Enrichment + Feature-Level Metering

**Research Complete:** `plans/reports/researcher-260309-1509-jwt-claims-enrichment.md`

## Overview

Implement enriched JWT claims with license metadata for Cloudflare Worker enforcement and feature-level metering for granular usage attribution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Authentication Flow (Enriched JWT)                             │
├─────────────────────────────────────────────────────────────────┤
│  1. User Login/API Key → 2. Fetch License+Quota+Polar          │
│  3. Build Enriched Claims → 4. Sign JWT → 5. Client receives   │
│                                                                   │
│  JWT Payload: {                                                 │
│    sub, iat, exp, license_nonce, license_tier,                 │
│    quota: { dailyCredits, hourlyCredits, ... },                │
│    polar_customer_id, agency_id, dunning_state                 │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Feature-Level Metering Flow                                    │
├─────────────────────────────────────────────────────────────────┤
│  API Request → Extract Feature Context → Usage Event → Queue   │
│                                                                   │
│  UsageEvent: {                                                  │
│    user_id, license_nonce, feature_key, feature_name,          │
│    service, action, credits_used, tokens_in/out,               │
│    tenant_id, agency_id, polar_customer_id                     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | Component | File | Effort |
|-------|-----------|------|--------|
| 1 | DB Schema Updates | `supabase/migrations/*.sql` | 1h |
| 2 | JWT Claims Enrichment Service | `src/lib/auth/enriched-jwt.ts` | 2h |
| 3 | API Key License Integration | `src/lib/raas-gate.ts` | 1.5h |
| 4 | Feature-Level Metering | `src/lib/usage-metering/` | 2h |
| 5 | Rate Limiter Alignment | `src/lib/security/rate-limiter.ts` | 1h |
| 6 | Testing & Validation | `src/**/*.test.ts` | 0.5h |

## Dependencies

- **Blocks:** Phase 7 - Analytics Dashboard Integration
- **Blocked By:** Research report (complete)
- **Related:** `plans/260309-1120-phase6-roiaas-billing-enforcement/plan.md`

## Success Criteria

- [ ] Enriched JWT contains license tier, quota, Polar customer ID
- [ ] Feature-level events captured with `feature_key`, `feature_name`
- [ ] Cloudflare Worker can enforce quota without DB lookup
- [ ] Rate limiter uses enriched claims for per-tier limits
- [ ] All tests pass: `npm test`
- [ ] Build passes: `npm run build`

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| JWT secret not configured | High | Use `JWT_SECRET=REDACTED` env var with fallback warning |
| Quota cache staleness | Medium | 1-hour JWT TTL + cache invalidation on usage |
| Feature attribution gaps | Medium | Default to `unknown` feature if context missing |

---

**Next:** See phase files for detailed implementation steps.
