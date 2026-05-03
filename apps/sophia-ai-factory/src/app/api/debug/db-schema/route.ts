/**
 * GET /api/debug/db-schema — List all D1 tables + subscriptions data
 * TEMP diagnostic endpoint — remove after debug
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

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const d1 = getD1();
  if (!d1) return NextResponse.json({ error: 'D1 not available' });

  const tables = await d1.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

  let subscriptions = null;
  let subsSchema = null;
  try {
    subsSchema = await d1.prepare("PRAGMA table_info(subscriptions)").all();
    subscriptions = await d1.prepare('SELECT * FROM subscriptions LIMIT 10').all();
  } catch (e) { subscriptions = { error: toError(e).message }; }

  let orgBalances = null;
  try {
    orgBalances = await d1.prepare('SELECT * FROM org_balances LIMIT 10').all();
  } catch (e) { orgBalances = { error: toError(e).message }; }

  let users = null;
  try {
    users = await d1.prepare('SELECT id, email, role FROM users LIMIT 10').all();
  } catch (e) { users = { error: toError(e).message }; }

  let campaigns = null;
  try { campaigns = await d1.prepare('SELECT id, user_id, title, status, created_at FROM campaigns ORDER BY created_at DESC LIMIT 10').all(); } catch (e) { campaigns = { error: toError(e).message }; }

  let orgMembers = null;
  try { orgMembers = await d1.prepare('SELECT user_id, org_id, role FROM org_members LIMIT 20').all(); } catch (e) { orgMembers = { error: toError(e).message }; }

  return NextResponse.json({ tables: tables.results, subsSchema: subsSchema?.results, subscriptions, orgBalances, users, campaigns, orgMembers });
}
