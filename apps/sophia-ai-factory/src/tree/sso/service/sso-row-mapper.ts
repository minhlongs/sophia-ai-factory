/**
 * @file sso-row-mapper.ts
 * @description Row mapper and mutation helper for Enterprise SSO configurations in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseSsoConfig,
  EnterpriseSsoRow,
} from '@/seed/types/enterprise-sso';

export const SSO_SELECT_COLUMNS =
  'id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted, metadata_url, sso_url, certificate, enabled, created_at, updated_at';

export function mapRowToConfig(row: EnterpriseSsoRow): EnterpriseSsoConfig {
  return {
    id: row.id,
    orgId: row.org_id,
    domain: row.domain,
    providerType: row.provider_type as 'saml' | 'oidc',
    issuer: row.issuer,
    clientId: row.client_id,
    clientSecretEncrypted: row.client_secret_encrypted,
    metadataUrl: row.metadata_url,
    ssoUrl: row.sso_url,
    certificate: row.certificate,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Delete an SSO configuration.
 */
export async function deleteEnterpriseSsoConfig(
  db: D1Database,
  id: string,
  orgId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM enterprise_sso_configs WHERE id = ?1 AND org_id = ?2')
    .bind(id, orgId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
