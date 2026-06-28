-- Migration 0042: Synthetic monitor user for smoke tests
-- Pre-creates a fixed-UUID user used by /api/cron/smoke-one-time.
-- payment_id LIKE 'SYNTHETIC_%' rows must be excluded from revenue rollups.
-- This user is NOT a real customer — never appears in billing or admin UI.

INSERT OR IGNORE INTO "user" (
  id,
  email,
  emailVerified,
  name,
  role,
  createdAt,
  updatedAt
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'synthetic-monitor@sophia.agencyos.network',
  1,
  'Synthetic Monitor',
  'user',
  datetime('now'),
  datetime('now')
);
