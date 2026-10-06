'use server';

/**
 * Land Layer: Agency Tenant Server Actions
 *
 * Provides transactional server actions for registering agency tenants,
 * binding custom/subdomains, issuing tenant API tokens, updating compute quotas,
 * and querying tenant audit logs.
 *
 * Layer: land (imports @/seed/*, @/tree/*; strictly zero imports from @/forest/*)
 *
 * @module land/agy/agency-tenant-actions
 */

import { createServerClient, tryCreateServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AgencyTenantConfig,
  AgyTenantToken,
  AgencyDomainRecord,
  AgyAuditLogRecord,
} from '@/seed/types/agy-multitenancy';
import {
  isValidAgencySlug,
  normalizeHostname,
} from '@/tree/agy/domain-router';
import {
  generateTenantToken,
} from '@/tree/agy/tenant-token-engine';
import {
  calculateNextQuotaState,
} from '@/tree/agy/agency-quota-engine';

export interface RegisterAgencyInput {
  orgId: string;
  agencySlug: string;
  customDomain?: string | null;
  quotaLimitMcu?: number;
  rateLimitRps?: number;
  actorId?: string;
}

export interface RegisterDomainInput {
  agencyId: string;
  domain: string;
  domainType?: 'subdomain' | 'custom';
  isPrimary?: boolean;
  actorId?: string;
}

export interface IssueTokenInput {
  agencyId: string;
  name: string;
  permissions?: string[];
  expiresInSeconds?: number;
  actorId?: string;
}

