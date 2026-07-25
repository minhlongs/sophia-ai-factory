# ADR-0009: Deprecate Supabase — D1-Only from 2026-08-01

## Status: ACCEPTED
## Effective: 2026-08-01

## Context
`land/supabase/` và 4 routes production đang là đường hầm bí mật bỏ qua D1-first doctrine:
- /api/discovery/top-50
- /api/discovery/search
- /api/sophia-index/health
- /api/analytics/licenses

## Decision
- 2026-08-01: land/supabase/ = read-only archive
- 2026-08-15: checkpoint persistence → D1 checkpoints table
- PR mới import @/land/supabase → reject bởi check:layers

## Migration
1. checkpoint-supabase-persistence.ts → D1 checkpoints
2. sophia-index.ts → D1 FTS5 hoặc R2
3. Admin manifest → D1 admin_manifest
