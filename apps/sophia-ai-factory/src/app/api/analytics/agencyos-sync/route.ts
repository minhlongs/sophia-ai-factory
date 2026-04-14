/**
 * AgencyOS Analytics Sync API
 *
 * Exports quota/overage data to AgencyOS dashboard for unified analytics.
 * This endpoint is called by AgencyOS to sync usage data from Sophia AI Factory.
 *
 * Features:
 * - Webhook secret authentication
 * - Quota/overage data export
 * - Date range filtering
 * - Agency-scoped data isolation
 * - Sync status logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { verifyWebhookSignature } from '@/lib/security/webhook-validator';

/**
 * AgencyOS quota report schema
 */
interface AgencyOSQuotaReport {
  agencyId: string;
  licenseNonce: string;
  periodStart: string;
  periodEnd: string;
  totalCreditsUsed: number;
  totalOverageCredits: number;
  overageCharges: number;
  tierHistory: Array<{ tier: string; startDate: string }>;
  quotaViolations: Array<{
    timestamp: string;
    type: string;
    exceededBy: number;
  }>;
  polarCustomerId?: string;
  subscriptionStatus?: string;
}

/**
 * Sync request body from AgencyOS
 */
interface SyncRequestBody {
  agencyId: string;
  startDate: string;
  endDate: string;
  includeOverageEvents?: boolean;
  includeTierHistory?: boolean;
}

/**
 * Verify AgencyOS webhook signature
 */
function verifyAgencyOSAuth(request: NextRequest): boolean {
  const signature = request.headers.get('x-agencyos-signature');
  const timestamp = request.headers.get('x-agencyos-timestamp');

  if (!signature || !timestamp) {
    logger.warn('[AgencyOS Sync] Missing auth headers');
    return false;
  }

  const secret = process.env.AGENCYOS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('[AgencyOS Sync] AGENCYOS_WEBHOOK_SECRET not configured');
    return false;
  }

  return verifyWebhookSignature(signature, timestamp, secret);
}

/**
 * Fetch quota usage data for a license
 */
