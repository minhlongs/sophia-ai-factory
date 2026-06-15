---
title: "Phase 6: Billing Reconciliation & Usage Export"
description: Secure usage export system with CSV/JSON format, Polar.sh billing period support, and scheduled daily exports
status: pending
priority: P1
effort: 8h
branch: main
tags: [billing, export, reconciliation, cron, audit]
created: 2026-03-08
---

# Phase 6: Billing Reconciliation & Usage Export - Implementation Plan

## Overview

Build a secure, auditable usage export system for billing reconciliation with support for Polar.sh billing periods, multiple export formats, and automated scheduled exports.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Usage Export Architecture                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Admin UI   │     │   API Keys   │     │  Scheduled   │                │
│  │  Dashboard   │     │  (mk_ keys)  │     │    Cron      │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                     │                         │
│         └────────────────────┼─────────────────────┘                         │
│                              │                                               │
│                     ┌────────▼────────┐                                      │
│                     │  POST /api/     │                                      │
│                     │  usage/export   │                                      │
│                     └────────┬────────┘                                      │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                          │
│         │                    │                    │                          │
│  ┌──────▼───────┐   ┌───────▼────────┐  ┌───────▼───────┐                   │
│  │   JWT +      │   │  Export        │  │   Audit       │                   │
│  │  API Key     │   │  Service       │  │   Logger      │                   │
│  │  Auth        │   │  (query +      │  │   (all        │                   │
│  │              │   │   format)      │  │   requests)   │                   │
│  └──────────────┘   └───────┬────────┘  └───────────────┘                   │
│                             │                                                │
│              ┌──────────────┼───────────────┐                               │
│              │              │               │                                │
│     ┌────────▼───────┐ ┌───▼────────┐ ┌───▼────────┐                       │
│     │ usage_events   │ │ raas_      │ │ overage_   │                       │
│     │     table      │ │ licenses   │ │  events    │                       │
│     │                │ │   table    │ │   table    │                       │
│     └────────────────┘ └────────────┘ └────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Data Flow:
1. Authentication: JWT (user) + mk_ API key (authorization)
2. Query: Filter by billing period, customer, license
3. Format: JSON (API) or CSV (download)
4. Audit: Log all export requests with receipt
5. Schedule: Daily cron at 02:00 UTC for automatic export
```

## Success Criteria

- [ ] POST /api/usage/export endpoint with JWT + API key auth
- [ ] CSV/JSON export with standardized fields (tenant_id, feature_key, quantity, timestamp)
- [ ] Polar.sh billing period query support (weekly/monthly)
- [ ] Idempotency via KV store for export deduplication
- [ ] Audit logging for all export requests
- [ ] Daily cron job for automatic export at 02:00 UTC
- [ ] Dashboard UI for manual export trigger + status display

## Phases

| Phase | Description | Status | Effort |
|-------|-------------|--------|--------|
| [Phase 01](./phase-01-usage-export-types.md) | TypeScript types and validation schemas | pending | 1h |
| [Phase 02](./phase-02-usage-export-api.md) | API route implementation | pending | 2h |
| [Phase 03](./phase-03-export-service.md) | Business logic for querying and formatting | pending | 2h |
| [Phase 04](./phase-04-scheduled-export.md) | Cron job for automatic daily export | pending | 1.5h |
| [Phase 05](./phase-05-export-dashboard.md) | Dashboard UI for manual export + status | pending | 1.5h |

## Dependencies

- Existing `usage_events` table with idempotency_key
- Existing `raas_licenses` table with polar_customer_id
- Existing `overage_events` table
- Existing audit logging system (`audit-logger.ts`)
- Existing API key validator (`api-key-validator.ts`)

## Related Files

- `src/lib/supabase/types.ts` - Database types
- `src/lib/usage-metering/types.ts` - Usage metering types
- `src/lib/usage-metering/export.ts` - Existing export utilities
- `src/lib/security/api-key-validator.ts` - API key validation
- `src/lib/audit/audit-logger.ts` - Audit logging
- `src/app/api/usage/export/route.ts` - Existing export API (will be extended)
- `src/app/api/cron/daily-rollup/route.ts` - Cron pattern reference

## Unresolved Questions

1. Should export include raw token counts or just credits for billing?
2. What's the retention period for export audit logs?
3. Should we support real-time webhook notifications for completed exports?
