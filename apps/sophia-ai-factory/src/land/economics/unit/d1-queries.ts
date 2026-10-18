/**
 * Unit Economics Submodule: D1 Database Queries.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/d1-queries
 */

import { createLogger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type { EconomicsProviderId } from '@/seed/types/unit-economics-types';
import type { ProviderStatsBucket } from './types';
import type { TierCounts } from './tier-economics-builder';
import { classifyProvider } from './provider-cost-aggregator';

export {
  querySettledRevenue,
  queryAffiliateCommissions,
  queryActiveEdgeNodes,
} from './d1-financial-infra-queries';

const logger = createLogger('land/economics/unit/d1-queries');

export interface MediaJobsQueryResult {
  totalVideos: number;
  totalMediaJobsCogsCents: number;
  providerCounts: Record<EconomicsProviderId, ProviderStatsBucket>;
}

export async function queryMediaJobs(
  db: D1Database,
  windowStartSec: number
): Promise<MediaJobsQueryResult> {
  let totalVideos = 0;
  let totalMediaJobsCogsCents = 0;
  const providerCounts: Record<EconomicsProviderId, ProviderStatsBucket> = {
    fal: { jobs: 0, success: 0, costCents: 0, latencyTotal: 0 },
    elevenlabs: { jobs: 0, success: 0, costCents: 0, latencyTotal: 0 },
    openrouter: { jobs: 0, success: 0, costCents: 0, latencyTotal: 0 },
    mekong: { jobs: 0, success: 0, costCents: 0, latencyTotal: 0 },
  };

  try {
    const mediaStmt = db.prepare(`
      SELECT
        model,
        status,
        COALESCE(provider_cost, 0) as provider_cost,
        COALESCE(latency_ms, 0) as latency_ms,
        type
      FROM media_jobs
      WHERE created_at >= ?
    `);
    const mediaRows = await mediaStmt.bind(windowStartSec).all<{
      model: string;
      status: string;
      provider_cost: number;
      latency_ms: number;
      type: string;
    }>();

    if (mediaRows.results && mediaRows.results.length > 0) {
      for (const job of mediaRows.results) {
        if (job.status === 'completed') {
          totalVideos++;
        }
        totalMediaJobsCogsCents += job.provider_cost;
        const pid = classifyProvider(job.model);
        providerCounts[pid].jobs++;
        if (job.status === 'completed') providerCounts[pid].success++;
        providerCounts[pid].costCents += job.provider_cost;
        providerCounts[pid].latencyTotal += job.latency_ms;
      }
    }
  } catch (err) {
    logger.warn('MEDIA_JOBS_QUERY_FAILED', { error: String(err) });
  }

  return { totalVideos, totalMediaJobsCogsCents, providerCounts };
}

export async function queryLicenses(
  db: D1Database
): Promise<{ tierCounts: TierCounts; activeLicenseCount: number }> {
  const tierCounts: TierCounts = { BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 };
  let activeLicenseCount = 0;

  try {
    const licenseStmt = db.prepare(`
      SELECT tier, COUNT(*) as count
      FROM raas_licenses
      WHERE is_revoked = 0
      GROUP BY tier
    `);
    const licenseRows = await licenseStmt.all<{ tier: string; count: number }>();
    if (licenseRows.results) {
      for (const row of licenseRows.results) {
        const t = (row.tier || '').toUpperCase() as keyof TierCounts;
        if (t in tierCounts) {
          tierCounts[t] = row.count;
          activeLicenseCount += row.count;
        }
      }
    }
  } catch (err) {
    logger.warn('RAAS_LICENSES_QUERY_FAILED', { error: String(err) });
  }

  return { tierCounts, activeLicenseCount };
}
