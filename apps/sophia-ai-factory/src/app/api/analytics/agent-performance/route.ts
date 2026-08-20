/**
 * GET /api/analytics/agent-performance
 *
 * Returns aggregated agent task metrics from signals_events.
 * Tier gate: BASIC+ (any authenticated user).
 *
 * Query params:
 *   window  — '24h' | '7d' (default: '24h')
 *   role    — optional filter to a specific agent role
 *
 * Edge runtime compatible (Cloudflare Workers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  resolveAgentPerformance,
  getD1ForAnalytics,
  type WindowOption,
  type AgentPerformanceReport,
} from '@/land/analytics/agent-performance-resolver';


// ── Validation ───────────────────────────────────────────────────────────────

const querySchema = z.object({
  window: z.enum(['24h', '7d']).default('24h'),
  role: z.string().min(1).optional(),
});

function emptyAgentPerformanceReport(window: WindowOption): AgentPerformanceReport {
  return {
    window,
    generated_at: new Date().toISOString(),
    roles: [],
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth — any authenticated user (BASIC+)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    // Validate query params
    const sp = request.nextUrl.searchParams;
    const validation = querySchema.safeParse({
      window: sp.get('window') ?? '24h',
      role: sp.get('role') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { window: win, role } = validation.data;

    logger.info('[Analytics AgentPerformance] Query', {
      userId: user.id,
      window: win,
      role,
    });

    // org_id: use user.id as org scope (Sophia is single-tenant per user)
    const orgId = (user as Record<string, unknown>).orgId as string | undefined ?? user.id;

    let report: AgentPerformanceReport;
    try {
      const db = await getD1ForAnalytics();
      report = await resolveAgentPerformance(db, orgId, win as WindowOption, role);
    } catch (error) {
      logger.warn('[Analytics AgentPerformance] Returning empty report', {
        reason: error instanceof Error ? error.message : String(error),
      });
      report = emptyAgentPerformanceReport(win as WindowOption);
    }

    return NextResponse.json(report);
  } catch (error) {
    logger.error(
      '[Analytics AgentPerformance] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
