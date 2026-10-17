/**
 * @file domain-repository.ts
 * @description Cloudflare custom domain D1 persistence, lifecycle transitions, and queries.
 * @layer tree
 */

import type {
  CustomDomainRecord,
  CustomDomainRow,
} from '@/seed/types/custom-domains';
import { DEFAULT_CNAME_TARGET } from './types';
import {
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
} from './record-parser';
import { createCloudflareCustomHostname } from './cloudflare-saas-client';
import { mapRowToCustomDomainRecord } from './domain-row-mapper';
import { verifyCustomDomainStatus } from './domain-status-verifier';

export { mapRowToCustomDomainRecord, verifyCustomDomainStatus };

export async function getCustomDomainById(
  db: D1Database,
  id: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function getCustomDomainByHostname(
  db: D1Database,
  hostname: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE hostname = ?1 LIMIT 1')
    .bind(hostname.toLowerCase())
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function listCustomDomainsByOrg(
  db: D1Database,
  orgId: string,
): Promise<CustomDomainRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM custom_domains WHERE org_id = ?1 ORDER BY created_at DESC')
    .bind(orgId)
    .all<CustomDomainRow>();

  return (results ?? []).map(mapRowToCustomDomainRecord);
}

export async function registerCustomDomain(
  db: D1Database,
  orgId: string,
  hostname: string,
): Promise<CustomDomainRecord> {
  const normalized = hostname.trim().toLowerCase();

  const cfRes = await createCloudflareCustomHostname(normalized);
  if (!cfRes.ok) {
    throw new Error(`Cloudflare custom hostname creation failed: ${cfRes.error.message}`);
  }

  const cfData = cfRes.value;
  const ownership = parseOwnershipVerification(cfData);
  const sslDcv = parseSslDcvVerification(cfData);
  const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

  const domainId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO custom_domains (
        id, org_id, hostname, cf_custom_hostname_id, ssl_status, verification_status,
        verification_errors, ownership_verification, ssl_verification,
        cname_target, cname_verified, active, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      domainId,
      orgId,
      normalized,
      cfData.id,
      sslStatus,
      verificationStatus,
      JSON.stringify(errors),
      JSON.stringify(ownership ?? {}),
      JSON.stringify(sslDcv ?? {}),
      DEFAULT_CNAME_TARGET,
      cnameVerified ? 1 : 0,
      active ? 1 : 0,
      now,
      now,
    )
    .run();

  const created = await getCustomDomainById(db, domainId);
  if (!created) {
    throw new Error('Failed to retrieve newly inserted custom domain');
  }

  return created;
}
