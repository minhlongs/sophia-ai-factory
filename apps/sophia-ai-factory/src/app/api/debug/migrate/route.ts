/**
 * GET /api/debug/migrate — Create missing D1 tables for dashboard features
 * TEMP endpoint — remove after migration complete
 *
 * Security: disabled in production. In non-production environments,
 * requires x-internal-secret header matching INTERNAL_API_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { toError } from '@/seed/utils/to-error';
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret';

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  return null;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT DEFAULT '',
    audience TEXT DEFAULT '',
    status TEXT DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    template_id TEXT,
    script_content TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    platforms TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE,
    subscription_tier TEXT DEFAULT 'BASIC',
    display_name TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS campaign_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    tone TEXT DEFAULT 'casual',
    duration INTEGER DEFAULT 15,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_integrations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    org_id TEXT NOT NULL,
    provider TEXT DEFAULT 'nowpayments',
    event_type TEXT NOT NULL,
    amount REAL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = getD1();
  if (!d1) return NextResponse.json({ error: 'D1 not available' });

  const results: string[] = [];
  for (const sql of MIGRATIONS) {
    try {
      // d1.exec() fails on multiline — use single-line version
      const oneLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      await d1.prepare(oneLine).run();
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
      results.push(`OK: ${tableName}`);
    } catch (e) {
      results.push(`FAIL: ${toError(e).message}`);
    }
  }

  return NextResponse.json({ migrations: results, total: MIGRATIONS.length });
}
