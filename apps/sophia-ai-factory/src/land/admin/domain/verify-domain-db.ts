/**
 * D1 persistence helpers for custom domain verification and deletion.
 *
 * @module land/admin/domain/verify-domain-db
 */

import type { DomainVerificationResult } from '@/seed/types/custom-domains';
import {
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
  type getCustomDomainById,
} from '@/tree/custom-domains/verification-service';

type CustomDomainRow = NonNullable<Awaited<ReturnType<typeof getCustomDomainById>>>;
type CfHostnamePayload = Parameters<typeof parseOwnershipVerification>[0];

export async function persistVerifiedDomainState(
  db: D1Database,
  orgId: string,
  domainId: string,
  domain: CustomDomainRow,
  cfData: CfHostnamePayload,
): Promise<DomainVerificationResult> {
  const ownership = parseOwnershipVerification(cfData);
  const sslDcv = parseSslDcvVerification(cfData);
  const { sslStatus, verificationStatus, cnameVerified, active, errors } =
    evaluateStatusTransitions(cfData);

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
      WHERE id = ?9 AND org_id = ?10`,
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
      orgId,
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

export async function removeCustomDomainRow(
  db: D1Database,
  domainId: string,
  orgId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM custom_domains WHERE id = ?1 AND org_id = ?2')
    .bind(domainId, orgId)
    .run();
}
