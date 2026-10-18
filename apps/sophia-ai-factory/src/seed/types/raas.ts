/**
 * RaaS Domain Types
 *
 * Database row types for RaaS license management, API keys, audit logs.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/raas
 */

import type { Json } from './json'

// RaaS License keys
export interface RaasLicenseRow {
  id: string;
  key_hash: string;
  tier: string;
  expires_at: number | null;
  nonce: string;
  is_revoked: boolean;
  revoked_at: number | null;
  revoked_by: string | null;
  created_by: string | null;
  user_id: string | null;
  created_at: number;
  metadata: Json;
  updated_at: number | null;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
}

export interface RaasLicenseInsert {
  key_hash: string;
  tier: string;
  expires_at?: number | null;
  nonce: string;
  is_revoked?: boolean;
  revoked_at?: number | null;
  revoked_by?: string | null;
  created_by?: string | null;
  created_at?: number;
  metadata?: Json;
}

export interface RaasLicenseUpdate {
  tier?: string;
  expires_at?: number | null;
  is_revoked?: boolean;
  revoked_at?: number | null;
  revoked_by?: string | null;
  metadata?: Json;
  updated_at?: number;
  stripe_customer_id?: string | null;
  [key: string]: string | number | boolean | Json | null | undefined
}

// RaaS Audit Log (immutable audit trail)
export interface RaasAuditLogRow {
  id: string;
  action: string;
  license_id: string | null;
  license_nonce: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Json;
  created_at: number;
  // Hash chain fields for immutable audit trail
  content_hash: string;
  previous_log_hash: string | null;
  hash_chain_valid: boolean;
  // Usage tracking fields (Phase 6 Advanced Audit Logging)
  model_name: string | null;
  token_count: number | null;
  ip_address_hash: string | null;
  user_pseudonym: string | null;
}

export interface RaasAuditLogInsert {
  action: string;
  license_id?: string | null;
  license_nonce?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Json;
  created_at?: number;
  // Usage tracking fields (optional on insert)
  model_name?: string | null;
  token_count?: number | null;
  ip_address_hash?: string | null;
  user_pseudonym?: string | null;
  // Note: content_hash, previous_log_hash, hash_chain_valid are auto-computed by trigger
}

export type {
  RaasApiKeyRow,
  RaasApiKeyInsert,
  RaasApiKeyUpdate,
  ApiKeyInfo,
  UsageStats,
  MissionStatus,
} from './raas-api-key-types'