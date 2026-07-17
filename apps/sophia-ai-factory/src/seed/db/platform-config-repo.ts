/**
 * Platform Config Repository
 *
 * Stores platform-level configuration values encrypted at rest.
 * Uses the same AES-GCM-256 encryption as user credentials (via encryptValue/decryptValue).
 *
 * Use cases: Honeycomb API key for OTel, platform-wide settings.
 */

import { getD1 } from '@/seed/db/client';
import { encryptValue, decryptValue } from '@/seed/crypto/encryption';

interface PlatformConfigRow {
  key: string;
  encrypted_value: string;
  updated_by: string | null;
  updated_at: number;
}

const CONFIG_KEYS = ['honeycomb_api_key', 'honeycomb_dataset'] as const;
export type PlatformConfigKey = (typeof CONFIG_KEYS)[number];

/**
 * Get a platform config value (decrypted).
 * Returns null if key doesn't exist.
 */
export async function getPlatformConfig(key: PlatformConfigKey): Promise<string | null> {
  const db = getD1();
  if (!db) return null;

  const row = await db
    .prepare('SELECT encrypted_value FROM platform_configs WHERE key = ? LIMIT 1')
    .bind(key)
    .first<PlatformConfigRow>();

  if (!row?.encrypted_value) return null;

  try {
    return await decryptValue(row.encrypted_value);
  } catch {
    // If decryption fails (e.g. key rotated), return null
    return null;
  }
}

/**
 * Set a platform config value (encrypted before storage).
 */
export async function setPlatformConfig(
  key: PlatformConfigKey,
  value: string,
  userId?: string,
): Promise<void> {
  const db = getD1();
  if (!db) return;

  const encrypted = await encryptValue(value);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO platform_configs (key, encrypted_value, updated_by, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
    )
    .bind(key, encrypted, userId ?? null, now)
    .run();
}

/**
 * Delete a platform config value.
 */
export async function deletePlatformConfig(key: PlatformConfigKey): Promise<void> {
  const db = getD1();
  if (!db) return;

  await db.prepare('DELETE FROM platform_configs WHERE key = ?').bind(key).run();
}

/**
 * Check if a platform config key exists and has a value.
 */
export async function hasPlatformConfig(key: PlatformConfigKey): Promise<boolean> {
  const db = getD1();
  if (!db) return false;

  const row = await db
    .prepare('SELECT 1 FROM platform_configs WHERE key = ? LIMIT 1')
    .bind(key)
    .first();

  return !!row;
}