/** Helper to insert audit event log */
async function recordAuditLog(
  agencyId: string,
  eventType: string,
  resource: string,
  details: Record<string, unknown>,
  actorId: string | null = null
): Promise<void> {
  const db = await tryCreateServerClient();
  if (!db) return;

  const now = Math.floor(Date.now() / 1000);
  const auditId = `aud_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_audit_logs (id, agency_id, event_type, actor_id, resource, details_json, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(
        auditId,
        agencyId,
        eventType,
        actorId,
        resource,
        JSON.stringify(details),
        now
      )
      .run();
  } catch (err) {
    logger.warn('[AGY Actions] Failed to write audit log', {
      agencyId,
      eventType,
      error: String(err),
    });
  }
}

/**
 * Registers a new agency tenant configuration.
 */
export async function registerAgencyTenant(input: RegisterAgencyInput): Promise<{
  success: boolean;
  agencyId?: string;
  error?: string;
}> {
  const { orgId, agencySlug, customDomain, quotaLimitMcu = 100000, rateLimitRps = 100, actorId } = input;

  if (!orgId) {
    return { success: false, error: 'orgId is required' };
  }
  if (!isValidAgencySlug(agencySlug)) {
    return { success: false, error: `Invalid or reserved agency slug: "${agencySlug}"` };
  }

  const db = createServerClient();
  const normalizedDomain = customDomain ? normalizeHostname(customDomain) : null;
  const now = Math.floor(Date.now() / 1000);
  const agencyId = `agy_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_tenant_configs (
           agency_id, org_id, agency_slug, custom_domain, status,
           quota_limit_mcu, quota_used_mcu, rate_limit_rps, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, 0, ?6, ?7, ?8)`
      )
      .bind(
        agencyId,
        orgId,
        agencySlug.toLowerCase().trim(),
        normalizedDomain,
        quotaLimitMcu,
        rateLimitRps,
        now,
        now
      )
      .run();

    await recordAuditLog(agencyId, 'AGENCY_REGISTERED', `agency:${agencyId}`, {
      orgId,
      agencySlug,
      customDomain: normalizedDomain,
      quotaLimitMcu,
    }, actorId);

    return { success: true, agencyId };
  } catch (err) {
    logger.error('[AGY Actions] registerAgencyTenant failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

/**
 * Registers an agency domain (subdomain or verified custom domain).
 */
export async function registerAgencyDomain(input: RegisterDomainInput): Promise<{
  success: boolean;
  domainId?: string;
  error?: string;
}> {
  const { agencyId, domain, domainType = 'custom', isPrimary = false, actorId } = input;
  const normalizedDomain = normalizeHostname(domain);

  if (!agencyId || !normalizedDomain) {
    return { success: false, error: 'agencyId and domain are required' };
  }

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const domainId = `dom_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const verificationToken = `agy_verify_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_agency_domains (
           id, agency_id, domain, domain_type, ssl_status, verification_token, is_primary, created_at
         ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7)`
      )
      .bind(
        domainId,
        agencyId,
        normalizedDomain,
        domainType,
        verificationToken,
        isPrimary ? 1 : 0,
        now
      )
      .run();

    await recordAuditLog(agencyId, 'DOMAIN_REGISTERED', `domain:${normalizedDomain}`, {
      domainId,
      domainType,
      isPrimary,
    }, actorId);

    return { success: true, domainId };
  } catch (err) {
    logger.error('[AGY Actions] registerAgencyDomain failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

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
 * Updates an agency's compute quota limit and rate limit.
 */
export async function updateAgencyQuota(input: {
  agencyId: string;
  quotaLimitMcu: number;
  rateLimitRps?: number;
  actorId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { agencyId, quotaLimitMcu, rateLimitRps, actorId } = input;

  if (!agencyId || quotaLimitMcu < 0) {
    return { success: false, error: 'Valid agencyId and non-negative quotaLimitMcu required' };
  }

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    if (rateLimitRps !== undefined && rateLimitRps > 0) {
      await db
        .prepare(
          `UPDATE agy_tenant_configs
           SET quota_limit_mcu = ?1, rate_limit_rps = ?2, updated_at = ?3
           WHERE agency_id = ?4`
        )
        .bind(quotaLimitMcu, rateLimitRps, now, agencyId)
        .run();
    } else {
      await db
        .prepare(
          `UPDATE agy_tenant_configs
           SET quota_limit_mcu = ?1, updated_at = ?2
           WHERE agency_id = ?3`
        )
        .bind(quotaLimitMcu, now, agencyId)
        .run();
    }

    await recordAuditLog(agencyId, 'QUOTA_UPDATED', `agency:${agencyId}`, {
      newQuotaLimitMcu: quotaLimitMcu,
      newRateLimitRps: rateLimitRps,
    }, actorId);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Increments quota used by an agency.
 */
export async function incrementAgencyQuotaUsed(
  agencyId: string,
  deltaMcu: number
): Promise<{ success: boolean; newQuotaUsedMcu?: number; error?: string }> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  try {
    // Atomic SQL increment preventing read-modify-write race conditions
    // Clamps at 0 so quota_used_mcu never drops below 0 on negative deltas
    const res = await db
      .prepare(
        `UPDATE agy_tenant_configs
         SET quota_used_mcu = MAX(0, ROUND(quota_used_mcu + ?1)), updated_at = ?2
         WHERE agency_id = ?3`
      )
      .bind(deltaMcu, now, agencyId)
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return { success: false, error: `Agency ${agencyId} not found` };
    }

    const updated = await db
      .prepare(`SELECT quota_used_mcu FROM agy_tenant_configs WHERE agency_id = ?1 LIMIT 1`)
      .bind(agencyId)
      .first<{ quota_used_mcu: number }>();

    return { success: true, newQuotaUsedMcu: updated?.quota_used_mcu ?? 0 };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Retrieves agency tenant config by ID or slug.
 */
export async function getAgencyTenantConfig(agencyIdOrSlug: string): Promise<AgencyTenantConfig | null> {
  const db = createServerClient();

  try {
    const row = await db
      .prepare(
        `SELECT agency_id, org_id, agency_slug, custom_domain, status,
                quota_limit_mcu, quota_used_mcu, rate_limit_rps, created_at, updated_at
         FROM agy_tenant_configs
         WHERE agency_id = ?1 OR agency_slug = ?1
         LIMIT 1`
      )
      .bind(agencyIdOrSlug)
      .first<{
        agency_id: string;
        org_id: string;
        agency_slug: string;
        custom_domain: string | null;
        status: string;
        quota_limit_mcu: number;
        quota_used_mcu: number;
        rate_limit_rps: number;
        created_at: number;
        updated_at: number;
      }>();

    if (!row) return null;

    return {
      agencyId: row.agency_id,
      orgId: row.org_id,
      agencySlug: row.agency_slug,
      customDomain: row.custom_domain,
      status: row.status as AgencyTenantConfig['status'],
      quotaLimitMcu: row.quota_limit_mcu,
      quotaUsedMcu: row.quota_used_mcu,
      rateLimitRps: row.rate_limit_rps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      agency_id: row.agency_id,
      org_id: row.org_id,
      agency_slug: row.agency_slug,
      custom_domain: row.custom_domain,
      quota_limit_mcu: row.quota_limit_mcu,
      quota_used_mcu: row.quota_used_mcu,
      rate_limit_rps: row.rate_limit_rps,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (err) {
    logger.warn('[AGY Actions] getAgencyTenantConfig failed', { agencyIdOrSlug, error: String(err) });
    return null;
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

/**
 * Queries audit logs for an agency.
 */
export async function queryAgencyAuditLogs(
  agencyId: string,
  limit: number = 50
): Promise<AgyAuditLogRecord[]> {
  const db = createServerClient();

  try {
    const rows = await db
      .prepare(
        `SELECT id, agency_id, event_type, actor_id, resource, details_json, timestamp
         FROM agy_audit_logs
         WHERE agency_id = ?1
         ORDER BY timestamp DESC
         LIMIT ?2`
      )
      .bind(agencyId, Math.min(200, Math.max(1, limit)))
      .all<{
        id: string;
        agency_id: string;
        event_type: string;
        actor_id: string | null;
        resource: string;
        details_json: string;
        timestamp: number;
      }>();

    const list = rows.results || [];
    return list.map((r) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(r.details_json || '{}');
      } catch {
        // fallback
      }
      return {
        id: r.id,
        agencyId: r.agency_id,
        eventType: r.event_type,
        actorId: r.actor_id,
        resource: r.resource,
        details,
        ipAddress: null,
        timestamp: r.timestamp,
        agency_id: r.agency_id,
        event_type: r.event_type,
        actor_id: r.actor_id,
        details_json: r.details_json,
      };
    });
  } catch (err) {
    logger.warn('[AGY Actions] queryAgencyAuditLogs error', { agencyId, error: String(err) });
    return [];
  }
}
