/**
 * @file domain-row-mapper.ts
 * @description Mappers converting raw D1 SQLite rows to typed CustomDomainRecord domain entities.
 * @layer tree
 */

import type {
  CustomDomainRecord,
  CustomDomainRow,
  CustomDomainSslStatus,
  CustomDomainVerificationStatus,
  VerificationRecord,
} from '@/seed/types/custom-domains';
import { DEFAULT_CNAME_TARGET } from './types';

export function mapRowToCustomDomainRecord(row: CustomDomainRow): CustomDomainRecord {
  let verificationErrors: string[] = [];
  try {
    verificationErrors = JSON.parse(row.verification_errors || '[]');
  } catch {
    verificationErrors = [];
  }

  let ownershipVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ownership_verification || '{}');
    if (parsed && parsed.name && parsed.value) ownershipVerification = parsed;
  } catch {
    ownershipVerification = null;
  }

  let sslVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ssl_verification || '{}');
    if (parsed && parsed.name && parsed.value) sslVerification = parsed;
  } catch {
    sslVerification = null;
  }

  return {
    id: row.id,
    org_id: row.org_id,
    hostname: row.hostname,
    cf_custom_hostname_id: row.cf_custom_hostname_id,
    ssl_status: row.ssl_status as CustomDomainSslStatus,
    verification_status: (row.verification_status as CustomDomainVerificationStatus) ?? 'pending',
    verification_errors: verificationErrors,
    ownership_verification: ownershipVerification,
    ssl_verification: sslVerification,
    cname_target: row.cname_target || DEFAULT_CNAME_TARGET,
    cname_verified: row.cname_verified === 1,
    active: row.active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
