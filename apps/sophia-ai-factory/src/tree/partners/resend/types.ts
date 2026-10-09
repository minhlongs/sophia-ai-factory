/**
 * Resend Domain Types & Interfaces
 *
 * @module tree/partners/resend/types
 */

export interface ResendDnsRecord {
  record: 'SPF' | 'DKIM';
  name: string;
  type: 'TXT' | 'MX' | 'CNAME';
  value: string;
  priority?: number;
  status: 'pending' | 'verified' | 'failed';
}

export interface ProvisionResendDomainOptions {
  apiKey?: string;
  region?: 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1';
  fetchMock?: typeof fetch;
}

export interface ProvisionResendDomainInput {
  domainName: string;
  apiKey?: string;
  mockDns?: boolean;
  region?: 'us-east-1' | 'eu-west-1' | 'sa-east-1' | 'ap-northeast-1';
}

export interface ProvisionResendDomainResult {
  success: boolean;
  domainId: string;
  domainName: string;
  status: 'not_started' | 'pending' | 'verified' | 'failed';
  region: string;
  records: ResendDnsRecord[];
  dnsRecords: ResendDnsRecord[];
  dkimRecord?: ResendDnsRecord;
  spfMxRecord?: ResendDnsRecord;
  spfTxtRecord?: ResendDnsRecord;
  error?: string;
}

export interface VerifyResendDomainOptions {
  apiKey?: string;
  fetchMock?: typeof fetch;
  mockRecords?: ResendDnsRecord[];
  forceSuccess?: boolean;
}

export interface VerifyResendDomainResult {
  success: boolean;
  domainId: string;
  domainName?: string;
  status: 'pending' | 'verified' | 'failed';
  isVerified: boolean;
  dkimStatus: 'pending' | 'verified' | 'failed';
  spfStatus: 'pending' | 'verified' | 'failed';
  records: ResendDnsRecord[];
  error?: string;
}

export interface AgencyEmailSenderConfig {
  agencyName?: string;
  brandName?: string;
  senderName?: string;
  senderEmail?: string;
  customEmailSender?: string | null;
  customDomain?: string | null;
  domainName?: string | null;
}
