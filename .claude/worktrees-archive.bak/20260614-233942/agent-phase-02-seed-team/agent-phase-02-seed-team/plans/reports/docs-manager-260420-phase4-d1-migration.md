# Phase 4 D1 Migration Docs Update

**Date:** 2026-04-20  
**Status:** COMPLETE

## Changes Made

### Files Updated

#### 1. `docs/system-architecture.md`
- **api_keys row schema:** Updated from `revoked_at` legacy fields to D1 canonical: `is_active, expires_at, rate_limit_per_minute` (Phase 4 migration)
- **Feature Tables section:** Added 2 new D1 tables:
  - `rate_limits` — identifier PK, atomic counter + window_start index (Phase 4 D1)
  - `export_jobs` — org_id, license_nonce, period_start/end, record_count, success, error_message (Phase 4 cron)

#### 2. `docs/cloud-infrastructure.md`
- **D1 metadata:** Updated table count: 42 → 44 tables
- **D1 metadata:** Updated migrations: 0001–0005 → 0001–0014 (Phase 4 tech debt closure)
- **Tables section:** Added new "Operations" category row with rate_limits + export_jobs
- **Migrations subsection:** Added Phase 4 note: "rate_limits atomic counter + export_jobs cron tracking (replaces Supabase legacy tables)"
- **Layer 1 audit:** Added Phase 4 improvements callout (rate_limits atomic, export_jobs cron, api_keys D1 canonical)

#### 3. `docs/code-standards.md`
- **Status:** Does not exist. No changes needed.

## No Breaking Changes

- Backward-compat aliases (`keyId`, `ownerId`) preserved on `ApiKeyInfo` interface (callers unchanged)
- All D1 migrations use `IF NOT EXISTS` for idempotency
- Rate limiter + export cron fully typed (zero `:any`)

## Summary

Tech docs synchronized with Phase 4 D1 schema consolidation. All references are to code already merged to main.

- **Files edited:** 2/3 (system-architecture.md, cloud-infrastructure.md)
- **Files skipped:** 1/3 (code-standards.md does not exist)
- **Total LOC added:** ~15 lines (minimal, KISS principle)
