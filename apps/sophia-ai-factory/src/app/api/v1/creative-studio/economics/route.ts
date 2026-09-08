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
import { computeProviderMetrics } from '@/tree/media-jobs/media-job-economics-query';
import { aggregateEconomicMetrics } from '@/tree/media-jobs/media-job-economics-aggregate';
import { assessProviderHealth } from '@/tree/media-jobs/provider-health-policy';

export const dynamic = 'force-dynamic';

interface MediaJobRow {
  provider: string;
  status: string;
  latency_ms: number | null;
  retry_count: number | null;
  provider_cost: number | null;
  cost_classification: string | null;
  revenue_attribution: number | null;
  gross_margin: number | null;
}

interface ProviderResponse {
  provider: string;
  health: ReturnType<typeof assessProviderHealth>;
  reliability: ReturnType<typeof computeProviderMetrics>;
  economics: ReturnType<typeof aggregateEconomicMetrics>;
}

/**
 * GET /api/v1/creative-studio/economics
 *
 * Aggregates media_jobs by provider, computing reliability + economic
 * metrics and health assessment for each.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = createServerClient();

    // Fetch all media_jobs with economic fields
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

    const rows = result.results ?? [];

    // Group rows by provider
    const byProvider = new Map<string, MediaJobRow[]>();
    for (const row of rows) {
      const key = row.provider ?? 'unknown';
      const existing = byProvider.get(key);
      if (existing) {
        existing.push(row);
      } else {
        byProvider.set(key, [row]);
      }
    }

    // Compute metrics per provider
    const providers: ProviderResponse[] = [];
    for (const [provider, providerRows] of byProvider) {
      const reliabilityRows = providerRows.map((r) => ({
        status: r.status,
        latency_ms: r.latency_ms,
        retry_count: r.retry_count,
      }));

      const economicRows = providerRows.map((r) => ({
        status: r.status,
        provider_cost: r.provider_cost,
        cost_classification: r.cost_classification,
        revenue_attribution: r.revenue_attribution,
        gross_margin: r.gross_margin,
      }));

      const windowSeconds = 86400 * 30; // 30-day window metadata
      const reliability = computeProviderMetrics(reliabilityRows, windowSeconds, provider);
      const economics = aggregateEconomicMetrics(economicRows, provider);
      const health = assessProviderHealth(reliability);

      providers.push({ provider, health, reliability, economics });
    }

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
