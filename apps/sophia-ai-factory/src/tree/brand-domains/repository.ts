/**
 * Brand Domain Registry Write Mutations & Immutable Audit Trail
 * Layer: tree
 *
 * @module tree/brand-domains/repository
 */

import type {
  BrandDomainAuditAction,
  BrandDomainIdentity,
  BrandDomainReadinessChecks,
} from '@/seed/domain';
import {
  EMPTY_READINESS_CHECKS,
  evaluateDomainReadiness,
  validateBrandDomainCandidate,
} from './readiness';
import { getBrandDomainById } from './repository-queries';

export {
  listBrandDomains,
  listActiveHostnamesForWorker,
  getBrandDomainById,
  listBrandDomainAuditEvents,
} from './repository-queries';

export interface ActorContext {
  readonly actorId: string;
  readonly actorEmail?: string | null;
}

export interface RegisterBrandDomainInput {
  readonly hostname: string;
  readonly workerName: string;
  readonly cloudflareZoneId?: string | null;
  readonly tenantId?: string | null;
  readonly authPolicy?: string;
  readonly isCanonical?: boolean;
}

async function appendAuditEvent(
  db: D1Database,
  domainId: string,
  hostname: string,
  action: BrandDomainAuditAction,
  actor: ActorContext,
  details: Record<string, unknown>,
): Promise<void> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO brand_domain_audit_events
        (id, domain_id, hostname, action, actor_id, actor_email, details_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      id,
      domainId,
      hostname,
      action,
      actor.actorId,
      actor.actorEmail ?? null,
      JSON.stringify(details),
    )
    .run();
}

export async function registerBrandDomain(
  db: D1Database,
  input: RegisterBrandDomainInput,
  actor: ActorContext,
): Promise<BrandDomainIdentity> {
  const validation = validateBrandDomainCandidate(input.hostname);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid brand domain hostname');
  }

  const existing = await db
    .prepare(`SELECT id FROM brand_domains WHERE hostname = ?1`)
    .bind(validation.hostname)
    .first<{ id: string }>();
  if (existing) {
    throw new Error(`Brand domain ${validation.hostname} is already registered`);
  }

  const id = crypto.randomUUID();
  const authPolicy = input.authPolicy?.trim() || 'standard';
  await db
    .prepare(
      `INSERT INTO brand_domains
        (id, hostname, cloudflare_zone_id, worker_name, tenant_id, status, is_canonical, auth_policy, created_by)
       VALUES (?1, ?2, ?3, ?4, ?5, 'PENDING', ?6, ?7, ?8)`,
    )
    .bind(
      id,
      validation.hostname,
      input.cloudflareZoneId?.trim() || null,
      input.workerName.trim(),
      input.tenantId?.trim() || null,
      input.isCanonical ? 1 : 0,
      authPolicy,
      actor.actorId,
    )
    .run();

  await appendAuditEvent(db, id, validation.hostname, 'REGISTERED', actor, {
    workerName: input.workerName.trim(),
    cloudflareZoneId: input.cloudflareZoneId?.trim() || null,
    tenantId: input.tenantId?.trim() || null,
  });

  const created = await getBrandDomainById(db, id);
  if (!created) throw new Error('Failed to load newly registered brand domain');
  return created;
}

export async function updateBrandDomainChecks(
  db: D1Database,
  id: string,
  partialChecks: Partial<BrandDomainReadinessChecks>,
  actor: ActorContext,
): Promise<BrandDomainIdentity> {
  const current = await getBrandDomainById(db, id);
  if (!current) throw new Error('Brand domain not found');

  const merged: BrandDomainReadinessChecks = {
    ...EMPTY_READINESS_CHECKS,
    ...current.checks,
    ...partialChecks,
  };

  await db
    .prepare(
      `UPDATE brand_domains
       SET ownership_verified = ?2, cf_zone_eligible = ?3, worker_attached = ?4,
           tls_verified = ?5, auth_origin_verified = ?6, access_policy_verified = ?7,
           tenant_auth_verified = ?8, no_public_bypass_verified = ?9,
           external_callbacks_reviewed = ?10, smoke_verified = ?11,
           updated_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(
      id,
      merged.ownershipVerified ? 1 : 0,
      merged.cfZoneEligible ? 1 : 0,
      merged.workerAttached ? 1 : 0,
      merged.tlsVerified ? 1 : 0,
      merged.authOriginVerified ? 1 : 0,
      merged.accessPolicyVerified ? 1 : 0,
      merged.tenantAuthVerified ? 1 : 0,
      merged.noPublicBypassVerified ? 1 : 0,
      merged.externalCallbacksReviewed ? 1 : 0,
      merged.smokeVerified ? 1 : 0,
    )
    .run();

  await appendAuditEvent(db, id, current.hostname, 'CHECKS_UPDATED', actor, { checks: merged });

  const updated = await getBrandDomainById(db, id);
  if (!updated) throw new Error('Brand domain not found after update');
  return updated;
}

export async function transitionBrandDomainStatus(
  db: D1Database,
  id: string,
  action: 'verify' | 'activate' | 'suspend' | 'rollback',
  actor: ActorContext,
  reason?: string,
): Promise<BrandDomainIdentity> {
  const current = await getBrandDomainById(db, id);
  if (!current) throw new Error('Brand domain not found');

  if (action === 'verify') {
    if (!current.checks.ownershipVerified || !current.checks.cfZoneEligible) {
      throw new Error('Ownership and Cloudflare zone eligibility must be verified first');
    }
    await db
      .prepare(`UPDATE brand_domains SET status = 'VERIFIED', updated_at = datetime('now') WHERE id = ?1`)
      .bind(id)
      .run();
    await appendAuditEvent(db, id, current.hostname, 'VERIFIED', actor, {
      previousStatus: current.status,
      reason: reason ?? null,
    });
  } else if (action === 'activate') {
    const evalResult = evaluateDomainReadiness(current.checks);
    if (!evalResult.readyToActivate) {
      throw new Error(
        `Cannot activate ${current.hostname}: missing gates (${evalResult.missingChecks.join(', ')})`,
      );
    }
    await db
      .prepare(
        `UPDATE brand_domains
         SET status = 'ACTIVE', activated_by = ?2, activated_at = datetime('now'),
             suspended_at = NULL, updated_at = datetime('now')
         WHERE id = ?1`,
      )
      .bind(id, actor.actorId)
      .run();
    await appendAuditEvent(db, id, current.hostname, 'ACTIVATED', actor, {
      previousStatus: current.status,
      passedGates: evalResult.passedCount,
    });
  } else {
    const auditAction: BrandDomainAuditAction = action === 'rollback' ? 'ROLLED_BACK' : 'SUSPENDED';
    await db
      .prepare(
        `UPDATE brand_domains
         SET status = 'SUSPENDED', suspended_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?1`,
      )
      .bind(id)
      .run();
    await appendAuditEvent(db, id, current.hostname, auditAction, actor, {
      previousStatus: current.status,
      reason: reason ?? null,
    });
  }

  const updated = await getBrandDomainById(db, id);
  if (!updated) throw new Error('Brand domain not found after transition');
  return updated;
}
