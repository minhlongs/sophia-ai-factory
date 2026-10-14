/**
 * GET /api/audit - RaaS Gateway Audit Log Query Endpoint
 * Dual authentication, rate limiting, self-auditing, GDPR redaction, pagination.
 * @module api/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditQuery, queryAuditLogs } from '@/tree/audit/audit-query-logger';
import {
  auditQuerySchema,
  verifyAuditRequest,
  type AuditQueryParams,
} from './audit-query-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const auth = await verifyAuditRequest(request);
  if (!auth.authorized) {
    return auth.response;
  }

  const { apiKeyId, userId, rateLimitResult } = auth;
  const searchParams = request.nextUrl.searchParams;
  let queryParams: AuditQueryParams;

  try {
    queryParams = auditQuerySchema.parse(Object.fromEntries(searchParams));
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Audit API] Invalid query parameters', { issues: error.issues });
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const { includePII, limit, offset, ...filters } = queryParams;

  const results = await queryAuditLogs(
    {
      ...filters,
      limit,
      offset,
    },
    includePII,
  );

  const duration = Date.now() - startTime;

  await logAuditQuery({
    queriedBy: userId,
    apiKeyId,
    filters: queryParams,
    resultCount: results.length,
    duration,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0],
    userAgent: request.headers.get('user-agent') || undefined,
  });

  return NextResponse.json(
    {
      data: results,
      meta: {
        count: results.length,
        limit,
        offset,
        hasMore: results.length === limit,
        queriedAt: new Date().toISOString(),
        duration,
      },
    },
    {
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
      },
    },
  );
}
