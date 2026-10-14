/**
 * Authentication, rate limiting, and query validation for audit endpoint.
 * @module app/api/audit/audit-query-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { validateApiKey } from '@/seed/security/api-key-validator';
import { validateJwt } from '@/seed/security/jwt-validator';
import { checkRateLimit, recordRequest } from '@/seed/security/rate-limiter';

export const auditQuerySchema = z.object({
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),
  action: z.string().max(50).optional(),
  license: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
  includePII: z.coerce.boolean().default(false),
});

export type AuditQueryParams = z.infer<typeof auditQuerySchema>;

export interface AuthSuccess {
  authorized: true;
  apiKeyId: string;
  userId: string;
  rateLimitResult: {
    remaining: number;
    resetAt: number;
  };
}

export interface AuthFailure {
  authorized: false;
  response: NextResponse;
}

export async function verifyAuditRequest(request: NextRequest): Promise<AuthSuccess | AuthFailure> {
  const apiKeyHeader = request.headers.get('x-api-key');
  const apiKeyResult = await validateApiKey(apiKeyHeader);

  if (!apiKeyResult.valid) {
    logger.warn('[Audit API] Invalid API key', { error: apiKeyResult.error });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Invalid API key', code: apiKeyResult.error },
        { status: 401 },
      ),
    };
  }

  const authHeader = request.headers.get('authorization');
  const jwtResult = await validateJwt(authHeader);

  if (!jwtResult.valid) {
    logger.warn('[Audit API] Invalid JWT', { error: jwtResult.error });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Invalid authentication token', code: jwtResult.error },
        { status: 401 },
      ),
    };
  }

  const apiKeyId = apiKeyResult.apiKey!.keyId;
  const rateLimit = apiKeyResult.apiKey!.rateLimitPerMinute;
  const rateLimitResult = await checkRateLimit(apiKeyId, rateLimit);

  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.retryAfter || 60;
    logger.warn('[Audit API] Rate limit exceeded', { apiKeyId, retryAfter });

    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        },
      ),
    };
  }

  await recordRequest(apiKeyId);

  return {
    authorized: true,
    apiKeyId,
    userId: jwtResult.payload?.sub || 'unknown',
    rateLimitResult: {
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
    },
  };
}
