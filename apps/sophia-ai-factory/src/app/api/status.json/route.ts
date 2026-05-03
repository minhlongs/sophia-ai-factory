/**
 * GET /api/status.json — public JSON endpoint for badges/integrations.
 * @module app/api/status.json/route
 */

import { NextResponse } from 'next/server';
import { getD1Raw } from '@/lib/db/client';
import { getActiveIncident, getRollup } from '@/lib/status/status-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getD1Raw();
    const [active, rollup] = await Promise.all([
      getActiveIncident(db),
      getRollup(db, 90),
    ]);

    const avg90 =
      rollup.length > 0
        ? rollup.reduce((s, r) => s + r.uptimePct, 0) / rollup.length
        : 100;

    const status = active ? (active.severity === 'critical' ? 'down' : 'degraded') : 'operational';

    return NextResponse.json({
      status,
      uptime90d: Math.round(avg90 * 100) / 100,
      incident: active
        ? { id: active.id, title: active.title, severity: active.severity, startedAt: active.startedAt }
        : null,
      checkedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ status: 'unknown', uptime90d: null, incident: null }, { status: 500 });
  }
}
