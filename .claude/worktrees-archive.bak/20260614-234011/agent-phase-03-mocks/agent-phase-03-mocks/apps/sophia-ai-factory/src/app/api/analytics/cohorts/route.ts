/**
 * GET /api/analytics/cohorts
 *
 * Single cohort analytics endpoint with metric switch.
 * Admin-only: returns 401 for unauth, 403 for non-admin.
 *
 * Query params:
 *   metric  — 'retention' | 'churn' | 'ltv'  (required)
 *   months  — 1–24  (default 12, applies to retention)
 *   tier    — optional tier filter (BASIC|PREMIUM|ENTERPRISE|MASTER)
 *
 * Returns:
 *   retention → CohortRetentionMatrix
 *   churn     → ChurnTimeline
 *   ltv       → LTVByTier
 *
 * Cache-Control: private, max-age=300 (5 min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkAdmin } from '@/land/analytics/rbac';
import { fetchCohortRetention, getD1Database } from '@/land/analytics/cohort-calculator';
import { fetchChurnTimeline } from '@/land/analytics/churn-calculator';
import { calculateLTVByTier } from '@/land/analytics/ltv-calculator';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';


// ── Zod validation ───────────────────────────────────────────────────────────

const VALID_TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

const cohortQuerySchema = z.object({
  metric: z.enum(['retention', 'churn', 'ltv']),
  months: z.coerce.number().int().min(1).max(24).default(12),
  tier: z.enum(VALID_TIERS).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function cacheResponse(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized — authentication required' },
        { status: 401 },
      );
    }

    // Admin gate
    const isAdmin = await checkAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden — cohort analytics requires admin role' },
        { status: 403 },
      );
    }

    // Validate query params
    const params = request.nextUrl.searchParams;
    const validation = cohortQuerySchema.safeParse({
      metric: params.get('metric') ?? undefined,
      months: params.get('months') ?? undefined,
      tier: params.get('tier') ?? undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { metric, months, tier } = validation.data;

    logger.info('[Analytics Cohorts] Request', { userId: user.id, metric, months, tier });

    const db = getD1Database();

    // ── Metric switch ──
    if (metric === 'retention') {
      const matrix = await fetchCohortRetention(db, months);
      // Optional tier filter: filter cohort rows but this is user-count data
      // Retention is per-cohort (all users), tier filter noted but cohorts are global
      return cacheResponse({ ...matrix, meta: { metric, months, tier: tier ?? null } });
    }

    if (metric === 'churn') {
      const timeline = await fetchChurnTimeline(db, months * 30);
      return cacheResponse({ ...timeline, meta: { metric, months, tier: tier ?? null } });
    }

    // metric === 'ltv'
    // Optional: parse CAC overrides from query ?cac_BASIC=50&cac_PREMIUM=100 etc.
    const cacOverride: Partial<Record<Tier, number>> = {};
    for (const t of VALID_TIERS) {
      const val = params.get(`cac_${t}`);
      if (val) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) cacOverride[t] = n;
      }
    }

    const ltvData = await calculateLTVByTier(db, Object.keys(cacOverride).length > 0 ? cacOverride : undefined);
    return cacheResponse({ ...ltvData, meta: { metric, months, tier: tier ?? null } });

  } catch (err) {
    logger.error(
      '[Analytics Cohorts] Error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { error: 'Failed to fetch cohort analytics' },
      { status: 500 },
    );
  }
}
