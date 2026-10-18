/**
 * @file config-manager.ts
 * @description Creation and update mutation operations for Enterprise SSO configurations in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseSsoConfig,
  CreateEnterpriseSsoInput,
} from '@/seed/types/enterprise-sso';
import { randomBytes } from 'node:crypto';
import {
  normalizeCorporateDomain,
  isCorporateEmailDomain,
} from './domain-validator';
import { encryptClientSecret } from './crypto-service';
import { getEnterpriseSsoById } from './sso-repository';
import { upsertEnterpriseSsoRow } from './sso-config-statements';

export { updateEnterpriseSsoConfig } from './config-update-helper';

/**
 * Create or save an Enterprise SSO configuration.
 */
export async function saveEnterpriseSsoConfig(
  db: D1Database,
  input: CreateEnterpriseSsoInput,
): Promise<EnterpriseSsoConfig> {
  const normalizedDomain = normalizeCorporateDomain(input.domain);

  if (!isCorporateEmailDomain(normalizedDomain)) {
    throw new Error(
      `Invalid corporate email domain: "${input.domain}". Must be a valid corporate domain (not public webmail like gmail.com).`,
    );
  }

  // Check if domain is already registered by another organization
  const existingDomainConfig = await db
    .prepare('SELECT id, org_id FROM enterprise_sso_configs WHERE domain = ?1 LIMIT 1')
    .bind(normalizedDomain)
    .first<{ id: string; org_id: string }>();

  if (existingDomainConfig && existingDomainConfig.org_id !== input.orgId) {
    throw new Error(
      `Domain "${normalizedDomain}" is already claimed by another organization. Contact support for domain verification.`,
    );
  }

  const id = existingDomainConfig ? existingDomainConfig.id : randomBytes(16).toString('hex');
  const encryptedSecret = input.clientSecret ? encryptClientSecret(input.clientSecret) : null;
  const enabledInt = input.enabled !== false ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);

  await upsertEnterpriseSsoRow({
    db,
    id,
    isUpdate: Boolean(existingDomainConfig),
    normalizedDomain,
    input,
    encryptedSecret,
    enabledInt,
    now,
  });

  const saved = await getEnterpriseSsoById(db, id);
  if (!saved) {
    throw new Error('Failed to retrieve saved SSO config after insertion');
  }

  return saved;
}
