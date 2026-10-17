/**
 * Resend Domain Verification Status Checker
 *
 * @module tree/partners/resend/verify-domain
 */

import type {
  VerifyResendDomainOptions,
  VerifyResendDomainResult,
} from './types';
import {
  computeDkimAndSpfStatus,
  fetchResendDomainVerification,
  buildForceSuccessResult,
  evaluateMockRecordsResult,
} from './verify-domain-helpers';

export {
  computeDkimAndSpfStatus,
  fetchResendDomainVerification,
  buildForceSuccessResult,
  evaluateMockRecordsResult,
};

/**
 * Verifies the DNS verification status of a provisioned Resend domain.
 */
export async function verifyResendDomainStatus(
  domainId: string,
  options?: VerifyResendDomainOptions,
): Promise<VerifyResendDomainResult> {
  const cleanId = (domainId || '').trim();
  if (!cleanId) {
    return {
      success: false,
      domainId: '',
      status: 'failed',
      isVerified: false,
      dkimStatus: 'failed',
      spfStatus: 'failed',
      records: [],
      error: 'DOMAIN_ID_REQUIRED: Missing domainId',
    };
  }

  const apiKey = options?.apiKey || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  const fetchImpl = options?.fetchMock || globalThis.fetch;

  if (apiKey && typeof fetchImpl === 'function') {
    const apiResult = await fetchResendDomainVerification(cleanId, apiKey, fetchImpl);
    if (apiResult) {
      return apiResult;
    }
  }

  // Handle mock records evaluation or simulation
  if (options?.mockRecords && options.mockRecords.length > 0) {
    return evaluateMockRecordsResult(cleanId, options);
  }

  if (options?.forceSuccess) {
    return buildForceSuccessResult(cleanId);
  }

  // Default pending state
  return {
    success: true,
    domainId: cleanId,
    status: 'pending',
    isVerified: false,
    dkimStatus: 'pending',
    spfStatus: 'pending',
    records: [],
  };
}
