/**
 * API Key Authentication for /api/v1/missions
 *
 * Primary path: validates Authorization: Bearer <key> or x-api-key header
 * against raas_api_keys table (SHA-256 hash comparison). Used by external API clients.
 *
 * Fallback path: session cookie auth via getCurrentUser(). Used by browser
 * clients (e.g. RenderProgress EventSource) that cannot send custom headers.
 * Ownership check is enforced separately by the route (mission.user_id === userId).
 */

import { createServerClient } from '@/seed/db/client';
import { sha256 } from '@/tree/audit/crypto-utils';
import { logger } from '@/seed/utils/logger-utility';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

export interface ApiKeyAuthResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

interface ApiKeyRow {
  user_id: string;
  is_active: boolean;
}

/**
 * Validate API key from Authorization header or x-api-key header.
 * If neither header is present, falls back to Better Auth session cookie.
 * Returns userId if valid, error message if not.
 */
export async function validateMissionApiKey(
  authHeader: string | null,
  xApiKey: string | null,
): Promise<ApiKeyAuthResult> {
  let rawKey: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7).trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  // No API key headers present — fall back to session cookie (browser EventSource path).
  // Browser EventSource cannot send custom headers; Better Auth cookie is sent automatically.
  if (!rawKey) {
    try {
      const user = await getCurrentUser();
      if (user) {
        return { valid: true, userId: user.id };
      }
    } catch (err) {
      logger.error('[ApiKeyAuth] Session fallback error', err instanceof Error ? err : new Error(String(err)));
    }
    return { valid: false, error: 'Missing API key. Provide Authorization: Bearer <key> header or authenticate via session.' };
  }

  try {
    const keyHash = sha256(rawKey);
    const db = createServerClient();

    const { data } = await db
      .from('raas_api_keys')
      .select('user_id, is_active')
      .eq('key_hash', keyHash)
      .single() as { data: ApiKeyRow | null; error: unknown };

    if (!data) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!data.is_active) {
      return { valid: false, error: 'API key is inactive' };
    }

    return { valid: true, userId: data.user_id };
  } catch (err) {
    logger.error('[ApiKeyAuth] Validation error', err instanceof Error ? err : new Error(String(err)));
    return { valid: false, error: 'Authentication error' };
  }
}
