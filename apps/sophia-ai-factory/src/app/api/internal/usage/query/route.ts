/**
 * Internal Usage Query API
 *
 * GET /internal/usage/query - Query accumulated usage for webhook/billing systems
 *
 * This endpoint is designed for internal webhook systems (Polar.sh, Stripe) to query
 * accumulated usage per license key or customer ID over billing intervals.
 *
 * Authentication:
 *  - Requires X-Internal-Secret header matching INTERNAL_WEBHOOK_SECRET env var
 *  - No user authentication required (internal service-to-service)
 *
 * Query params:
 *  - license_nonce: License identifier (optional, mutually exclusive with external_customer_id)
 *  - external_customer_id: External billing customer ID (optional)
 *  - start: Unix timestamp (seconds) - start of billing period
 *  - end: Unix timestamp (seconds) - end of billing period
 *  - aggregate: 'hour' | 'day' | 'month' | 'none' (default: 'none' returns raw events)
 *  - format: 'summary' | 'raw' (default: 'summary')
 *
 * Response (summary format):
 * {
 *   tenantId: string,
 *   licenseNonce: string,
 *   period: { start: number, end: number },
 *   totals: {
 *     totalRequests: number,
 *     totalCredits: number,
 *     totalTokensInput: number,
 *     totalTokensOutput: number,
 *     totalErrors: number,
 *     avgResponseTimeMs: number
 *   },
 *   byService: Record<string, {
 *     requests: number,
 *     credits: number,
 *     tokensInput: number,
 *     tokensOutput: number
 *   }>,
 *   byFeature: Record<string, {
 *     requests: number,
 *     credits: number
 *   }>,
 *   quotaUsage: {
 *     hourlyUsed: number,
 *     hourlyLimit: number,
 *     dailyUsed: number,
 *     dailyLimit: number,
 *     monthlyUsed: number,
 *     monthlyLimit: number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import type { HourlySummary, DailySummary } from '@/lib/usage-metering/types';

/**
 * Validate internal webhook secret
 */
function validateInternalSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('[Internal Usage Query] INTERNAL_WEBHOOK_SECRET not configured');
    return false;
  }

  if (!secret || secret !== expectedSecret) {
    logger.warn('[Internal Usage Query] Invalid or missing internal secret');
    return false;
  }

  return true;
}

/**
 * Calculate totals from hourly summaries
 */
function calculateTotalsFromHourly(hourly: HourlySummary[]): {
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
} {
  let totalRequests = 0;
  let totalCredits = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalErrors = 0;
  let weightedRtSum = 0;

  for (const hour of hourly) {
    totalRequests += hour.totalRequests;
    totalCredits += hour.totalCredits;
    totalTokensInput += hour.totalTokens;

    for (const service of hour.serviceBreakdown) {
      totalTokensOutput += service.tokensOutput;
      totalErrors += service.errorCount;
      weightedRtSum += service.avgResponseTimeMs * service.requestCount;
    }
  }

  const avgResponseTimeMs = totalRequests > 0 ? weightedRtSum / totalRequests : 0;

  return {
    totalRequests,
    totalCredits,
    totalTokensInput,
    totalTokensOutput: totalTokensOutput - totalTokensInput, // Net output tokens
    totalErrors,
    avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
  };
}

/**
 * Build service breakdown from hourly summaries
 */
function buildServiceBreakdown(hourly: HourlySummary[]): Record<string, {
  requests: number;
  credits: number;
  tokensInput: number;
  tokensOutput: number;
}> {
  const serviceMap = new Map<string, {
    requests: number;
    credits: number;
    tokensInput: number;
    tokensOutput: number;
  }>();

  for (const hour of hourly) {
    for (const service of hour.serviceBreakdown) {
      // Extract service name from featureKey (e.g., "heygen.createVideo" -> "heygen")
      const serviceName = service.featureKey.split('.')[0];

      const existing = serviceMap.get(serviceName) || {
        requests: 0,
        credits: 0,
        tokensInput: 0,
        tokensOutput: 0,
      };

      existing.requests += service.requestCount;
      existing.credits += service.consumedUnits;
      existing.tokensInput += service.tokensInput;
      existing.tokensOutput += service.tokensOutput;

      serviceMap.set(serviceName, existing);
    }
  }

  return Object.fromEntries(serviceMap);
}

/**
 * Build feature breakdown from hourly summaries
 */
