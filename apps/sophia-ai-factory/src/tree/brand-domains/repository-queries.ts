/**
 * Brand Domain Registry Read Queries & Row Mappers
 * Layer: tree
 *
 * @module tree/brand-domains/repository-queries
 */

import type {
  BrandDomainAuditAction,
  BrandDomainAuditEvent,
  BrandDomainIdentity,
  BrandDomainStatus,
} from '@/seed/domain';

export interface BrandDomainRow {
  id: string;
  hostname: string;
  cloudflare_zone_id: string | null;
  worker_name: string;
  tenant_id: string | null;
  status: BrandDomainStatus;
  is_canonical: number;
  auth_policy: string;
  ownership_verified: number;
  cf_zone_eligible: number;
  worker_attached: number;
  tls_verified: number;
  auth_origin_verified: number;
  access_policy_verified: number;
  tenant_auth_verified: number;
  no_public_bypass_verified: number;
  external_callbacks_reviewed: number;
  smoke_verified: number;
  created_by: string;
  activated_by: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEventRow {
  id: string;
  domain_id: string;
  hostname: string;
  action: BrandDomainAuditAction;
  actor_id: string;
  actor_email: string | null;
  details_json: string;
  created_at: string;
}

export function mapDomainRow(row: BrandDomainRow): BrandDomainIdentity {
  return {
    id: row.id,
    hostname: row.hostname,
    cloudflareZoneId: row.cloudflare_zone_id,
    workerName: row.worker_name,
    tenantId: row.tenant_id,
    status: row.status,
    isCanonical: row.is_canonical === 1,
    authPolicy: row.auth_policy,
    checks: {
      ownershipVerified: row.ownership_verified === 1,
      cfZoneEligible: row.cf_zone_eligible === 1,
      workerAttached: row.worker_attached === 1,
      tlsVerified: row.tls_verified === 1,
      authOriginVerified: row.auth_origin_verified === 1,
      accessPolicyVerified: row.access_policy_verified === 1,
      tenantAuthVerified: row.tenant_auth_verified === 1,
      noPublicBypassVerified: row.no_public_bypass_verified === 1,
      externalCallbacksReviewed: row.external_callbacks_reviewed === 1,
      smokeVerified: row.smoke_verified === 1,
    },
    createdBy: row.created_by,
    activatedBy: row.activated_by,
    activatedAt: row.activated_at,
    suspendedAt: row.suspended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAuditRow(row: AuditEventRow): BrandDomainAuditEvent {
  return {
    id: row.id,
    domainId: row.domain_id,
    hostname: row.hostname,
    action: row.action,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    detailsJson: row.details_json,
    createdAt: row.created_at,
  };
}

export async function listBrandDomains(
  db: D1Database,
): Promise<BrandDomainIdentity[]> {
  const res = await db
    .prepare(`SELECT * FROM brand_domains ORDER BY created_at DESC`)
    .all<BrandDomainRow>();
  return (res.results ?? []).map(mapDomainRow);
}

export async function listActiveHostnamesForWorker(
  db: D1Database,
  workerName: string,
): Promise<string[]> {
  const res = await db
    .prepare(
      `SELECT hostname FROM brand_domains WHERE status = 'ACTIVE' AND worker_name = ?1`,
    )
    .bind(workerName)
    .all<{ hostname: string }>();
  return (res.results ?? []).map((r) => r.hostname);
}

export async function getBrandDomainById(
  db: D1Database,
  id: string,
): Promise<BrandDomainIdentity | null> {
  const row = await db
    .prepare(`SELECT * FROM brand_domains WHERE id = ?1`)
    .bind(id)
    .first<BrandDomainRow>();
  return row ? mapDomainRow(row) : null;
}

export async function listBrandDomainAuditEvents(
  db: D1Database,
  limit = 50,
): Promise<BrandDomainAuditEvent[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const res = await db
    .prepare(
      `SELECT * FROM brand_domain_audit_events ORDER BY created_at DESC LIMIT ?1`,
    )
    .bind(safeLimit)
    .all<AuditEventRow>();
  return (res.results ?? []).map(mapAuditRow);
}
