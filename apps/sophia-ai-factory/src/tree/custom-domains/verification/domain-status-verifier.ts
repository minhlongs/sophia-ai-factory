/**
 * @file domain-status-verifier.ts
 * @description Cloudflare custom domain verification status check and D1 update.
 * @layer tree
 */

import type {
  CustomDomainRow,
  DomainVerificationResult,
} from '@/seed/types/custom-domains';
import {
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
} from './record-parser';
import { fetchCloudflareCustomHostname } from './cloudflare-saas-client';
import { mapRowToCustomDomainRecord } from './domain-row-mapper';

export async function verifyCustomDomainStatus(
  db: D1Database,
  domainId: string,
): Promise<DomainVerificationResult> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE id = ?1 LIMIT 1')
    .bind(domainId)
    .first<CustomDomainRow>();

  const domain = row ? mapRowToCustomDomainRecord(row) : null;
  if (!domain) {
    throw new Error(`Custom domain not found: ${domainId}`);
  }

  if (!domain.cf_custom_hostname_id) {
    throw new Error(`Custom domain ${domainId} missing Cloudflare Custom Hostname ID`);
  }

  const cfRes = await fetchCloudflareCustomHostname(domain.cf_custom_hostname_id, domain.hostname);
  if (!cfRes.ok) {
    throw new Error(`Cloudflare status check failed: ${cfRes.error.message}`);
  }

  const cfData = cfRes.value;
  const ownership = parseOwnershipVerification(cfData);
  const sslDcv = parseSslDcvVerification(cfData);
  const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE custom_domains SET
        ssl_status = ?1,
        verification_status = ?2,
        verification_errors = ?3,
        ownership_verification = ?4,
        ssl_verification = ?5,
        cname_verified = ?6,
        active = ?7,
        updated_at = ?8
      WHERE id = ?9`,
    )
    .bind(
      sslStatus,
      verificationStatus,
      JSON.stringify(errors),
      JSON.stringify(ownership ?? {}),
      JSON.stringify(sslDcv ?? {}),
      cnameVerified ? 1 : 0,
      active ? 1 : 0,
      now,
      domainId,
    )
    .run();

  return {
    domainId,
    hostname: domain.hostname,
    sslStatus,
    verificationStatus,
    cnameVerified,
    active,
    ownershipVerification: ownership,
    sslVerification: sslDcv,
    errors,
    cnameTarget: domain.cname_target,
  };
}
