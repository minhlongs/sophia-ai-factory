/**
 * API Route: Streaming Analytics & Executive BI Export
 *
 * Endpoint: /api/v1/analytics/export
 *
 * Supports:
 * - GET: Browser direct downloads via query parameters
 * - POST: Programmatic export queries with JSON filter payload
 *
 * Formats:
 * - format=csv (RFC-4180 with quote escaping and CRLF)
 * - format=json (Structured streaming JSON array)
 * - format=ndjson (Newline-delimited JSON stream)
 *
 * Security & Isolation:
 * - Better Auth session authentication (401 on missing session)
 * - Multi-tenant isolation enforcement (assertTenantScope, 403 on mismatch)
 * - Input validation on date range (start, end, max 365 days)
 *
 * Layer: app/api/v1/analytics/export
 *
 * @module app/api/v1/analytics/export/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { assertTenantScope, CrossTenantViolationError } from '@/forest/tenant/isolation-guard';
import {
  createStreamingExportResponse,
  type ExportFormat,
} from '@/tree/bi/export-formatter';

export const runtime = 'edge';

interface ExportQueryParams {
  format?: string | null;
  start?: string | null;
  end?: string | null;
  category?: string | null;
  orgId?: string | null;
}

const DEFAULT_HEADERS = [
  'id',
  'org_id',
  'period_start',
  'period_end',
  'mrr_usd',
  'throughput',
  'viral_score',
  'affiliate_revenue_usd',
  'marketing_spend_usd',
  'roi',
  'created_at',
];

const SUMMARY_HEADERS = [
  'org_id',
  'period_start',
  'period_end',
  'peak_mrr_usd',
  'total_throughput',
  'average_viral_score',
  'total_affiliate_revenue_usd',
  'total_marketing_spend_usd',
  'roi_multiplier',
  'record_count',
];

/**
 * Generator function that fetches records from Cloudflare D1 in batches
 * and yields normalized objects for streaming serialization.
 */
async function* fetchExecutiveBIMetricsStream(
  db: D1Database,
  orgId: string,
  startTimestamp: number,
  endTimestamp: number,
  category?: string,
): AsyncGenerator<Record<string, unknown>> {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  if (category === 'summary') {
    // Single summary aggregation row
    const query = `
      SELECT
        org_id,
        MAX(mrr_cents) AS peak_mrr_cents,
        SUM(throughput_count) AS total_throughput,
        AVG(viral_score) AS avg_viral_score,
        SUM(affiliate_revenue_cents) AS total_affiliate_cents,
        SUM(marketing_spend_cents) AS total_spend_cents,
        COUNT(*) AS row_count
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      GROUP BY org_id
    `;
    const res = await db.prepare(query).bind(orgId, startTimestamp, endTimestamp).first<{
      org_id: string;
      peak_mrr_cents: number;
      total_throughput: number;
      avg_viral_score: number;
      total_affiliate_cents: number;
      total_spend_cents: number;
      row_count: number;
    }>();

    if (res && res.row_count > 0) {
      const spend = res.total_spend_cents ?? 0;
      const aff = res.total_affiliate_cents ?? 0;
      const roiRatio = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        org_id: res.org_id,
        period_start: new Date(startTimestamp).toISOString(),
        period_end: new Date(endTimestamp).toISOString(),
        peak_mrr_usd: ((res.peak_mrr_cents ?? 0) / 100).toFixed(2),
        total_throughput: res.total_throughput ?? 0,
        average_viral_score: Number((res.avg_viral_score ?? 0).toFixed(2)),
        total_affiliate_revenue_usd: (aff / 100).toFixed(2),
        total_marketing_spend_usd: (spend / 100).toFixed(2),
        roi_multiplier: `${roiRatio}x`,
        record_count: res.row_count,
      };
    }
    return;
  }

  // Paged cursor stream for detailed rows
  while (hasMore) {
    const query = `
      SELECT id, org_id, period_start, period_end, mrr_cents, throughput_count,
             viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at
      FROM executive_bi_metrics
      WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
      ORDER BY period_start ASC
      LIMIT ?4 OFFSET ?5
    `;
    const batch = await db.prepare(query)
      .bind(orgId, startTimestamp, endTimestamp, PAGE_SIZE, offset)
      .all<{
        id: string;
        org_id: string;
        period_start: number;
        period_end: number;
        mrr_cents: number;
        throughput_count: number;
        viral_score: number;
        affiliate_revenue_cents: number;
        marketing_spend_cents: number;
        created_at: number;
      }>();

    const results = batch.results ?? [];
    if (results.length === 0) {
      break;
    }

    for (const row of results) {
      const spend = row.marketing_spend_cents ?? 0;
      const aff = row.affiliate_revenue_cents ?? 0;
      const roi = spend > 0 ? Number((aff / spend).toFixed(2)) : aff > 0 ? 99.0 : 0;

      yield {
        id: row.id,
        org_id: row.org_id,
        period_start: new Date(row.period_start).toISOString(),
        period_end: new Date(row.period_end).toISOString(),
        mrr_usd: (row.mrr_cents / 100).toFixed(2),
        throughput: row.throughput_count,
        viral_score: row.viral_score,
        affiliate_revenue_usd: (aff / 100).toFixed(2),
        marketing_spend_usd: (spend / 100).toFixed(2),
        roi: `${roi}x`,
        created_at: new Date(row.created_at).toISOString(),
      };
    }

    offset += results.length;
    if (results.length < PAGE_SIZE) {
      hasMore = false;
    }
  }
}

