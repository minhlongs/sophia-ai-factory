/**
 * RaaS API Key Manager
 *
 * Handles generation, validation, creation, revocation, and listing
 * of API keys for external RaaS consumers.
 */

import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/client';

// ── Local types ───────────────────────────────────────────────────────────────

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

export interface ValidateResult {
  valid: boolean;
  orgId?: string;
  keyId?: string;
  permissions?: string[];
  rateLimit?: number;
}

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Generate a new API key with its SHA-256 hash and display prefix.
 * The raw key is returned ONCE — only the hash is stored.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 16);
  return { key, hash, prefix };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate an incoming API key from request headers.
 * Hashes the key and looks up in raas_api_keys.
 * Updates last_used_at on success.
 */
export async function validateApiKey(key: string): Promise<ValidateResult> {
  if (!key?.startsWith('sk_live_')) return { valid: false };

  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const db = createServerClient();

  const { data, error } = await db
    .from('raas_api_keys')
    .select('id, org_id, permissions, rate_limit_per_minute, is_active, expires_at')
    .eq('key_hash', hash)
    .single();

  if (error || !data) return { valid: false };
  if (!data.is_active) return { valid: false };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };

  // Update last_used_at (fire-and-forget, non-blocking)
  db.from('raas_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return {
    valid: true,
    orgId: data.org_id,
    keyId: data.id,
    permissions: data.permissions ?? [],
    rateLimit: data.rate_limit_per_minute ?? 60,
  };
}

// ── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Create a new API key for an org. Returns the raw key ONCE.
 */
export async function createApiKey(
  orgId: string,
  name: string
): Promise<{ key: string; id: string }> {
  const { key, hash, prefix } = generateApiKey();
  const db = createServerClient();

  const { data, error } = await db
    .from('raas_api_keys')
    .insert({ org_id: orgId, name, key_hash: hash, key_prefix: prefix })
    .select('id')
    .single();

  if (error || !data) throw new Error('Failed to create API key');
  return { key, id: data.id };
}

/**
 * Revoke an API key — sets is_active = false.
 * Verifies org ownership before revoking.
 */
export async function revokeApiKey(keyId: string, orgId: string): Promise<boolean> {
  const db = createServerClient();
  const { error } = await db
    .from('raas_api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('org_id', orgId);

  return !error;
}

/**
 * List all API keys for an org (no hash returned).
 */
export async function listApiKeys(orgId: string): Promise<ApiKeyInfo[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('raas_api_keys')
    .select('id, name, key_prefix, permissions, rate_limit_per_minute, is_active, last_used_at, created_at, expires_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to list API keys');
  return (data ?? []) as ApiKeyInfo[];
}
