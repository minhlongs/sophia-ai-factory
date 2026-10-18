/**
 * Resend Domain Provisioning Helpers
 *
 * @module tree/partners/resend/provision-domain-helpers
 */

import type {
  ResendDnsRecord,
  ProvisionResendDomainResult,
} from './types';
import { generateDkimPublicKey } from './domain-validator';

export type ResendRegion = 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1';

export async function requestResendDomainApi(
  cleanDomain: string,
  region: ResendRegion,
  apiKey: string,
  fetchImpl: typeof globalThis.fetch,
): Promise<ProvisionResendDomainResult | null> {
  try {
    const res = await fetchImpl('https://api.resend.com/domains', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: cleanDomain, region }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      id: string;
      name: string;
      status: string;
      region?: string;
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
    const spfMx = records.find((r) => r.record === 'SPF' && r.type === 'MX');
    const spfTxt = records.find((r) => r.record === 'SPF' && r.type === 'TXT');

    return {
      success: true,
      domainId: data.id,
      domainName: data.name,
      status: (data.status as 'not_started' | 'pending' | 'verified' | 'failed') || 'pending',
      region: (data.region as ResendRegion) || region,
      records,
      dnsRecords: records,
      dkimRecord: dkim,
      spfMxRecord: spfMx,
      spfTxtRecord: spfTxt,
    };
  } catch {
    return null;
  }
}

export function buildDeterministicDomainRecords(
  cleanDomain: string,
  region: ResendRegion,
): ProvisionResendDomainResult {
  const domainId = `resend_dom_${cleanDomain.replace(/[^a-z0-9]/g, '_').slice(0, 24)}`;
  const dkimRecord: ResendDnsRecord = {
    record: 'DKIM',
    name: `resend._domainkey.${cleanDomain}`,
    type: 'TXT',
    value: `p=${generateDkimPublicKey(cleanDomain)}`,
    status: 'pending',
  };

  const spfMxRecord: ResendDnsRecord = {
    record: 'SPF',
    name: `bounces.${cleanDomain}`,
    type: 'MX',
    value: `feedback-smtp.${region}.amazonses.com`,
    priority: 10,
    status: 'pending',
  };

  const spfTxtRecord: ResendDnsRecord = {
    record: 'SPF',
    name: `bounces.${cleanDomain}`,
    type: 'TXT',
    value: 'v=spf1 include:amazonses.com ~all',
    status: 'pending',
  };

  const records: ResendDnsRecord[] = [dkimRecord, spfMxRecord, spfTxtRecord];

  return {
    success: true,
    domainId,
    domainName: cleanDomain,
    status: 'pending',
    region,
    records,
    dnsRecords: records,
    dkimRecord,
    spfMxRecord,
    spfTxtRecord,
  };
}
