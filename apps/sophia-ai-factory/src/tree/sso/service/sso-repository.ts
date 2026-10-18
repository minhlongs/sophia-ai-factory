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
import {
  SSO_SELECT_COLUMNS,
  deleteEnterpriseSsoConfig,
  mapRowToConfig,
} from './sso-row-mapper';

export { deleteEnterpriseSsoConfig, mapRowToConfig };

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
        `SELECT ${SSO_SELECT_COLUMNS}
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
        `SELECT ${SSO_SELECT_COLUMNS}
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
        `SELECT ${SSO_SELECT_COLUMNS}
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
