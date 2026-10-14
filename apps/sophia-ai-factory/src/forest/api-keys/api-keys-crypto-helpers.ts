/**
 * Cryptographic helpers, rate limit mapping, and types for D1 API key store.
 * @module forest/api-keys/api-keys-crypto-helpers
 */

import type { Tier } from '@/seed/types';

export const KEY_PREFIX = 'sk_live_';
const KEY_ID_BYTES = 8; // 16 hex chars

const TIER_RATE_LIMITS: Record<Tier, number> = {
  BASIC: 100,
  PREMIUM: 500,
  ENTERPRISE: 2000,
  MASTER: 2000,
};

export interface D1ApiKeyRow {
  id: string;
  key_id: string;
  key_hash: string;
  owner_id: string;
  name: string;
  permissions: string;
  rate_limit_per_min: number;
  created_at: number;
  expires_at: number | null;
  revoked_at: number | null;
  last_used_at: number | null;
}

export interface ApiKeyInfo {
  id: string;
  keyId: string;
  prefix: string;
  name: string;
  permissions: string[];
  rateLimitPerMin: number;
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
  lastUsedAt: number | null;
}

export interface CreateKeyResult {
  fullKey: string;
  keyId: string;
  prefix: string;
  id: string;
  createdAt: number;
}

/** Generate 16-hex-char key_id */
export function generateKeyId(): string {
  const bytes = new Uint8Array(KEY_ID_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate 32-byte random signature (64 hex chars) */
export function generateSignature(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash a string using WebCrypto */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function rowToInfo(row: D1ApiKeyRow): ApiKeyInfo {
  const perms: string[] = (() => {
    try {
      return JSON.parse(row.permissions) as string[];
    } catch {
      return [];
    }
  })();
  return {
    id: row.id,
    keyId: row.key_id,
    prefix: `${KEY_PREFIX}${row.key_id.slice(0, 8)}...`,
    name: row.name,
    permissions: perms,
    rateLimitPerMin: row.rate_limit_per_min,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export function tierToRateLimit(tier: Tier): number {
  return TIER_RATE_LIMITS[tier] ?? 100;
}
