/**
 * Resend Domain Provisioning
 *
 * @module tree/partners/resend/provision-domain
 */

import type {
  ProvisionResendDomainInput,
  ProvisionResendDomainOptions,
  ProvisionResendDomainResult,
} from './types';
import { isValidDomainName } from './domain-validator';
import {
  type ResendRegion,
  requestResendDomainApi,
  buildDeterministicDomainRecords,
} from './provision-domain-helpers';

/**
 * Provisions a custom email sending domain with Resend.
 * Generates required DKIM and SPF DNS records for agency domain authentication.
 */
export async function provisionResendDomain(
  domainInput: string | ProvisionResendDomainInput,
  options?: ProvisionResendDomainOptions,
): Promise<ProvisionResendDomainResult> {
  let domainName = '';
  let apiKey = options?.apiKey;
  let region: ResendRegion = options?.region || 'us-east-1';

  if (typeof domainInput === 'string') {
    domainName = domainInput;
  } else if (domainInput && typeof domainInput === 'object') {
    domainName = domainInput.domainName;
    if (domainInput.apiKey) apiKey = domainInput.apiKey;
    if (domainInput.region) region = domainInput.region;
  }

  const cleanDomain = (domainName || '').trim().toLowerCase();

  if (!isValidDomainName(cleanDomain)) {
    return {
      success: false,
      domainId: '',
      domainName: cleanDomain,
      status: 'failed',
      region,
      records: [],
      dnsRecords: [],
      error: `INVALID_DOMAIN_NAME: '${cleanDomain}' is not a valid fully qualified domain name`,
    };
  }

  apiKey = apiKey || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  const fetchImpl = options?.fetchMock || globalThis.fetch;

  if (apiKey && typeof fetchImpl === 'function') {
    const apiResult = await requestResendDomainApi(cleanDomain, region, apiKey, fetchImpl);
    if (apiResult) {
      return apiResult;
    }
  }

  return buildDeterministicDomainRecords(cleanDomain, region);
}
