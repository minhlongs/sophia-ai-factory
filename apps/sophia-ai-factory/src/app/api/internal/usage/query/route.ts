/**
 * Internal Usage Query API
 *
 * GET /internal/usage/query — Query accumulated usage for webhook/billing systems.
 * Authentication: X-Internal-Secret header matching INTERNAL_WEBHOOK_SECRET.
 *
 * Sub-modules:
 *   usage-query-helpers.ts    — validateInternalSecret, calculateTotalsFromHourly, buildServiceBreakdown, buildFeatureBreakdown, calculateQuotaUsage
 *   usage-query-aggregator.ts — buildHourlyAggregation, buildDailyFromHourly
 *
 * @module api/internal/usage/query
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import {
  validateInternalSecret,
  calculateTotalsFromHourly,
  buildServiceBreakdown,
  buildFeatureBreakdown,
  calculateQuotaUsage,
} from './usage-query-helpers';
import { buildHourlyAggregation, buildDailyFromHourly } from './usage-query-aggregator';

export async function GET(request: NextRequest) {
  try {
    if (!validateInternalSecret(request)) {
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
      const { data: license } = await db
        .from('raas_licenses')
        .select('nonce, tier, created_by, polar_customer_id')
        .eq('polar_customer_id', externalCustomerId)
        .single<{ nonce: string; tier: string; created_by: string | null; polar_customer_id: string | null }>();

      if (!license) {
        const { data: stripeLicense } = await db
          .from('raas_licenses')
          .select('nonce, tier, created_by, stripe_customer_id')
          .eq('stripe_customer_id', externalCustomerId)
          .single<{ nonce: string; tier: string; created_by: string | null; stripe_customer_id: string | null }>();

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
      const { data: license } = await db
        .from('raas_licenses')
        .select('tier, created_by')
        .eq('nonce', licenseNonce!)
        .single<{ tier: string; created_by: string | null }>();

      if (!license) {
        return NextResponse.json({ error: `License not found: ${licenseNonce}` }, { status: 404 });
      }

      queryUserId = license.created_by ?? undefined;
      tier = license.tier || 'BASIC';
    }

    const { data: events, error } = await db
      .from('usage_events')
      .select('*')
      .eq('user_id', queryUserId!)
      .eq('license_nonce', queryLicenseNonce!)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp);

    if (error) {
      logger.error('[Internal Usage Query] Failed to fetch events', error);
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
