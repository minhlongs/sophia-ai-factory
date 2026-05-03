/**
 * GET /api/setup/local-mode/status
 *
 * Returns provisioning state + health for the current user's Local Mode.
 * Queries D1: users table for endpoint, signals_events for last health signal.
 * Phase E (UI polling). Phase D writes the local_mode_endpoint column.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'stale' | 'failed' | 'unknown';

interface StatusResponse {
  provisioned: boolean;
  endpoint_hostname: string | null;
  last_health_at: string | null;
  status: HealthStatus;
}

// Signal event types written by Phase F health-check cron
const LOCAL_MODE_HEALTHY   = 'local_mode_healthy';
const LOCAL_MODE_UNHEALTHY = 'local_mode_unhealthy';

const HEALTHY_THRESHOLD_MS  = 5  * 60 * 1000; // 5 min → healthy
const STALE_THRESHOLD_MS    = 60 * 60 * 1000; // 60 min → stale; beyond = failed

// ── Helper: derive status from last signal row ─────────────────────────────────

function deriveStatus(
  eventType: string | null,
  ts: number | null,
): HealthStatus {
  if (!eventType || !ts) return 'unknown';
  if (eventType === LOCAL_MODE_UNHEALTHY) return 'failed';
  const ageMs = Date.now() - ts;
  if (ageMs < HEALTHY_THRESHOLD_MS)  return 'healthy';
  if (ageMs < STALE_THRESHOLD_MS)    return 'stale';
  return 'failed';
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    const db = env?.DB as D1Database | undefined;

    if (!db) {
      // No D1 in this environment (e.g. local dev without binding) — return unknown
      const body: StatusResponse = { provisioned: false, endpoint_hostname: null, last_health_at: null, status: 'unknown' };
      return NextResponse.json(body);
    }

    // ── 1. Check if user has a local_mode_endpoint ────────────────────────────
    const userRow = await db
      .prepare('SELECT local_mode_endpoint FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ local_mode_endpoint: string | null }>();

    const endpoint = userRow?.local_mode_endpoint ?? null;

    if (!endpoint) {
      const body: StatusResponse = { provisioned: false, endpoint_hostname: null, last_health_at: null, status: 'unknown' };
      return NextResponse.json(body);
    }

    // ── 2. Find most recent local_mode health signal for this user ────────────
    let lastHealthAt: string | null = null;
    let healthStatus: HealthStatus = 'unknown';

    try {
      const signal = await db
        .prepare(
          `SELECT event_type, ts FROM signals_events
           WHERE actor = ? AND event_type IN (?, ?)
           ORDER BY ts DESC LIMIT 1`,
        )
        .bind(user.id, LOCAL_MODE_HEALTHY, LOCAL_MODE_UNHEALTHY)
        .first<{ event_type: string; ts: number }>();

      if (signal) {
        lastHealthAt = new Date(signal.ts).toISOString();
        healthStatus = deriveStatus(signal.event_type, signal.ts);
      }
    } catch {
      // signals_events table may not exist yet (Phase F pending) — return unknown
    }

    // Extract hostname from endpoint URL
    let hostname: string | null = null;
    try { hostname = new URL(endpoint).hostname; } catch { hostname = endpoint; }

    const body: StatusResponse = {
      provisioned: true,
      endpoint_hostname: hostname,
      last_health_at: lastHealthAt,
      status: healthStatus,
    };
    return NextResponse.json(body);

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
