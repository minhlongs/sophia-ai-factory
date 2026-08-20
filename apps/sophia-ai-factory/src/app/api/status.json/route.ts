/**
 * GET /api/status.json - public JSON endpoint for badges/integrations.
 * @module app/api/status.json/route
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { getActiveIncident, getRollup } from '@/land/status/status-store';
import { applyCorsHeaders } from '@/seed/security/cors-security-configuration';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const _db = await getD1();
  if (!_db) {
    const response = NextResponse.json(
      { status: 'unknown', uptime90d: null, incident: null },
      { status: 500 },
    );
    return applyCorsHeaders(response, origin);
  }
  const db = _db;
  try {
    const [active, rollup] = await Promise.all([
      getActiveIncident(db),
      getRollup(db, 90),
    ]);

    const avg90 =
      rollup.length > 0
        ? rollup.reduce((s, r) => s + r.uptimePct, 0) / rollup.length
        : 100;

    const status = active ? (active.severity === 'critical' ? 'down' : 'degraded') : 'operational';

    const response = NextResponse.json(
      {
        status,
        uptime90d: Math.round(avg90 * 100) / 100,
        incident: active
          ? {
              id: active.id,
              title: active.title,
              severity: active.severity,
              startedAt: active.startedAt,
            }
          : null,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
        },
      },
    );
    return applyCorsHeaders(response, origin);
  } catch {
    const response = NextResponse.json(
      { status: 'unknown', uptime90d: null, incident: null },
      { status: 500 },
    );
    return applyCorsHeaders(response, origin);
  }
}
