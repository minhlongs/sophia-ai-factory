/**
 * Enterprise Multi-Org SAML/OIDC SSO Types & Contracts
 *
 * Layer: seed/types (Foundational - 0 dependencies)
 *
 * @module seed/types/enterprise-sso
 */

export type EnterpriseSsoProviderType = 'saml' | 'oidc';

export interface EnterpriseSsoConfig {
  id: string;
  orgId: string;
  domain: string; // e.g. "acme.com"
  providerType: EnterpriseSsoProviderType;
  issuer: string;
  clientId: string;
  clientSecretEncrypted?: string | null;
  metadataUrl?: string | null;
  ssoUrl?: string | null;
  certificate?: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseSsoRow {
  id: string;
  org_id: string;
  domain: string;
  provider_type: string;
  issuer: string;
  client_id: string;
  client_secret_encrypted: string | null;
  metadata_url: string | null;
  sso_url: string | null;
  certificate: string | null;
  enabled: number; // 0 | 1 in SQLite
  created_at: number;
  updated_at: number;
}

export interface CreateEnterpriseSsoInput {
  orgId: string;
  domain: string;
  providerType: EnterpriseSsoProviderType;
  issuer: string;
  clientId: string;
  clientSecret?: string | null;
  metadataUrl?: string | null;
  ssoUrl?: string | null;
  certificate?: string | null;
  enabled?: boolean;
}

export interface UpdateEnterpriseSsoInput {
  domain?: string;
  providerType?: EnterpriseSsoProviderType;
  issuer?: string;
  clientId?: string;
  clientSecret?: string | null;
  metadataUrl?: string | null;
  ssoUrl?: string | null;
  certificate?: string | null;
  enabled?: boolean;
}

export interface IdpRoutingMetadata {
  domain: string;
  providerType: EnterpriseSsoProviderType;
  issuer: string;
  ssoUrl: string;
  orgId: string;
  orgName?: string;
}

export interface SsoActionError {
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'INVALID_DOMAIN'
    | 'DOMAIN_CONFLICT'
    | 'CONFIG_NOT_FOUND'
    | 'VALIDATION_FAILED'
    | 'INTERNAL_ERROR';
  message: string;
}
