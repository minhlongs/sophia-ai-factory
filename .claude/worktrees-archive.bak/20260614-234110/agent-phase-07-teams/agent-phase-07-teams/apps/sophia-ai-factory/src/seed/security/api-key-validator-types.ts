/**
 * Types for API Key Validator
 * @module security/api-key-validator-types
 */

export interface ApiKeyRow {
  id: string;
  org_id: string;
  name: string | null;
  key_hash: string;
  key_prefix: string;
  permissions: string[] | string;
  rate_limit_per_minute: number | null;
  is_active: number;
  last_used_at: number | null;
  expires_at: number | null;
  created_at: string;
}

export interface ApiKeyInfo {
  id: string;
  keyId: string;
  keyPrefix: string;
  orgId: string;
  ownerId: string;
  permissions: string[];
  createdAt: number | string;
  expiresAt?: number;
  lastUsedAt?: number;
  rateLimitPerMinute: number;
  isActive: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: 'missing-key' | 'invalid-format' | 'expired' | 'revoked' | 'rate-limited' | 'not-found';
  apiKey?: ApiKeyInfo;
}

export interface GenerateApiKeyResult {
  apiKey: string;
  keyId: string;
  keyPrefix: string;
}
