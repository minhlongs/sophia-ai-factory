import { NextRequest } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { jwtVerify } from 'jose';
import { sha256 } from '@/lib/audit/crypto-utils';

/** Sanitize input — allow alphanumeric + limited punctuation, max 100 chars. */
export function sanitizeInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const sanitized = input.replace(/[^a-zA-Z0-9-_:.]/g, '');
  if (sanitized.length > 100) return null;
  return sanitized;
}

/**
 * Extract agency/tenant ID from request.
 * Priority: x-raas-agency-id header → JWT claim → mk_ API key DB lookup.
 */
export async function extractAgencyId(request: NextRequest): Promise<string | null> {
  const agencyIdHeader = request.headers.get('x-raas-agency-id');
  if (agencyIdHeader) return sanitizeInput(agencyIdHeader);

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    if (token.split('.').length === 3) {
      try {
        const secret = new TextEncoder().encode(
          process.env.RAAS_JWT_SECRET=REDACTED || process.env.JWT_SECRET=REDACTED || ''
        );

        if (!secret || secret.length === 0) {
          logger.error('[Tenant Isolation] Missing JWT secret for verification');
          return null;
        }

        const verified = await jwtVerify(token, secret);
        const agencyId = verified.payload.agency_id as string;
        if (agencyId) return sanitizeInput(agencyId);
      } catch (error) {
        logger.error('[Tenant Isolation] JWT verification failed', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  const apiKey = request.headers.get('x-raas-api-key') ||
    request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (apiKey && apiKey.startsWith('mk_')) {
    try {
      const db = createServerClient();
      const apiKeyHash = sha256(apiKey);

      const { data: rawData, error } = await db
        .from('raas_api_keys')
        .select('owner_id, permissions')
        .eq('key_hash', apiKeyHash)
        .single();
      const data = rawData as { owner_id: string | null; permissions?: unknown } | null;

      if (error) {
        logger.error('[Tenant Isolation] Error fetching API key data', toError(error));
        return null;
      }

      if (data) return sanitizeInput(data.owner_id);
    } catch (error) {
      logger.error('[Tenant Isolation] Error resolving agency from API key', error instanceof Error ? error : new Error(String(error)));
    }
  }

  return null;
}
