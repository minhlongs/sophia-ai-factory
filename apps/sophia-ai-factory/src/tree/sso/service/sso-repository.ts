/**
 * @file sso-repository.ts
 * @description Database repository operations for Enterprise SSO configurations in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseSsoConfig,
  EnterpriseSsoRow,
} from '@/seed/types/enterprise-sso';
import { logger } from '@/seed/utils/logger-utility';
import { normalizeCorporateDomain } from './domain-validator';

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
 * Retrieve an active Enterprise SSO configuration by email domain.
 */
export async function getEnterpriseSsoByDomain(
  db: D1Database,
  domainOrEmail: string,
): Promise<EnterpriseSsoConfig | null> {
  const domain = normalizeCorporateDomain(domainOrEmail);
  if (!domain) return null;

  try {
    const row = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE domain = ?1 AND enabled = 1
         LIMIT 1`,
      )
      .bind(domain)
      .first<EnterpriseSsoRow>();

    return row ? mapRowToConfig(row) : null;
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to get SSO config by domain', {
      domain,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * List all SSO configurations for a specific organization.
 */
export async function getEnterpriseSsoByOrg(
  db: D1Database,
  orgId: string,
): Promise<EnterpriseSsoConfig[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE org_id = ?1
         ORDER BY created_at DESC`,
      )
      .bind(orgId)
      .all<EnterpriseSsoRow>();

    return (results || []).map(mapRowToConfig);
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to list SSO configs by org', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Retrieve a single SSO configuration by ID.
 */
export async function getEnterpriseSsoById(
  db: D1Database,
  id: string,
): Promise<EnterpriseSsoConfig | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(id)
      .first<EnterpriseSsoRow>();

    return row ? mapRowToConfig(row) : null;
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to get SSO config by id', {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
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
