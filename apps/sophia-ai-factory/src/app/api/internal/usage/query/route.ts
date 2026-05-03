/**
 * Internal Usage Query API
 *
 * GET /internal/usage/query — Query accumulated usage for webhook/billing systems.
 * Authentication: x-internal-secret header matching INTERNAL_API_SECRET (via verifyInternalSecret).
 *
 * Sub-modules:
 *   usage-query-helpers.ts    — calculateTotalsFromHourly, buildServiceBreakdown, buildFeatureBreakdown, calculateQuotaUsage
 *   usage-query-aggregator.ts — buildHourlyAggregation, buildDailyFromHourly
 *
 * @module api/internal/usage/query
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret';
import {
  calculateTotalsFromHourly,
  buildServiceBreakdown,
  buildFeatureBreakdown,
  calculateQuotaUsage,
} from './usage-query-helpers';
import { buildHourlyAggregation, buildDailyFromHourly } from './usage-query-aggregator';

interface CustomerLicenseRow {
  nonce: string;
  tier: string;
  created_by: string | null;
}

interface NonceLicenseRow {
  tier: string;
  created_by: string | null;
}

// Mirrors RawUsageEvent in usage-query-aggregator.ts — keep in sync.
// DB-row contract owned here; aggregator owns domain input contract (Sub-Variant 4 doctrine).
interface RawUsageEventRow {
  user_id: string;
  license_nonce: string;
  service_name: string;
  action: string;
  credits_used: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  response_time_ms: number | null;
  status_code: number | null;
  created_at: number;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyInternalSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid or missing internal secret' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const licenseNonce = searchParams.get('license_nonce');
    const externalCustomerId = searchParams.get('external_customer_id');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const aggregate = (searchParams.get('aggregate') as 'hour' | 'day' | 'month' | 'none') || 'none';
    const format = (searchParams.get('format') as 'summary' | 'raw') || 'summary';

    if (!licenseNonce && !externalCustomerId) {
      return NextResponse.json(
        { error: 'Missing required param: license_nonce or external_customer_id' },
        { status: 400 }
      );
    }

    if (licenseNonce && externalCustomerId) {
      return NextResponse.json(
        { error: 'Cannot specify both license_nonce and external_customer_id' },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let endTimestamp = now;

    let startTimestamp: number;
    if (startParam) {
      startTimestamp = parseInt(startParam, 10);
      if (isNaN(startTimestamp)) {
        return NextResponse.json({ error: 'Invalid start timestamp - must be Unix seconds' }, { status: 400 });
      }
    } else {
      const nowDate = new Date();
      startTimestamp = Math.floor(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000);
    }

    if (endParam) {
      endTimestamp = parseInt(endParam, 10);
      if (isNaN(endTimestamp)) {
        return NextResponse.json({ error: 'Invalid end timestamp - must be Unix seconds' }, { status: 400 });
      }
    }

    if (startTimestamp > endTimestamp) {
      return NextResponse.json({ error: 'start must be before end' }, { status: 400 });
    }

    const maxRange = 90 * 86400;
    if (endTimestamp - startTimestamp > maxRange) {
      return NextResponse.json(
        { error: `Date range exceeds maximum of ${maxRange} seconds (90 days)`, suggestion: 'Split into smaller ranges' },
        { status: 400 }
      );
    }

    logger.info('[Internal Usage Query] Querying usage', { licenseNonce, externalCustomerId, startTimestamp, endTimestamp, aggregate, format });

    let queryLicenseNonce = licenseNonce;
    let queryUserId: string | undefined;
    let tier = 'BASIC';

    const db = createServerClient();

    if (externalCustomerId) {
      const { data: rawLicense } = await db
        .from('raas_licenses')
        .select('nonce, tier, created_by, polar_customer_id')
        .eq('polar_customer_id', externalCustomerId)
        .single();
      const license = rawLicense as CustomerLicenseRow | null;

      if (!license) {
        const { data: rawStripeLicense } = await db
          .from('raas_licenses')
          .select('nonce, tier, created_by, stripe_customer_id')
          .eq('stripe_customer_id', externalCustomerId)
          .single();
        const stripeLicense = rawStripeLicense as CustomerLicenseRow | null;

        if (!stripeLicense) {
          return NextResponse.json({ error: `No license found for external_customer_id: ${externalCustomerId}` }, { status: 404 });
        }

        queryLicenseNonce = stripeLicense.nonce;
        queryUserId = stripeLicense.created_by ?? undefined;
        tier = stripeLicense.tier || 'BASIC';
      } else {
        queryLicenseNonce = license.nonce;
        queryUserId = license.created_by ?? undefined;
        tier = license.tier || 'BASIC';
      }
    } else {
      const { data: rawLicense } = await db
        .from('raas_licenses')
        .select('tier, created_by')
        .eq('nonce', licenseNonce!)
        .single();
      const license = rawLicense as NonceLicenseRow | null;

      if (!license) {
        return NextResponse.json({ error: `License not found: ${licenseNonce}` }, { status: 404 });
      }

      queryUserId = license.created_by ?? undefined;
      tier = license.tier || 'BASIC';
    }

    const { data: rawEvents, error } = await db
      .from('usage_events')
      .select('*')
      .eq('user_id', queryUserId!)
      .eq('license_nonce', queryLicenseNonce!)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp);
    const events = rawEvents as RawUsageEventRow[] | null;

    if (error) {
      logger.error('[Internal Usage Query] Failed to fetch events', toError(error));
      return NextResponse.json({ error: 'Failed to query usage data' }, { status: 500 });
    }

    if (format === 'raw') {
      return NextResponse.json({
        tenantId: queryUserId,
        licenseNonce: queryLicenseNonce!,
        period: { start: startTimestamp, end: endTimestamp },
        rawEvents: events || [],
        count: events?.length || 0,
        tier,
      });
    }

    const hourly = buildHourlyAggregation(events || []);
    const daily = buildDailyFromHourly(hourly);
    const totals = calculateTotalsFromHourly(hourly);
    const byService = buildServiceBreakdown(hourly);
    const byFeature = buildFeatureBreakdown(hourly);
    const quotaUsage = calculateQuotaUsage(hourly, daily, tier);

    logger.info('[Internal Usage Query] Query complete', {
      tenantId: queryUserId,
      licenseNonce: queryLicenseNonce!,
      totalRequests: totals.totalRequests,
      totalCredits: totals.totalCredits,
    });

    return NextResponse.json({
      tenantId: queryUserId,
      licenseNonce: queryLicenseNonce!,
      tier,
      period: { start: startTimestamp, end: endTimestamp },
      totals,
      byService,
      byFeature,
      quotaUsage,
      aggregated: { hourly, daily },
      metadata: { queriedAt: new Date().toISOString(), aggregate },
    });
  } catch (error) {
    logger.error('[Internal Usage Query] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to query usage data' }, { status: 500 });
  }
}
