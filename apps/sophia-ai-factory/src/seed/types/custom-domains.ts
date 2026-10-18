/**
 * Custom domain and Cloudflare for SaaS verification type definitions.
 *
 * Layer: seed (Foundational primitives)
 * Dependencies: seed/types/result
 */

export type {
  CloudflareSslValidationRecord,
  CloudflareCustomHostnameResult,
  CloudflareApiResponse,
  WhiteLabelBrandingSettings,
  SaveWhiteLabelBrandingInput,
  WhiteLabelActionError,
} from './custom-domains-cloudflare';

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
