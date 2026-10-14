/**
 * @module app/api/v1/creative-studio/economics/route
 *
 * GET /api/v1/creative-studio/economics
 *
 * Returns aggregated provider health, reliability, and economic metrics
 * for the creative studio (SUPREME COMMAND #9 — Phase 7).
 *
 * Read-only endpoint. Requires authenticated user.
 * No secrets exposed — only aggregated metrics.
 *
 * Layer rule: land (API route) — imports from seed + tree.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  buildProviderEconomicsResponses,
  type MediaJobRow,
  type ProvenanceRow,
} from './economics-route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/creative-studio/economics
 *
 * Aggregates media_jobs by provider, computing reliability + economic
 * metrics and health assessment for each.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = createServerClient();

    const result = await client
      .unwrap()
      .prepare(
        `SELECT
           model AS provider,
           status,
           CASE
             WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
             THEN (completed_at - started_at) * 1000
             ELSE NULL
           END AS latency_ms,
           retry_count,
           provider_cost,
           cost_classification,
           revenue_attribution,
           gross_margin
         FROM media_jobs`,
      )
      .all<MediaJobRow>();

    const provResult = await client
      .unwrap()
      .prepare(
        `SELECT mj.model AS provider, COUNT(*) AS count, MAX(ap.created_at) AS freshest
         FROM attribution_provenance ap
         JOIN media_jobs mj ON mj.id = ap.media_job_id
         GROUP BY mj.model`,
      )
      .all<ProvenanceRow>();

    const providers = buildProviderEconomicsResponses(
      result.results ?? [],
      provResult.results ?? [],
    );

    return NextResponse.json(
      {
        providers,
        generatedAt: Math.floor(Date.now() / 1000),
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error(
      '[creative-studio-economics] aggregation failed',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ error: 'Failed to compute economics' }, { status: 500 });
  }
}
