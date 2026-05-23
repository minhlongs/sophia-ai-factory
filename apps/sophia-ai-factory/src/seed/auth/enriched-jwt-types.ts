/**
 * Types for Enriched JWT
 * @module auth/enriched-jwt-types
 */

 
import type { QuotaLimit } from '@/seed/types/quota-limit'

export interface FeatureLimit {
  daily_limit?: number;
  monthly_limit?: number;
  max_tokens?: number;
}

export interface EnrichedJwtPayload {
  sub: string;
  iat: number;
  exp: number;
  jti?: string;
  license_nonce: string;
  license_tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  license_issued_at: number;
  license_expires_at?: number;
  quota: QuotaLimit;
  agency_id?: string;
  billing_status?: 'active' | 'past_due' | 'suspended';
  is_paid?: boolean;
  overage_allowed?: boolean;
  dunning_state?: 'ok' | 'grace_period' | 'suspended' | 'delinquent';
  feature_entitlements: string[];
  feature_limits: Record<string, FeatureLimit>;
  permissions?: string[];
}

export type EnrichedJwtClaims = EnrichedJwtPayload

export interface LicenseContext {
  tier: string;
  agencyId?: string;
  expiresAt?: number;
  createdAt: number;
}
