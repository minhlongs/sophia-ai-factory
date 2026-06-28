---
title: "Usage Metering Implementation Plan"
description: "Production-grade usage metering with idempotency, quota enforcement, and Polar.sh integration"
status: pending
priority: P1
effort: 8h
branch: main
tags: [usage-metering, billing, polar-integration, quota-enforcement]
created: 2026-03-07
---

# Usage Metering Implementation Plan

## Overview

Build production-grade usage metering system for Sophia AI Factory with atomic quota enforcement, Polar.sh integration, and comprehensive rollup aggregation.

## Current State (from research)

**Existing:**
- `usage_events` table with basic schema
- Batch ingestion API at `/api/v1/usage/batch`
- Internal query endpoint `/internal/usage/query`
- Idempotency utility (`idempotency.ts`)
- Rollup service (`rollup-service.ts`)
- Polar webhook integration

**Gaps to Address:**
1. Missing `idempotency_key` column and unique index in migration
2. Missing columns: `external_customer_id`, `hour_bucket`, `day_bucket`
3. No atomic quota check PL/pgSQL function
4. No Polar usage reporting webhook
5. No cron job for hourly rollups

## Phases

| Phase | Name | Status |
|-------|------|--------|
| [01](./phase-01-database-migration.md) | Database Migration | pending |
| [02](./phase-02-quota-enforcement.md) | Atomic Quota Enforcement | pending |
| [03](./phase-03-polar-reporting.md) | Polar Usage Reporting | pending |
| [04](./phase-04-rollup-cron.md) | Hourly Rollup Cron Job | pending |
| [05](./phase-05-api-instrumentation.md) | API Instrumentation | pending |
| [06](./phase-06-testing.md) | Comprehensive Testing | pending |

## Dependencies

- Supabase project admin access
- Polar.sh developer account
- Vercel cron job configuration

## Success Criteria

- All database migrations applied with zero downtime
- Quota enforcement atomic (no race conditions)
- Polar webhook syncs usage daily
- Hourly rollups run automatically
- 100% test coverage on core logic

---

**Unresolved Questions:**
1. Does Polar support incremental usage reports or full period summaries only?
2. Should unused hourly credits roll over to next hour?
