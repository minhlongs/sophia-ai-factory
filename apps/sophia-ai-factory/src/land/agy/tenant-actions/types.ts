/**
 * Agency Tenant Server Action Input Types
 *
 * @module land/agy/tenant-actions/types
 */

export interface RegisterAgencyInput {
  orgId: string;
  agencySlug: string;
  customDomain?: string | null;
  quotaLimitMcu?: number;
  rateLimitRps?: number;
  actorId?: string;
}

export interface RegisterDomainInput {
  agencyId: string;
  domain: string;
  domainType?: 'subdomain' | 'custom';
  isPrimary?: boolean;
  actorId?: string;
}

export interface IssueTokenInput {
  agencyId: string;
  name: string;
  permissions?: string[];
  expiresInSeconds?: number;
  actorId?: string;
}
