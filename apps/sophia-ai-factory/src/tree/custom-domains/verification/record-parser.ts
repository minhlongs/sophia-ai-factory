/**
 * @file record-parser.ts
 * @description Cloudflare custom hostname TXT/SSL DCV records parser and status transition evaluator.
 * @layer tree
 */

import type {
  CloudflareCustomHostnameResult,
  VerificationRecord,
  CustomDomainSslStatus,
  CustomDomainVerificationStatus,
} from '@/seed/types/custom-domains';

export function parseOwnershipVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  if (cfResult.ownership_verification?.name && cfResult.ownership_verification?.value) {
    return {
      type: 'txt',
      name: cfResult.ownership_verification.name,
      value: cfResult.ownership_verification.value,
    };
  }
  return null;
}

export function parseSslDcvVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  const ssl = cfResult.ssl;
  if (!ssl) return null;

  // 1. Check validation_records array (most complete source from Cloudflare)
  if (ssl.validation_records && ssl.validation_records.length > 0) {
    const record = ssl.validation_records[0];
    if (record.txt_name && record.txt_value) {
      return { type: 'txt', name: record.txt_name, value: record.txt_value };
    }
    if (record.cname_name && record.cname_target) {
      return { type: 'cname', name: record.cname_name, value: record.cname_target };
    }
  }

  // 2. Fallback to top-level txt properties
  if (ssl.txt_name && ssl.txt_value) {
    return { type: 'txt', name: ssl.txt_name, value: ssl.txt_value };
  }

  return null;
}

export function parseVerificationErrors(
  cfResult: CloudflareCustomHostnameResult,
): string[] {
  const errors: string[] = [];
  if (Array.isArray(cfResult.verification_errors)) {
    for (const err of cfResult.verification_errors) {
      if (typeof err === 'string' && err.trim()) errors.push(err.trim());
    }
  }
  return errors;
}

export function evaluateStatusTransitions(
  cfResult: CloudflareCustomHostnameResult,
): {
  sslStatus: CustomDomainSslStatus;
  verificationStatus: CustomDomainVerificationStatus;
  cnameVerified: boolean;
  active: boolean;
  errors: string[];
} {
  const errors = parseVerificationErrors(cfResult);
  const rawSslStatus = cfResult.ssl?.status;
  const cfHostStatus = cfResult.status;

  let sslStatus: CustomDomainSslStatus = 'pending_validation';
  let verificationStatus: CustomDomainVerificationStatus = 'pending';
  let cnameVerified = cfHostStatus === 'active';
  let active = false;

  if (cfHostStatus === 'blocked' || rawSslStatus === 'error' || rawSslStatus === 'timed_out' || rawSslStatus === 'revoked') {
    sslStatus = rawSslStatus === 'revoked' ? 'revoked' : 'error';
    verificationStatus = rawSslStatus === 'revoked' ? 'revoked' : 'failed';
    if (errors.length === 0) {
      errors.push(
        cfHostStatus === 'blocked'
          ? 'Hostname is blocked by Cloudflare'
          : `SSL validation failed with status: ${rawSslStatus}`
      );
    }
  } else if (rawSslStatus === 'active' && cfHostStatus === 'active') {
    sslStatus = 'active';
    verificationStatus = 'active';
    cnameVerified = true;
    active = true;
  } else if (rawSslStatus === 'pending_deployment') {
    sslStatus = 'pending_deployment';
    verificationStatus = 'verified';
  } else {
    sslStatus = 'pending_validation';
    verificationStatus = 'pending';
  }

  return {
    sslStatus,
    verificationStatus,
    cnameVerified,
    active,
    errors,
  };
}
