/**
 * Domain Independence Types
 * Layer: seed
 *
 * Explicit boundary between:
 * 1. TECHNICAL_RUNTIME_IDENTITY — Worker name, account, SHA, technical workers.dev URL
 * 2. PUBLIC_REQUEST_ORIGIN — Validated HTTPS origin of an incoming request
 * 3. BRAND_DOMAIN_IDENTITY — Controlled future brand domain lifecycle & readiness
 *
 * @module seed/domain/types
 */

export type BrandDomainStatus = 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED';

export type OriginResolutionSource =
  | 'technical'
  | 'env-allowlist'
  | 'brand-registry'
  | 'local-dev';

export interface TechnicalRuntimeIdentity {
  readonly workerName: string;
  readonly accountId: string;
  readonly accountSubdomain: string;
  readonly technicalHostname: string;
  readonly technicalOrigin: string;
  readonly deploymentSha: string | null;
  readonly environment: 'production' | 'pilot' | 'development';
}

export interface PublicRequestOrigin {
  readonly origin: string;
  readonly hostname: string;
  readonly protocol: 'https:' | 'http:';
  readonly source: OriginResolutionSource;
}

export interface BrandDomainReadinessChecks {
  readonly ownershipVerified: boolean;
  readonly cfZoneEligible: boolean;
  readonly workerAttached: boolean;
  readonly tlsVerified: boolean;
  readonly authOriginVerified: boolean;
  readonly accessPolicyVerified: boolean;
  readonly tenantAuthVerified: boolean;
  readonly noPublicBypassVerified: boolean;
  readonly externalCallbacksReviewed: boolean;
  readonly smokeVerified: boolean;
}

export interface BrandDomainIdentity {
  readonly id: string;
  readonly hostname: string;
  readonly cloudflareZoneId: string | null;
  readonly workerName: string;
  readonly tenantId: string | null;
  readonly status: BrandDomainStatus;
  readonly isCanonical: boolean;
  readonly authPolicy: string;
  readonly checks: BrandDomainReadinessChecks;
  readonly createdBy: string;
  readonly activatedBy: string | null;
  readonly activatedAt: string | null;
  readonly suspendedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type BrandDomainAuditAction =
  | 'REGISTERED'
  | 'CHECKS_UPDATED'
  | 'VERIFIED'
  | 'ACTIVATED'
  | 'SUSPENDED'
  | 'ROLLED_BACK';

export interface BrandDomainAuditEvent {
  readonly id: string;
  readonly domainId: string;
  readonly hostname: string;
  readonly action: BrandDomainAuditAction;
  readonly actorId: string;
  readonly actorEmail: string | null;
  readonly detailsJson: string;
  readonly createdAt: string;
}

export type DomainEnvLike = Readonly<Record<string, string | undefined>>;
