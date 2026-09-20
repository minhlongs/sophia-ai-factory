/**
 * Custom domain and Cloudflare for SaaS verification type definitions.
 *
 * Layer: seed (Foundational primitives)
 * Dependencies: seed/types/result
 */

export type CustomDomainSslStatus =
  | 'pending_validation'
  | 'pending_deployment'
  | 'active'
  | 'error'
  | 'revoked';

export type CustomDomainVerificationStatus =
  | 'pending'
  | 'verified'
  | 'active'
  | 'failed'
  | 'revoked';

export interface VerificationRecord {
  type: 'txt' | 'cname' | 'http';
  name: string;
  value: string;
}

export interface CustomDomainRecord {
  id: string;
  org_id: string;
  hostname: string;
  cf_custom_hostname_id: string | null;
  ssl_status: CustomDomainSslStatus;
  verification_status: CustomDomainVerificationStatus;
  verification_errors: string[];
  ownership_verification: VerificationRecord | null;
  ssl_verification: VerificationRecord | null;
  cname_target: string;
  cname_verified: boolean;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CustomDomainRow {
  id: string;
  org_id: string;
  hostname: string;
  cf_custom_hostname_id: string | null;
  ssl_status: string;
  verification_status?: string;
  verification_errors: string;
  ownership_verification: string;
  ssl_verification: string;
  cname_target: string;
  cname_verified: number;
  active: number;
  created_at: number;
  updated_at: number;
}

export interface DomainVerificationResult {
  domainId: string;
  hostname: string;
  sslStatus: CustomDomainSslStatus;
  verificationStatus: CustomDomainVerificationStatus;
  cnameVerified: boolean;
  active: boolean;
  ownershipVerification: VerificationRecord | null;
  sslVerification: VerificationRecord | null;
  errors: string[];
  cnameTarget: string;
}

export type CustomDomainErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_HOSTNAME'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'CLOUDFLARE_ERROR'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL';

export interface CustomDomainError {
  code: CustomDomainErrorCode;
  message: string;
  details?: unknown;
}

export interface CloudflareSslValidationRecord {
  status?: string;
  txt_name?: string;
  txt_value?: string;
  http_url?: string;
  http_body?: string;
  cname_name?: string;
  cname_target?: string;
}

export interface CloudflareCustomHostnameResult {
  id: string;
  hostname: string;
  status: 'pending' | 'active' | 'blocked' | 'moved';
  verification_errors?: string[];
  ownership_verification?: {
    type: 'txt';
    name: string;
    value: string;
  };
  ssl: {
    id?: string;
    type?: string;
    method?: 'txt' | 'http' | 'cname';
    status: 'pending_validation' | 'pending_deployment' | 'active' | 'error' | 'timed_out' | 'revoked';
    txt_name?: string;
    txt_value?: string;
    validation_records?: CloudflareSslValidationRecord[];
    settings?: {
      min_tls_version?: string;
      http2?: string;
    };
  };
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
  result: T;
}
