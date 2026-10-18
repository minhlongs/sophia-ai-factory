/**
 * @file config-update-helper.ts
 * @description Update mutation helper for Enterprise SSO configurations in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseSsoConfig,
  UpdateEnterpriseSsoInput,
} from '@/seed/types/enterprise-sso';
import {
  normalizeCorporateDomain,
  isCorporateEmailDomain,
} from './domain-validator';
import { encryptClientSecret } from './crypto-service';
import { getEnterpriseSsoById } from './sso-repository';

/**
 * Update an existing SSO configuration.
 */
export async function updateEnterpriseSsoConfig(
  db: D1Database,
  id: string,
  orgId: string,
  input: UpdateEnterpriseSsoInput,
): Promise<EnterpriseSsoConfig | null> {
  const existing = await getEnterpriseSsoById(db, id);
  if (!existing || existing.orgId !== orgId) {
    return null;
  }

  let domain = existing.domain;
  if (input.domain) {
    const normalized = normalizeCorporateDomain(input.domain);
    if (!isCorporateEmailDomain(normalized)) {
      throw new Error(`Invalid corporate email domain: "${input.domain}"`);
    }

    // Check conflict
    const conflict = await db
      .prepare('SELECT id FROM enterprise_sso_configs WHERE domain = ?1 AND id != ?2 LIMIT 1')
      .bind(normalized, id)
      .first<{ id: string }>();

    if (conflict) {
      throw new Error(`Domain "${normalized}" is already registered to another SSO config.`);
    }

    domain = normalized;
  }

  const providerType = input.providerType ?? existing.providerType;
  const issuer = input.issuer ?? existing.issuer;
  const clientId = input.clientId ?? existing.clientId;
  const encryptedSecret = input.clientSecret
    ? encryptClientSecret(input.clientSecret)
    : existing.clientSecretEncrypted;
  const metadataUrl = input.metadataUrl !== undefined ? input.metadataUrl : existing.metadataUrl;
  const ssoUrl = input.ssoUrl !== undefined ? input.ssoUrl : existing.ssoUrl;
  const certificate = input.certificate !== undefined ? input.certificate : existing.certificate;
  const enabledInt = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE enterprise_sso_configs
       SET domain = ?1, provider_type = ?2, issuer = ?3, client_id = ?4,
           client_secret_encrypted = ?5, metadata_url = ?6, sso_url = ?7,
           certificate = ?8, enabled = ?9, updated_at = ?10
       WHERE id = ?11 AND org_id = ?12`,
    )
    .bind(
      domain, providerType, issuer, clientId, encryptedSecret,
      metadataUrl, ssoUrl, certificate, enabledInt, now, id, orgId,
    )
    .run();

  return getEnterpriseSsoById(db, id);
}
