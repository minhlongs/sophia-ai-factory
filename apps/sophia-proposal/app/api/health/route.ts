/**
 * GET /api/health — Production health check endpoint.
 *
 * Returns system status, D1 connectivity, uptime info.
 * No auth required — used by monitoring/uptime checks.
 */

import { NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const START_TIME = Date.now();

export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // D1 Database check
  const dbStart = Date.now();
  try {
    const db = await getD1Client();
    const { data } = await db.from('users').select('id').single();
    checks.database = {
      status: 'healthy',
      latency_ms: Date.now() - dbStart,
    };
    if (data === undefined) {
      checks.database.status = 'degraded';
    }
  } catch (err) {
    checks.database = {
      status: 'unhealthy',
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'D1 connection failed',
    };
  }

  // Mission templates check (verify seed data)
  try {
    const db = await getD1Client();
    const { data: templates } = await db.from('mission_templates').select('command').eq('is_active', 1);
    const count = Array.isArray(templates) ? templates.length : 0;
    checks.templates = {
      status: count >= 15 ? 'healthy' : 'degraded',
      latency_ms: 0,
    };
  } catch {
    checks.templates = { status: 'degraded' };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');

  const status = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  return NextResponse.json({
    status,
    version: process.env.npm_package_version ?? '1.0.0',
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    checks,
    timestamp: new Date().toISOString(),
    region: process.env.CF_REGION ?? 'unknown',
  }, {
    status: status === 'unhealthy' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
