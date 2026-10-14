import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ApiKeyRecord } from '@/tree/usage-metering/types';
import type { D1Response } from '@/seed/db/types';
import { ApiKeyAuthResult } from './types';

/**
 * Validate API key and return associated user info
 */
export async function validateApiKey(apiKey: string | null): Promise<ApiKeyAuthResult> {
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }

  try {
    const db = createServerClient();

    // Look up API key in raas_api_keys table
    const { data: apiKeyRecord, error } = (await db
      .from('raas_api_keys')
      .select('user_id, license_nonce, is_active, tier')
      .eq('key_hash', apiKey)
      .single()) as unknown as D1Response<ApiKeyRecord>;

    if (error || !apiKeyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!apiKeyRecord.is_active) {
      return { valid: false, error: 'API key has been deactivated' };
    }

    return {
      valid: true,
      userId: apiKeyRecord.user_id,
      licenseNonce: apiKeyRecord.license_nonce,
      tier: apiKeyRecord.tier || 'BASIC',
    };
  } catch (error) {
    logger.error(
      '[Batch Ingest API] Error validating API key',
      error instanceof Error ? error : new Error(String(error)),
    );
    return { valid: false, error: 'Failed to validate API key' };
  }
}
