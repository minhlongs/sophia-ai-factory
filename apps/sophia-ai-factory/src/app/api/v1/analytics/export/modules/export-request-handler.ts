import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { assertTenantScope, CrossTenantViolationError } from '@/forest/tenant/isolation-guard';
import {
  createStreamingExportResponse,
  type ExportFormat,
} from '@/tree/bi/export-formatter';
import {
  type ExportQueryParams,
  DEFAULT_HEADERS,
  SUMMARY_HEADERS,
} from './export-types';
import { fetchExecutiveBIMetricsStream } from './export-metrics-stream';

export async function handleExportRequest(
  params: ExportQueryParams,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Authentication required for analytics export' },
      { status: 401 },
    );
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' },
      { status: 503 },
    );
  }

  const currentOrgId = await resolveOrgId(user.id, db);
  if (!currentOrgId) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'User is not associated with an active organization' },
      { status: 403 },
    );
  }

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

  const rawFormat = (params.format || 'csv').toLowerCase().trim();
  if (rawFormat !== 'csv' && rawFormat !== 'json' && rawFormat !== 'ndjson') {
    return NextResponse.json(
      { error: 'INVALID_FORMAT', message: "Format must be 'csv', 'json', or 'ndjson'" },
      { status: 400 },
    );
  }
  const format = rawFormat as ExportFormat;

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
