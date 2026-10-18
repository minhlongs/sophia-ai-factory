/**
 * RaaS API Key & UI Statistics Types
 *
 * @module seed/types/raas-api-key-types
 */

import type { Json } from './json'

// RaaS API Keys (for /api/audit endpoint authentication)
export interface RaasApiKeyRow {
  id: string;
  key_id: string;
  key_hash: string;
  owner_id: string;
  permissions: Json;
  created_at: string;
  expires_at: number | null;
  revoked_at: number | null;
  last_used_at: number | null;
  rate_limit_per_min: number;
}

export interface RaasApiKeyInsert {
  key_id: string;
  key_hash: string;
  owner_id: string;
  permissions: Json;
  created_at?: string;
  expires_at?: number | null;
  revoked_at?: number | null;
  last_used_at?: number | null;
  rate_limit_per_min?: number;
}

export interface RaasApiKeyUpdate {
  key_id?: string;
  key_hash?: string;
  owner_id?: string;
  permissions?: Json;
  expires_at?: number | null;
  revoked_at?: number | null;
  last_used_at?: number | null;
  rate_limit_per_min?: number;
  [key: string]: string | number | boolean | Json | null | undefined
}

/**
 * API key info for UI display
 */
export interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

/**
 * Usage statistics for API keys
 */
export interface UsageStats {
  calls_by_day: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
  total_mcu: number;
  avg_response_ms: number;
}

/**
 * Mission status for RaaS dashboard
 */
export type MissionStatus = 'queued' | 'planning' | 'executing' | 'verifying' | 'completed' | 'failed';
