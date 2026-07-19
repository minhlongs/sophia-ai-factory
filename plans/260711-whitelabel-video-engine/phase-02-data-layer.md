---
phase: 2
title: "Data Layer"
status: pending
priority: P2
dependencies: [1]
---

# Phase 2: Data Layer

## Overview

Create database schema for agency multi-tenancy. Migrations 0218–0221 add agency-scoped tables and nullable agency_id FK columns on existing write tables.

## Requirements

- Functional: All agency data isolated by agency_id at query layer
- Non-functional: Backward-compatible migration (nullable FK, existing rows unaffected)

## Architecture

Single D1 with agency_id foreign key pattern.

Migration order:
- 0218: agency (id, name, slug, tier, api_key_hash, branding_json, created_at)
- 0219: sub_tenant (id, agency_id FK, name, email, role, created_at)
- 0220: agency_credit_ledger (id, agency_id FK, balance, credits_reserved, credits_used, tier)
- 0221: usage_log (id, agency_id FK, video_job_id, credits_delta, meta_json, created_at)

Existing write tables gain nullable agency_id column in migration 0218.

## Related Code Files

- Create: `migrations/0218-agency-tables.sql`, `0219-sub-tenant.sql`, `0220-agency-credit-ledger.sql`, `0221-usage-log.sql`
- Modify: None (apply via scripts/apply-migrations.sh)

## Implementation Steps

1. Write migration 0218: agency + agency_id on existing tables
2. Write migration 0219: sub_tenant with FK → agency
3. Write migration 0220: agency_credit_ledger
4. Write migration 0221: usage_log
5. Apply: `bash scripts/apply-migrations.sh`
6. Verify all tables in D1 console

## Success Criteria

- [ ] 4 migrations applied cleanly via `bash scripts/apply-migrations.sh` (exit 0)
- [ ] All tables visible in D1
- [ ] Existing queries unaffected (nullable FK)

## Risk Assessment

- Migration conflicts with Social RNN: 0218–0221 = WhiteLabel, 0222–0224 = Social RNN (sequential, no collision).
