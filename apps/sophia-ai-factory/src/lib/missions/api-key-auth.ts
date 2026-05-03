/**
 * API Key Authentication for /api/v1/missions
 *
 * Validates the Authorization: Bearer <key> header against raas_api_keys table.
 * Key is stored as SHA-256 hash in key_hash column.
 */

import { createServerClient } from '@/lib/db/client';
import { sha256 } from '@/lib/audit/crypto-utils';
import { logger } from '@/lib/utils/logger-utility';

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

  if (!rawKey) {
    return { valid: false, error: 'Missing API key. Provide Authorization: Bearer <key> header.' };
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
