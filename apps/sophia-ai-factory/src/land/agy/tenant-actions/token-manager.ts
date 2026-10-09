/**
 * Agency Tenant Token Management
 *
 * @module land/agy/tenant-actions/token-manager
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { generateTenantToken } from '@/tree/agy/tenant-token-engine';
import type { IssueTokenInput } from './types';
import { recordAuditLog } from './audit-logger';

/**
 * Issues a cryptographically signed tenant token for an agency.
 */
export async function issueAgencyTenantToken(input: IssueTokenInput): Promise<{
  success: boolean;
  token?: string;
  tokenHash?: string;
  tokenId?: string;
  expiresAt?: number | null;
  error?: string;
}> {
  const { agencyId, name, permissions = ['read', 'write'], expiresInSeconds = 86400 * 30, actorId } = input;

  if (!agencyId || !name) {
    return { success: false, error: 'agencyId and name are required' };
  }

  const secret = process.env.AGY_TOKEN_SECRET || process.env.AUTH_SECRET || 'sophia-agy-dev-secret-key-32b';
  const db = createServerClient();

  try {
    const generated = await generateTenantToken(
      { agencyId, name, permissions, expiresInSeconds },
      secret
    );

    await db
      .prepare(
        `INSERT INTO agy_tenant_tokens (
           id, agency_id, token_hash, name, permissions_json, expires_at, created_at, revoked_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)`
      )
      .bind(
        generated.model.id,
        agencyId,
        generated.tokenHash,
        name,
        JSON.stringify(permissions),
        generated.payload.expiresAt,
        generated.payload.issuedAt
      )
      .run();

    await recordAuditLog(agencyId, 'TOKEN_ISSUED', `token:${generated.model.id}`, {
      tokenName: name,
      permissions,
      expiresAt: generated.payload.expiresAt,
    }, actorId);

    return {
      success: true,
      token: generated.token,
      tokenHash: generated.tokenHash,
      tokenId: generated.model.id,
      expiresAt: generated.payload.expiresAt,
    };
  } catch (err) {
    logger.error('[AGY Actions] issueAgencyTenantToken failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

/**
 * Revokes a tenant token.
 */
export async function revokeAgencyTenantToken(
  tokenId: string,
  agencyId: string,
  actorId?: string
): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        `UPDATE agy_tenant_tokens
         SET revoked_at = ?1
         WHERE id = ?2 AND agency_id = ?3`
      )
      .bind(now, tokenId, agencyId)
      .run();

    await recordAuditLog(agencyId, 'TOKEN_REVOKED', `token:${tokenId}`, { tokenId }, actorId);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