function buildFeatureBreakdown(hourly: HourlySummary[]): Record<string, {
  requests: number;
  credits: number;
}> {
  const featureMap = new Map<string, {
    requests: number;
    credits: number;
  }>();

  for (const hour of hourly) {
    for (const service of hour.serviceBreakdown) {
      const existing = featureMap.get(service.featureKey) || {
        requests: 0,
        credits: 0,
      };

      existing.requests += service.requestCount;
      existing.credits += service.consumedUnits;

      featureMap.set(service.featureKey, existing);
    }
  }

  return Object.fromEntries(featureMap);
}

/**
 * Calculate quota usage for the period
 */
function calculateQuotaUsage(
  hourly: HourlySummary[],
  daily: DailySummary[],
  tier: string
): {
  hourlyUsed: number;
  hourlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
} {
  const quota = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

  // Get current hour usage
  const now = Date.now();
  const currentHourStart = Math.floor(now / 3600000) * 3600000;
  const currentDayStart = Math.floor(now / 86400000) * 86400000;

  const currentHourMs = hourly.find(h => h.hourTimestamp === currentHourStart / 1000);
  const currentDay = daily.find(d => d.dayTimestamp === currentDayStart / 1000);

  return {
    hourlyUsed: currentHourMs?.totalCredits || 0,
    hourlyLimit: quota.hourlyCredits,
    dailyUsed: currentDay?.totalCredits || 0,
    dailyLimit: quota.dailyCredits,
    monthlyUsed: hourly.reduce((sum, h) => sum + h.totalCredits, 0),
    monthlyLimit: quota.monthlyCredits,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Step 1: Validate internal secret
    if (!validateInternalSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid or missing internal secret' },
        { status: 401 }
      );
    }

    // Step 2: Parse query params
    const searchParams = request.nextUrl.searchParams;
    const licenseNonce = searchParams.get('license_nonce');
    const externalCustomerId = searchParams.get('external_customer_id');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const aggregate = searchParams.get('aggregate') as 'hour' | 'day' | 'month' | 'none' || 'none';
    const format = searchParams.get('format') as 'summary' | 'raw' || 'summary';

    // Validate: either license_nonce or external_customer_id must be provided
    if (!licenseNonce && !externalCustomerId) {
      return NextResponse.json(
        { error: 'Missing required param: license_nonce or external_customer_id' },
        { status: 400 }
      );
    }

    // Validate: both cannot be provided (mutually exclusive)
    if (licenseNonce && externalCustomerId) {
      return NextResponse.json(
        { error: 'Cannot specify both license_nonce and external_customer_id' },
        { status: 400 }
      );
    }

    // Parse timestamps
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp: number;
    let endTimestamp: number = now;

    if (startParam) {
      startTimestamp = parseInt(startParam, 10);
      if (isNaN(startTimestamp)) {
        return NextResponse.json(
          { error: 'Invalid start timestamp - must be Unix seconds' },
          { status: 400 }
        );
      }
    } else {
      // Default to current billing period (current month)
      const nowDate = new Date();
      startTimestamp = Math.floor(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() / 1000);
    }

    if (endParam) {
      endTimestamp = parseInt(endParam, 10);
      if (isNaN(endTimestamp)) {
        return NextResponse.json(
          { error: 'Invalid end timestamp - must be Unix seconds' },
          { status: 400 }
        );
      }
    }

    // Validate date range
    if (startTimestamp > endTimestamp) {
      return NextResponse.json(
        { error: 'start must be before end' },
        { status: 400 }
      );
    }

    // Limit to 90 days max
    const maxRange = 90 * 86400;
    if (endTimestamp - startTimestamp > maxRange) {
      return NextResponse.json(
        { error: `Date range exceeds maximum of ${maxRange} seconds (90 days)`, suggestion: 'Split into smaller ranges' },
        { status: 400 }
      );
    }

    logger.info('[Internal Usage Query] Querying usage', {
      licenseNonce,
      externalCustomerId,
      startTimestamp,
      endTimestamp,
      aggregate,
      format,
    });

    // Step 3: Get license info if querying by external_customer_id
    let queryLicenseNonce = licenseNonce;
    let queryUserId: string | undefined;
    let tier = 'BASIC';

    if (externalCustomerId) {
      const db = createServerClient();

      // Try to find license by Polar customer ID
      const { data: license } = await db
        .from('raas_licenses')
        .select('nonce, tier, created_by, polar_customer_id')
        .eq('polar_customer_id', externalCustomerId)
        .single() as any;

      if (!license) {
        // Try Stripe customer ID
        const { data: stripeLicense } = await db
          .from('raas_licenses')
          .select('nonce, tier, created_by, stripe_customer_id')
          .eq('stripe_customer_id', externalCustomerId)
          .single() as any;

        if (!stripeLicense) {
          return NextResponse.json(
            { error: `No license found for external_customer_id: ${externalCustomerId}` },
            { status: 404 }
          );
        }

        queryLicenseNonce = stripeLicense.nonce;
        queryUserId = stripeLicense.created_by;
        tier = stripeLicense.tier || 'BASIC';
      } else {
        queryLicenseNonce = license.nonce;
        queryUserId = license.created_by;
        tier = license.tier || 'BASIC';
      }
    } else {
      // Query by license_nonce - get user_id and tier
      const db = createServerClient();
      const { data: license } = await db
        .from('raas_licenses')
        .select('tier, created_by')
        .eq('nonce', licenseNonce!)
        .single() as any;

      if (!license) {
        return NextResponse.json(
          { error: `License not found: ${licenseNonce}` },
          { status: 404 }
        );
      }

      queryUserId = license.created_by;
      tier = license.tier || 'BASIC';
    }

    // Step 4: Get aggregated usage data
    const db2 = createServerClient();

    let query = db2
      .from('usage_events')
      .select('*')
      .eq('user_id', queryUserId!)
      .eq('license_nonce', queryLicenseNonce!)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp);

    const { data: events, error } = await query as any;

    if (error) {
      logger.error('[Internal Usage Query] Failed to fetch events', error);
      return NextResponse.json(
        { error: 'Failed to query usage data' },
        { status: 500 }
      );
    }

    // Step 5: Build response based on format
    // Raw format returns unaggregated events; summary format returns aggregated data
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

    // Aggregate events manually for summary format
    // Group by hour
    const hourlyMap = new Map<number, HourlySummary>();

    for (const event of (events || [])) {
      const hourTs = Math.floor(event.created_at / 3600) * 3600;

      let hourly = hourlyMap.get(hourTs) || {
        hourTimestamp: hourTs,
        serviceBreakdown: [],
        totalCredits: 0,
        totalRequests: 0,
        totalTokens: 0,
      };

      const featureKey = `${event.service_name}.${event.action}`;

      // Find or create service breakdown
      let service = hourly.serviceBreakdown.find(s => s.featureKey === featureKey);
      if (!service) {
        service = {
          tenantId: event.user_id,
          licenseNonce: event.license_nonce,
          featureKey,
          timestamp: hourTs,
          consumedUnits: 0,
          requestCount: 0,
          tokensInput: 0,
          tokensOutput: 0,
          avgResponseTimeMs: 0,
          errorCount: 0,
        };
        hourly.serviceBreakdown.push(service);
      }

      service.consumedUnits += event.credits_used || 0;
      service.requestCount += 1;
      service.tokensInput += event.tokens_input || 0;
      service.tokensOutput += event.tokens_output || 0;

      if (event.response_time_ms) {
        service.avgResponseTimeMs = ((service.avgResponseTimeMs * (service.requestCount - 1)) + event.response_time_ms) / service.requestCount;
      }

      if (!event.status_code || event.status_code >= 400) {
        service.errorCount += 1;
      }

      hourly.totalCredits += event.credits_used || 0;
      hourly.totalRequests += 1;
      hourly.totalTokens += (event.tokens_input || 0) + (event.tokens_output || 0);

      hourlyMap.set(hourTs, hourly);
    }

    const hourly = Array.from(hourlyMap.values()).sort((a, b) => a.hourTimestamp - b.hourTimestamp);

    // Build daily from hourly
    const dailyMap = new Map<number, DailySummary>();
    for (const hour of hourly) {
      const dayTs = Math.floor(hour.hourTimestamp / 86400) * 86400;

      let daily = dailyMap.get(dayTs) || {
        dayTimestamp: dayTs,
        hourlyBreakdown: [],
        totalCredits: 0,
        totalRequests: 0,
        totalTokensInput: 0,
        totalTokensOutput: 0,
      };

      daily.hourlyBreakdown.push(hour);
      daily.totalCredits += hour.totalCredits;
      daily.totalRequests += hour.totalRequests;

      for (const service of hour.serviceBreakdown) {
        daily.totalTokensInput += service.tokensInput;
        daily.totalTokensOutput += service.tokensOutput;
      }

      dailyMap.set(dayTs, daily);
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.dayTimestamp - b.dayTimestamp);

    // Calculate totals and breakdowns
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
      aggregated: {
        hourly,
        daily,
      },
      metadata: {
        queriedAt: new Date().toISOString(),
        aggregate,
      },
    });

  } catch (error) {
    logger.error('[Internal Usage Query] Critical error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to query usage data' },
      { status: 500 }
    );
  }
}
