/**
 * Resend Domain Verification Helpers (API Fetch & Mock Evaluation)
 *
 * @module tree/partners/resend/verify-domain-helpers
 */

import type {
  ResendDnsRecord,
  VerifyResendDomainOptions,
  VerifyResendDomainResult,
} from './types';

export function computeDkimAndSpfStatus(records: ResendDnsRecord[]): {
  dkimStatus: 'pending' | 'verified' | 'failed';
  spfStatus: 'pending' | 'verified' | 'failed';
} {
  const dkim = records.find((r) => r.record === 'DKIM');
  const spf = records.filter((r) => r.record === 'SPF');

  const dkimStatus: 'pending' | 'verified' | 'failed' = dkim?.status || 'pending';
  const spfStatus: 'pending' | 'verified' | 'failed' =
    spf.length > 0 && spf.every((r) => r.status === 'verified')
      ? 'verified'
      : spf.some((r) => r.status === 'failed')
        ? 'failed'
        : 'pending';

  return { dkimStatus, spfStatus };
}

export async function fetchResendDomainVerification(
  cleanId: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<VerifyResendDomainResult | null> {
  try {
    await fetchImpl(`https://api.resend.com/domains/${cleanId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

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

      const { dkimStatus, spfStatus } = computeDkimAndSpfStatus(records);
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
  return null;
}

export function buildForceSuccessResult(cleanId: string): VerifyResendDomainResult {
  const records: ResendDnsRecord[] = [
    { record: 'DKIM', name: 'resend._domainkey', type: 'TXT', value: 'p=verified-key', status: 'verified' },
    {
      record: 'SPF', name: 'bounces', type: 'MX',
      value: 'feedback-smtp.us-east-1.amazonses.com', priority: 10, status: 'verified',
    },
    {
      record: 'SPF', name: 'bounces', type: 'TXT',
      value: 'v=spf1 include:amazonses.com ~all', status: 'verified',
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

export function evaluateMockRecordsResult(
  cleanId: string,
  options: VerifyResendDomainOptions,
): VerifyResendDomainResult {
  const { dkimStatus, spfStatus } = computeDkimAndSpfStatus(options.mockRecords ?? []);
  const isVerified = Boolean(options.forceSuccess ?? (dkimStatus === 'verified' && spfStatus === 'verified'));

  return {
    success: true,
    domainId: cleanId,
    status: isVerified ? 'verified' : 'pending',
    isVerified,
    dkimStatus,
    spfStatus,
    records: options.mockRecords ?? [],
  };
}