async function handleExportRequest(
  params: ExportQueryParams,
  _req: NextRequest,
): Promise<Response> {
  // 1. Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required for analytics export' },
      { status: 401 },
    );
  }

  // 2. Database client lookup
  const db = await getD1();
  if (!db) {
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' },
      { status: 503 },
    );
  }

  // 3. Resolve caller active organization
  const currentOrgId = await resolveOrgId(user.id, db);
  if (!currentOrgId) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'User is not associated with an active organization' },
      { status: 403 },
    );
  }

  // 4. Assert tenant isolation scope against requested org
  const requestedOrgId = (params.orgId || currentOrgId).trim();
  try {
    assertTenantScope(currentOrgId, requestedOrgId);
  } catch (err) {
    if (err instanceof CrossTenantViolationError) {
      logger.warn('[API:Export] Cross-tenant export attempt blocked', {
        userId: user.id,
        currentOrgId,
        requestedOrgId,
      });
      return NextResponse.json(
        { error: 'CROSS_TENANT_VIOLATION', message: err.message, code: err.code },
        { status: 403 },
      );
    }
    throw err;
  }

  // 5. Parse and validate format
  const rawFormat = (params.format || 'csv').toLowerCase().trim();
  if (rawFormat !== 'csv' && rawFormat !== 'json' && rawFormat !== 'ndjson') {
    return NextResponse.json(
      { error: 'INVALID_FORMAT', message: "Format must be 'csv', 'json', or 'ndjson'" },
      { status: 400 },
    );
  }
  const format = rawFormat as ExportFormat;

  // 6. Parse and validate date range
  const now = Date.now();
  const startTimestamp = params.start ? Number(params.start) : now - 30 * 86400 * 1000;
  const endTimestamp = params.end ? Number(params.end) : now;

  if (isNaN(startTimestamp) || isNaN(endTimestamp) || startTimestamp <= 0 || endTimestamp <= 0) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'start and end must be valid positive timestamps in milliseconds' },
      { status: 400 },
    );
  }

  if (startTimestamp > endTimestamp) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'start timestamp cannot be greater than end timestamp' },
      { status: 400 },
    );
  }

  const maxRangeMs = 365 * 86400 * 1000;
  if (endTimestamp - startTimestamp > maxRangeMs) {
    return NextResponse.json(
      { error: 'INVALID_DATE_RANGE', message: 'Date range cannot exceed 365 days' },
      { status: 400 },
    );
  }

  const category = (params.category || 'all').toLowerCase().trim();
  const headers = category === 'summary' ? SUMMARY_HEADERS : DEFAULT_HEADERS;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `analytics-export-${currentOrgId}-${dateStr}`;

  logger.info('[API:Export] Initiating streaming analytics export', {
    orgId: currentOrgId,
    format,
    startTimestamp,
    endTimestamp,
    category,
  });

  // 7. Stream generator into response
  const dataStream = fetchExecutiveBIMetricsStream(
    db,
    currentOrgId,
    startTimestamp,
    endTimestamp,
    category,
  );

  return createStreamingExportResponse(dataStream, format, filename, {
    headers,
    csvOptions: {
      delimiter: ',',
      lineEnding: '\r\n',
      headers,
    },
    jsonOptions: {
      indent: 2,
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: searchParams.get('format'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      category: searchParams.get('category'),
      orgId: searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: ExportQueryParams = {};
    try {
      body = (await request.json()) as ExportQueryParams;
    } catch {
      // Body is empty or not JSON, fallback to query parameters
    }

    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: body.format || searchParams.get('format'),
      start: body.start !== undefined ? String(body.start) : searchParams.get('start'),
      end: body.end !== undefined ? String(body.end) : searchParams.get('end'),
      category: body.category || searchParams.get('category'),
      orgId: body.orgId || searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}
