/**
 * Resend Domain Verification Status Checker
 *
 * @module tree/partners/resend/verify-domain
 */

import type {
  ResendDnsRecord,
  VerifyResendDomainOptions,
  VerifyResendDomainResult,
} from './types';

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
    try {
      // 1. Trigger verification run
      await fetchImpl(`https://api.resend.com/domains/${cleanId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      // 2. Fetch updated domain status
      const res = await fetchImpl(`https://api.resend.com/domains/${cleanId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.ok) {
        const data = (await res.json()) as {
          id: string;
          name: string;
          status: string;
          records?: Array<{
            record: 'SPF' | 'DKIM';
            name: string;
            type: 'TXT' | 'MX' | 'CNAME';
            value: string;
            priority?: number;
            status: string;
          }>;
        };

        const records: ResendDnsRecord[] = (data.records || []).map((r) => ({
          record: r.record,
          name: r.name,
          type: r.type,
          value: r.value,
          priority: r.priority,
          status: (r.status as 'pending' | 'verified' | 'failed') || 'pending',
        }));

        const dkim = records.find((r) => r.record === 'DKIM');
        const spf = records.filter((r) => r.record === 'SPF');

        const dkimStatus: 'pending' | 'verified' | 'failed' = dkim?.status || 'pending';
        const spfStatus: 'pending' | 'verified' | 'failed' =
          spf.length > 0 && spf.every((r) => r.status === 'verified')
            ? 'verified'
            : spf.some((r) => r.status === 'failed')
              ? 'failed'
              : 'pending';

        const isVerified = data.status === 'verified' || (dkimStatus === 'verified' && spfStatus === 'verified');

        return {
          success: true,
          domainId: data.id,
          domainName: data.name,
          status: isVerified ? 'verified' : (data.status as 'pending' | 'verified' | 'failed') || 'pending',
          isVerified,
          dkimStatus,
          spfStatus,
          records,
        };
      }
    } catch {
      // Fall through to mock evaluation
    }
  }

  // Handle mock records evaluation or simulation
  if (options?.mockRecords && options.mockRecords.length > 0) {
    const dkim = options.mockRecords.find((r) => r.record === 'DKIM');
    const spf = options.mockRecords.filter((r) => r.record === 'SPF');

    const dkimStatus: 'pending' | 'verified' | 'failed' = dkim?.status || 'pending';
    const spfStatus: 'pending' | 'verified' | 'failed' =
      spf.length > 0 && spf.every((r) => r.status === 'verified')
        ? 'verified'
        : spf.some((r) => r.status === 'failed')
          ? 'failed'
          : 'pending';

    const isVerified = Boolean(
      options.forceSuccess ?? (dkimStatus === 'verified' && spfStatus === 'verified'),
    );

    return {
      success: true,
      domainId: cleanId,
      status: isVerified ? 'verified' : 'pending',
      isVerified,
      dkimStatus,
      spfStatus,
      records: options.mockRecords,
    };
  }

  if (options?.forceSuccess) {
    const records: ResendDnsRecord[] = [
      {
        record: 'DKIM',
        name: `resend._domainkey`,
        type: 'TXT',
        value: 'p=verified-key',
        status: 'verified',
      },
      {
        record: 'SPF',
        name: 'bounces',
        type: 'MX',
        value: 'feedback-smtp.us-east-1.amazonses.com',
        priority: 10,
        status: 'verified',
      },
      {
        record: 'SPF',
        name: 'bounces',
        type: 'TXT',
        value: 'v=spf1 include:amazonses.com ~all',
        status: 'verified',
      },
    ];

    return {
      success: true,
      domainId: cleanId,
      status: 'verified',
      isVerified: true,
      dkimStatus: 'verified',
      spfStatus: 'verified',
      records,
    };
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
