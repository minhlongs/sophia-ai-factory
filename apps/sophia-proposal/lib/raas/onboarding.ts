/**
 * RaaS Onboarding Helper
 *
 * Creates organization, API key, and seeds MCU credits for new pilot tenants.
 * Uses Web Crypto (crypto.subtle) — compatible with Cloudflare Workers.
 */

import { getD1Client } from '@/lib/db/client';

export interface CreateOrganizationResult {
  org_id: string;
  api_key: string;
}

// ── Crypto helpers (Web Crypto / CF Workers compatible) ────────────────────────

/** SHA-256 hash a string, return hex. */
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** PBKDF2-hash a password; returns `pbkdf2:<saltHex>:<hashHex>`. */
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a new organization with an API key and 200 MCU starter credits.
 * Returns plain API key (shown once only).
 */
export async function createOrganization(params: {
  name: string;
  email: string;
  plan: string;
}): Promise<CreateOrganizationResult> {
  const db = await getD1Client();
  const now = new Date().toISOString();
  const org_id = crypto.randomUUID();

  // 1. Insert organization
  const { error: orgErr } = await db.from('organizations').insert({
    id: org_id,
    name: params.name,
    email: params.email,
    plan: params.plan,
    created_at: now,
  });
  if (orgErr) throw new Error(`Failed to create organization: ${orgErr.message}`);

  // 2. Generate API key
  const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = await sha256Hex(rawKey);
  const keyPrefix = rawKey.substring(0, 16);
  const keyId = crypto.randomUUID();

  const { error: keyErr } = await db.from('raas_api_keys').insert({
    id: keyId,
    org_id,
    name: `${params.name} Key`,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    permissions: JSON.stringify(['missions:create', 'missions:read', 'usage:read']),
    is_active: 1,
    created_at: now,
  });
  if (keyErr) throw new Error(`Failed to create API key: ${keyErr.message}`);

  // 3. Seed 200 MCU starter credits into org_balances (missions debit from this table)
  const { error: balanceErr } = await db.from('org_balances').insert({
    id: crypto.randomUUID(),
    org_id,
    balance: 200,
    reserved: 0,
    lifetime_credits: 200,
    lifetime_debits: 0,
    updated_at: now,
  });
  if (balanceErr) throw new Error(`Failed to seed MCU credits: ${balanceErr.message}`);

  return { org_id, api_key: rawKey };
}

/**
 * Create an admin user tied to an existing organization.
 * Returns user id.
 */
export async function createAdminUser(params: {
  org_id: string;
  email: string;
  password: string;
}): Promise<string> {
  const db = await getD1Client();
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(params.password);
  const now = new Date().toISOString();

  const { error: userErr } = await db.from('users').insert({
    id: userId,
    email: params.email,
    password_hash: passwordHash,
    role: 'admin',
    created_at: now,
  });
  if (userErr) throw new Error(`Failed to create user: ${userErr.message}`);

  const { error: memberErr } = await db.from('org_members').insert({
    org_id: params.org_id,
    user_id: userId,
    role: 'owner',
    created_at: now,
  });
  if (memberErr) throw new Error(`Failed to add org member: ${memberErr.message}`);

  return userId;
}

/**
 * Generate a new API key for an existing org. Returns plain key (once).
 */
export async function generateOrgApiKey(orgId: string): Promise<{
  api_key: string;
  key_prefix: string;
  created_at: string;
}> {
  const db = await getD1Client();
  const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = await sha256Hex(rawKey);
  const keyPrefix = rawKey.substring(0, 16);
  const now = new Date().toISOString();

  const { error } = await db.from('raas_api_keys').insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    permissions: JSON.stringify(['missions:create', 'missions:read', 'usage:read']),
    created_at: now,
  });
  if (error) throw new Error(`Failed to generate API key: ${error.message}`);

  return { api_key: rawKey, key_prefix: keyPrefix, created_at: now };
}
