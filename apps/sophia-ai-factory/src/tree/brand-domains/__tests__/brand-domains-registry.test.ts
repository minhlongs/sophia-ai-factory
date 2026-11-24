import { describe, it, expect } from 'vitest';
import {
  EMPTY_READINESS_CHECKS,
  evaluateDomainReadiness,
  validateBrandDomainCandidate,
} from '@/tree/brand-domains/readiness';
import {
  registerBrandDomain,
  updateBrandDomainChecks,
  transitionBrandDomainStatus,
  listActiveHostnamesForWorker,
  listBrandDomainAuditEvents,
} from '@/tree/brand-domains/repository';
import type { BrandDomainReadinessChecks } from '@/seed/domain';

function createAllPassingChecks(): BrandDomainReadinessChecks {
  return {
    ownershipVerified: true,
    cfZoneEligible: true,
    workerAttached: true,
    tlsVerified: true,
    authOriginVerified: true,
    accessPolicyVerified: true,
    tenantAuthVerified: true,
    noPublicBypassVerified: true,
    externalCallbacksReviewed: true,
    smokeVerified: true,
  };
}

/** Minimal in-memory D1 mock for brand_domains + brand_domain_audit_events */
function createMockD1(): D1Database {
  const domains = new Map<string, Record<string, unknown>>();
  const events: Record<string, unknown>[] = [];

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first<T>() {
          if (sql.includes('FROM brand_domains WHERE id =')) {
            return (domains.get(String(bound[0])) ?? null) as T;
          }
          if (sql.includes('FROM brand_domains WHERE hostname =')) {
            for (const row of domains.values()) {
              if (row.hostname === bound[0]) return row as T;
            }
            return null as T;
          }
          return null as T;
        },
        async all<T>() {
          if (sql.includes('SELECT hostname FROM brand_domains')) {
            const results = [...domains.values()]
              .filter((r) => r.status === 'ACTIVE' && r.worker_name === bound[0])
              .map((r) => ({ hostname: r.hostname }));
            return { results } as unknown as D1Result<T>;
          }
          if (sql.includes('FROM brand_domain_audit_events')) {
            return { results: events } as unknown as D1Result<T>;
          }
          return { results: [...domains.values()] } as unknown as D1Result<T>;
        },
        async run() {
          const now = new Date().toISOString();
          if (sql.startsWith('INSERT INTO brand_domains')) {
            const [id, hostname, zoneId, workerName, tenantId, isCanonical, authPolicy, createdBy] =
              bound;
            domains.set(String(id), {
              id,
              hostname,
              cloudflare_zone_id: zoneId,
              worker_name: workerName,
              tenant_id: tenantId,
              status: 'PENDING',
              is_canonical: isCanonical,
              auth_policy: authPolicy,
              ownership_verified: 0,
              cf_zone_eligible: 0,
              worker_attached: 0,
              tls_verified: 0,
              auth_origin_verified: 0,
              access_policy_verified: 0,
              tenant_auth_verified: 0,
              no_public_bypass_verified: 0,
              external_callbacks_reviewed: 0,
              smoke_verified: 0,
              created_by: createdBy,
              activated_by: null,
              activated_at: null,
              suspended_at: null,
              created_at: now,
              updated_at: now,
            });
          } else if (sql.startsWith('INSERT INTO brand_domain_audit_events')) {
            const [id, domainId, hostname, action, actorId, actorEmail, detailsJson] = bound;
            events.push({
              id,
              domain_id: domainId,
              hostname,
              action,
              actor_id: actorId,
              actor_email: actorEmail,
              details_json: detailsJson,
              created_at: now,
            });
          } else if (sql.includes('SET ownership_verified =')) {
            const row = domains.get(String(bound[0]));
            if (row) {
              Object.assign(row, {
                ownership_verified: bound[1],
                cf_zone_eligible: bound[2],
                worker_attached: bound[3],
                tls_verified: bound[4],
                auth_origin_verified: bound[5],
                access_policy_verified: bound[6],
                tenant_auth_verified: bound[7],
                no_public_bypass_verified: bound[8],
                external_callbacks_reviewed: bound[9],
                smoke_verified: bound[10],
                updated_at: now,
              });
            }
          } else if (sql.includes("SET status = 'VERIFIED'")) {
            const row = domains.get(String(bound[0]));
            if (row) {
              row.status = 'VERIFIED';
              row.updated_at = now;
            }
          } else if (sql.includes("SET status = 'ACTIVE'")) {
            const row = domains.get(String(bound[0]));
            if (row) {
              row.status = 'ACTIVE';
              row.activated_by = bound[1];
              row.activated_at = now;
              row.suspended_at = null;
              row.updated_at = now;
            }
          } else if (sql.includes("SET status = 'SUSPENDED'")) {
            const row = domains.get(String(bound[0]));
            if (row) {
              row.status = 'SUSPENDED';
              row.suspended_at = now;
              row.updated_at = now;
            }
          }
          return { success: true, meta: { changes: 1 } } as unknown as D1Result;
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

describe('G7/G8 — Brand Domain Registry 10-gate enforcement & lifecycle', () => {
  it('validates candidate brand hostnames and rejects workers.dev, localhost, and wildcards', () => {
    expect(validateBrandDomainCandidate('studio.brand.io').valid).toBe(true);
    expect(validateBrandDomainCandidate('*.brand.io').valid).toBe(false);
    expect(validateBrandDomainCandidate('localhost').valid).toBe(false);
    expect(
      validateBrandDomainCandidate('sophia-ai-factory.agencyos-openclaw.workers.dev').valid,
    ).toBe(false);
  });

  it('requires all 10 readiness gates before activation', () => {
    const emptyEval = evaluateDomainReadiness(EMPTY_READINESS_CHECKS);
    expect(emptyEval.readyToActivate).toBe(false);
    expect(emptyEval.missingChecks).toHaveLength(10);

    const partial = { ...createAllPassingChecks(), smokeVerified: false };
    const partialEval = evaluateDomainReadiness(partial);
    expect(partialEval.readyToActivate).toBe(false);
    expect(partialEval.missingChecks).toEqual(['smokeVerified']);

    const fullEval = evaluateDomainReadiness(createAllPassingChecks());
    expect(fullEval.readyToActivate).toBe(true);
    expect(fullEval.missingChecks).toHaveLength(0);
  });

  it('enforces 10/10 gates on activate, records immutable audit events, and supports rollback', async () => {
    const db = createMockD1();
    const actor = { actorId: 'founder-1', actorEmail: 'founder@sophia.test' };

    const created = await registerBrandDomain(
      db,
      {
        hostname: 'app.acmevideo.com',
        workerName: 'sophia-ai-factory',
        cloudflareZoneId: 'zone-123',
      },
      actor,
    );
    expect(created.status).toBe('PENDING');

    // Attempt activation before 10/10 gates -> must throw
    await expect(
      transitionBrandDomainStatus(db, created.id, 'activate', actor),
    ).rejects.toThrow(/missing gates/);

    // Complete all 10 gates -> activate succeeds
    await updateBrandDomainChecks(db, created.id, createAllPassingChecks(), actor);
    const active = await transitionBrandDomainStatus(db, created.id, 'activate', actor);
    expect(active.status).toBe('ACTIVE');
    expect(active.activatedBy).toBe('founder-1');

    const activeHosts = await listActiveHostnamesForWorker(db, 'sophia-ai-factory');
    expect(activeHosts).toEqual(['app.acmevideo.com']);

    // Rollback suspends domain immediately
    const rolledBack = await transitionBrandDomainStatus(
      db,
      created.id,
      'rollback',
      actor,
      'Emergency cutback',
    );
    expect(rolledBack.status).toBe('SUSPENDED');
    expect(await listActiveHostnamesForWorker(db, 'sophia-ai-factory')).toEqual([]);

    const auditEvents = await listBrandDomainAuditEvents(db, 50);
    expect(auditEvents.length).toBeGreaterThanOrEqual(4);
  });
});
