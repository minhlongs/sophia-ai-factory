/**
 * Usage Reconciliation Admin Endpoint
 *
 * GET: Query usage events with filters and perform reconciliation analysis.
 *
 * Sub-modules:
 *   reconciliation-types.ts            — all interfaces + parseTimestamp + parseLimit
 *   reconciliation-db-queries.ts       — queryUsageEvents, getLicenseInfo, queryBillingPeriods
 *   reconciliation-anomaly-detection.ts — detectUsageSpikes, detectUsageGaps, detectDuplicateKeys
 *   reconciliation-analysis.ts         — performReconciliationAnalysis, buildReconciliationSummary, etc.
 *
 * @module api/admin/usage/reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { checkAdminAuth } from '../../licenses/middleware';
import { parseTimestamp, parseLimit } from './reconciliation-types';
import { queryUsageEvents, getLicenseInfo, queryBillingPeriods } from './reconciliation-db-queries';
import {
  determineDeduplicationStatus,
  buildRawPayload,
  performReconciliationAnalysis,
  buildReconciliationSummary,
} from './reconciliation-analysis';
import type { UsageEventWithStatus } from './reconciliation-types';

/**
 * GET: Query usage events and perform reconciliation analysis.
 *
 * Query params:
 * - license_nonce, customer_id, service, start, end, limit, offset
 * - include_raw: include raw payloads (default: false)
 * - analyze: perform reconciliation analysis (default: true)
 */
export async function GET(request: NextRequest) {
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      licenseNonce: searchParams.get('license_nonce') || undefined,
      customerId: searchParams.get('customer_id') || undefined,
      service: searchParams.get('service') || undefined,
      startTimestamp: parseTimestamp(searchParams.get('start')),
      endTimestamp: parseTimestamp(searchParams.get('end')),
      limit: parseLimit(searchParams.get('limit')),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const includeRaw = searchParams.get('include_raw') === 'true';
    const performAnalysis = searchParams.get('analyze') !== 'false';

    logger.info('[Reconciliation] Querying usage events', { filters, includeRaw, performAnalysis });

    const db = createServerClient();

    const { events, totalCount } = await queryUsageEvents(db, filters);

    const licenseInfo = filters.licenseNonce
      ? await getLicenseInfo(db, filters.licenseNonce)
      : null;

    const billingPeriods = await queryBillingPeriods(
      db,
      filters.customerId || licenseInfo?.polar_customer_id || undefined,
      filters.startTimestamp,
      filters.endTimestamp
    );

    const eventsWithStatus: UsageEventWithStatus[] = events.map(event => ({
      ...event,
      deduplication_status: determineDeduplicationStatus(event),
      raw_payload: includeRaw ? buildRawPayload(event) : {},
    }));

    let reconciliationAnalysis = null;
    let anomalies = [];
    let quotaCompliance = [];

    if (performAnalysis) {
      const analysis = performReconciliationAnalysis(eventsWithStatus, billingPeriods, licenseInfo);
      reconciliationAnalysis = analysis.comparison;
      anomalies = analysis.anomalies;
      quotaCompliance = analysis.quotaCompliance;
    }

    const summary = buildReconciliationSummary(eventsWithStatus, licenseInfo);

    return NextResponse.json({
      success: true,
      filters,
      events: eventsWithStatus,
      pagination: {
        total: totalCount,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: totalCount > filters.offset + filters.limit,
      },
      summary,
      reconciliation: reconciliationAnalysis,
      billing_periods: billingPeriods,
      anomalies,
      quota_compliance: quotaCompliance,
      license_info: licenseInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Reconciliation] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform usage reconciliation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