async function fetchQuotaUsage(
  licenseNonce: string,
  startDate: number,
  endDate: number
): Promise<{
  totalCreditsUsed: number;
  hourlyCredits: number;
  dailyCredits: number;
  monthlyCredits: number;
  requestCount: number;
}> {
  const db = createServerClient();

  const { data: usageEvents } = await db
    .from('usage_events')
    .select('credits_used, created_at')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (!usageEvents || usageEvents.length === 0) {
    return {
      totalCreditsUsed: 0,
      hourlyCredits: 0,
      dailyCredits: 0,
      monthlyCredits: 0,
      requestCount: 0,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  let hourlyCredits = 0;
  let dailyCredits = 0;
  let monthlyCredits = 0;

  for (const event of usageEvents) {
    const credits = event.credits_used || 0;
    const timestamp = event.created_at;

    if (timestamp >= hourStart) hourlyCredits += credits;
    if (timestamp >= dayStart) dailyCredits += credits;
    if (timestamp >= monthStart) monthlyCredits += credits;
  }

  return {
    totalCreditsUsed: usageEvents.reduce((sum, e) => sum + (e.credits_used || 0), 0),
    hourlyCredits,
    dailyCredits,
    monthlyCredits,
    requestCount: usageEvents.length,
  };
}

/**
 * Fetch overage events for a license
 */
async function fetchOverageEvents(
  licenseNonce: string,
  startDate: number,
  endDate: number
): Promise<{
  totalOverageCredits: number;
  totalCharges: number;
  violations: Array<{ timestamp: string; type: string; exceededBy: number }>;
}> {
  const db = createServerClient();

  const { data: overageEvents } = await db
    .from('overage_events')
    .select('exceeded_type, exceeded_by, created_at')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  if (!overageEvents || overageEvents.length === 0) {
    return {
      totalOverageCredits: 0,
      totalCharges: 0,
      violations: [],
    };
  }

  const totalOverageCredits = overageEvents.reduce((sum, e) => sum + (e.exceeded_by || 0), 0);

  // Calculate charges based on tier pricing (simplified)
  const totalCharges = totalOverageCredits * 0.05; // Default $0.05/credit

  const violations = overageEvents.map(e => ({
    timestamp: new Date((e.created_at as number) * 1000).toISOString(),
    type: e.exceeded_type || 'unknown',
    exceededBy: e.exceeded_by || 0,
  }));

  return {
    totalOverageCredits,
    totalCharges,
    violations,
  };
}

/**
 * Fetch tier history for a license
 */
async function fetchTierHistory(
  licenseNonce: string
): Promise<Array<{ tier: string; startDate: string }>> {
  const db = createServerClient();

  const { data: license } = await db
    .from('raas_licenses')
    .select('tier, created_at')
    .eq('nonce', licenseNonce)
    .single();

  if (!license) {
    return [];
  }

  return [
    {
      tier: license.tier || 'BASIC',
      startDate: new Date((license.created_at as number) * 1000).toISOString(),
    },
  ];
}

/**
 * POST /api/analytics/agencyos-sync
 *
 * Export quota/overage data to AgencyOS
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Verify authentication
  if (!verifyAgencyOSAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: SyncRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { agencyId, startDate, endDate, includeOverageEvents, includeTierHistory } = body;

  if (!agencyId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required fields: agencyId, startDate, endDate', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  logger.info('[AgencyOS Sync] Sync request received', {
    agencyId,
    startDate,
    endDate,
    includeOverageEvents,
    includeTierHistory,
  });

  try {
    const db = createServerClient();
    const startTs = Math.floor(new Date(startDate).getTime() / 1000);
    const endTs = Math.floor(new Date(endDate).getTime() / 1000);

    // Fetch all licenses for this agency
    const { data: licenses } = await db
      .from('raas_licenses')
      .select('nonce, tier, polar_customer_id, created_by')
      .eq('created_by', agencyId)
      .eq('is_revoked', false);

    if (!licenses || licenses.length === 0) {
      logger.info('[AgencyOS Sync] No active licenses found for agency', { agencyId });
      return NextResponse.json({
        agencyId,
        periodStart: startDate,
        periodEnd: endDate,
        licenses: [],
        syncTimestamp: new Date().toISOString(),
      });
    }

    // Build reports for each license
    const reports: AgencyOSQuotaReport[] = [];

    for (const license of licenses) {
      const quotaUsage = await fetchQuotaUsage(license.nonce, startTs, endTs);

      const report: AgencyOSQuotaReport = {
        agencyId,
        licenseNonce: license.nonce,
        periodStart: startDate,
        periodEnd: endDate,
        totalCreditsUsed: quotaUsage.totalCreditsUsed,
        totalOverageCredits: 0,
        overageCharges: 0,
        tierHistory: includeTierHistory ? await fetchTierHistory(license.nonce) : [],
        quotaViolations: [],
        polarCustomerId: license.polar_customer_id || undefined,
      };

      // Fetch overage events if requested
      if (includeOverageEvents) {
        const overageData = await fetchOverageEvents(license.nonce, startTs, endTs);
        report.totalOverageCredits = overageData.totalOverageCredits;
        report.overageCharges = overageData.totalCharges;
        report.quotaViolations = overageData.violations;
      }

      reports.push(report);
    }

    const duration = Date.now() - startTime;
    logger.info('[AgencyOS Sync] Sync completed', {
      agencyId,
      licenseCount: reports.length,
      durationMs: duration,
    });

    return NextResponse.json({
      agencyId,
      periodStart: startDate,
      periodEnd: endDate,
      licenses: reports,
      syncTimestamp: new Date().toISOString(),
      metadata: {
        totalLicenses: licenses.length,
        totalCreditsUsed: reports.reduce((sum, r) => sum + r.totalCreditsUsed, 0),
        totalOverageCredits: reports.reduce((sum, r) => sum + r.totalOverageCredits, 0),
        totalOverageCharges: reports.reduce((sum, r) => sum + r.overageCharges, 0),
      },
    });

  } catch (error) {
    logger.error('[AgencyOS Sync] Sync failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Sync failed', code: 'SYNC_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/agencyos-sync
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'agencyos-sync',
    timestamp: new Date().toISOString(),
  });
}
