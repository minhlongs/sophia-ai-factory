/**
 * TikTok / Affiliate conversion revenue ingestion — writes conversions
 * from conversion_events into performance_events as event_type='conversion'
 * (workspace-scoped). Bridges the gap so affiliate revenue appears in
 * the creative economy dashboard.
 *
 * Idempotency: deterministic event id `conv_{conversionEventId}` +
 * INSERT OR IGNORE on the id PK — the webhook can fire retries,
 * so re-runs must not duplicate rows. No new tables or migrations.
 *
 * Never throws: a revenue-write failure must not break the conversion handler.
 *
 * @module land/analytics/tiktok-revenue-ingestion
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordPerformanceEventIdempotent } from '@/tree/performance/events';

export interface ConversionRevenueInput {
  conversionEventId: string;
  tenantId: string;
  affiliateId: string;
  grossAmountUsd: number;
  commissionUsd: number;
  attributedAt: number; // unix seconds
  offerId: string;
}

interface WriteResult {
  written: number;
  skipped: number;
}

interface OrgMemberRow {
  org_id: string;
}

/**
 * Resolve the user's workspace from org_members using the affiliate user_id.
 * Returns null when the user has no org membership.
 */
async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const db = await getD1();
  if (!db) return null;
  const row = await db
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<OrgMemberRow>();
  return row?.org_id ?? null;
}

/**
 * Write a conversion event to performance_events.
 * Commission amount (not gross) is used as the revenue value since that's
 * what the affiliate actually earns.
 * Zero-commission rows are skipped.
 */
export async function writeConversionRevenueEvent(
  input: ConversionRevenueInput
): Promise<WriteResult> {
  const { conversionEventId, tenantId, affiliateId, grossAmountUsd, commissionUsd, attributedAt, offerId } = input;

  if (commissionUsd <= 0) {
    return { written: 0, skipped: 1 };
  }

  const workspaceId = await resolveWorkspaceId(affiliateId);
  if (!workspaceId) {
    logger.warn('[tiktok-revenue-ingestion] No workspace for affiliate — skipping conversion write', {
      affiliateId,
      conversionEventId,
    });
    return { written: 0, skipped: 1 };
  }

  // Deterministic id for idempotency: conv_{conversionEventId}
  // The conversionEventId is a UUID from the webhook, globally unique
  const eventId = `conv_${conversionEventId}`;
  const valueCents = Math.round(commissionUsd * 100);

  const inserted = await recordPerformanceEventIdempotent({
    id: eventId,
    workspaceId,
    assetId: offerId,
    projectId: offerId,
    entityType: 'conversion',
    entityId: conversionEventId,
    channel: 'tiktok-shop', // Can be extended to detect actual network
    eventType: 'conversion',
    count: 1,
    valueCents,
    recordedAt: attributedAt * 1000, // convert seconds to milliseconds
    rawData: {
      source: 'tiktok-shop-webhook',
      conversionEventId,
      tenantId,
      grossAmountUsd,
      commissionUsd,
    },
  });

  return { written: inserted ? 1 : 0, skipped: inserted ? 0 : 1 };
}