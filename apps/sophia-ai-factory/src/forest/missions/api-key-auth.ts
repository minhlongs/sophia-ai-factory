/**
 * API Key Authentication for Missions
 * Layer: forest
 * Purpose: Validates API keys for mission access
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { forwardToSentry } from '@/seed/observability/sentry-forwarder';
import { sha256 } from '@/tree/audit/crypto-utils';

/**
 * API Key validation result
 */
export interface ApiKeyAuthResult {
  valid: boolean;
  userId?: string;
  errorType?: 'missing_credentials' | 'invalid_key' | 'inactive' | 'db_unreachable';
  error?: string;
}

/**
 * HTTP error response for API key auth failures
 */
export function apiKeyAuthErrorResponse(
  result: ApiKeyAuthResult
): { status: number; error: string } {
  switch (result.errorType) {
    case 'inactive':
      return { status: 403, error: result.error ?? 'API key is inactive' };
    case 'db_unreachable':
      return { status: 503, error: result.error ?? 'Authentication error' };
    case 'invalid_key':
    case 'missing_credentials':
    default:
      return { status: 401, error: result.error ?? 'Authentication required' };
  }
}

/**
 * Hashes an API key for DB lookup
 */
function hashApiKey(rawKey: string): string {
  return sha256(rawKey);
}

/**
 * Validates an API key for mission access
 * Checks raas_api_keys table or falls back to session user
 */
export async function validateMissionApiKey(
  apiKeyHeader: string | null,
  bearerToken: string | null
): Promise<ApiKeyAuthResult> {
  try {
    // 1. Check session cookie fallback (if no API key provided)
    if (!apiKeyHeader && !bearerToken) {
      const sessionUser = await getCurrentUser();
      if (sessionUser?.id) {
        return { valid: true, userId: sessionUser.id };
      }
      return {
        valid: false,
        errorType: 'missing_credentials',
        error: 'Missing API key',
      };
    }

    // 2. Extract raw key from Bearer or x-api-key header
    const rawKey = bearerToken ?? apiKeyHeader ?? '';
    const cleanKey = rawKey.replace(/^Bearer\s+/i, '').trim();

    if (!cleanKey || !cleanKey.startsWith('mk_')) {
      return {
        valid: false,
        errorType: 'invalid_key',
        error: 'Invalid API key',
      };
    }

    const keyHash = hashApiKey(cleanKey);

    // 3. Look up in DB using D1Client
    const db = createServerClient();
    const { data, error } = await db
      .from('raas_api_keys')
      .select('owner_id, is_active')
      .eq('key_hash', keyHash)
      .single();

    if (error) {
      logger.error('[ApiKeyAuth] DB error', toError(error));
      await forwardToSentry({
        level: 'error',
        message: 'DB error during API key validation',
        tags: { 'auth.error_type': 'db_unreachable' },
      });
      return {
        valid: false,
        errorType: 'db_unreachable',
        error: 'Authentication error',
      };
    }

    if (!data) {
      await forwardToSentry({
        level: 'warning',
        message: 'API key not found',
        tags: { 'auth.error_type': 'invalid_key' },
      });
      return {
        valid: false,
        errorType: 'invalid_key',
        error: 'Invalid API key',
      };
    }

    const row = data as { owner_id: string; is_active: boolean | number };
    if (!row.is_active) {
      await forwardToSentry({
        level: 'warning',
        message: 'API key is inactive',
        tags: { 'auth.error_type': 'inactive' },
      });
      return {
        valid: false,
        errorType: 'inactive',
        error: 'API key is inactive',
      };
    }

    return { valid: true, userId: row.owner_id };
  } catch (err) {
    logger.error('[ApiKeyAuth] Validation error', err instanceof Error ? err : new Error(String(err)));
    await forwardToSentry({
      level: 'error',
      message: 'Exception during API key validation',
      tags: { 'auth.error_type': 'db_unreachable' },
    });
    return {
      valid: false,
      errorType: 'db_unreachable',
      error: 'Authentication error',
    };
  }
}
