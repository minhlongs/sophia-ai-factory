/**
 * Cryptographic hashing and row mapping helpers for agent API auth.
 * @module tree/api/agent-auth/hash
 */

import type { ApiKey, ApiPermission } from '@/seed/types/agent-api';

/** SHA-256 hex digest using Web Crypto (CF Workers + Node 19+). */
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Map a DB row (snake_case) to ApiKey (camelCase). */
export function rowToApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    keyHash: row.key_hash as string,
    keyPrefix: row.key_prefix as string,
    name: row.name as string,
    permissions: JSON.parse(row.permissions_json as string) as ApiPermission[],
    rateLimitRpm: row.rate_limit_rpm as number,
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at as number | undefined,
    expiresAt: row.expires_at as number | undefined,
    createdAt: row.created_at as number,
  };
}
