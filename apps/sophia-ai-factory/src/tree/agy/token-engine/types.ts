/**
 * Tenant Token Types
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/agy/token-engine/types
 */

import type { AgyTenantToken } from '@/seed/types/agy-multitenancy';

export interface TenantTokenPayload {
  agencyId: string;
  name: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number | null;
  nonce: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  payload?: TenantTokenPayload;
  reason?: string;
  errorCode?: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'EXPIRED' | 'CORRUPTED_PAYLOAD';
}

export interface GenerateTokenParams {
  agencyId: string;
  name?: string;
  permissions?: string[];
  expiresInSeconds?: number | null;
}

export interface GeneratedTokenResult {
  token: string;
  tokenHash: string;
  payload: TenantTokenPayload;
  model: AgyTenantToken;
}

export const TOKEN_PREFIX = 'agy_tok_';
