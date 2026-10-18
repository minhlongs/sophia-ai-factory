/**
 * Validation schema and response formatters for /api/admin/api-keys
 *
 * @module app/api/admin/api-keys/api-keys-route-helpers
 */

import { z } from 'zod';
import type { getUserApiKeys } from '@/seed/security/api-key-validator';

export const PERMISSION_VALUES = [
  'audit:read',
  'audit:write',
  'reports:download',
  'reports:generate',
] as const;

export const createApiKeyBodySchema = z.object({
  permissions: z.array(z.enum(PERMISSION_VALUES)).min(1, 'permissions array is required'),
  expiresAt: z.coerce.number().int().positive().optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().default(100),
});

export type UserApiKeyRecord = Awaited<ReturnType<typeof getUserApiKeys>>[number];

export function formatApiKeyListResponse(apiKeys: UserApiKeyRecord[]) {
  return {
    success: true,
    count: apiKeys.length,
    keys: apiKeys.map((key) => ({
      keyId: key.keyId,
      keyPrefix: key.keyPrefix,
      permissions: key.permissions,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      rateLimitPerMinute: key.rateLimitPerMinute,
    })),
  };
}
