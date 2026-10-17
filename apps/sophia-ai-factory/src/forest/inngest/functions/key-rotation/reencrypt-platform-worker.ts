/**
 * @file reencrypt-platform-worker.ts
 * @description Batch re-encryption for platform OAuth credentials and key retirement
 */

import { getD1 } from '@/seed/db/client';
import { decryptApiKey, encryptApiKey } from '@/tree/byok/byok-crypto';
import type { PlatformCredentialRow } from './types';
import { BATCH_SIZE, toBytes } from './reencrypt-worker';

export async function reencryptPlatformCredentials(
  keyVersion: number,
  oldVersion: number,
): Promise<number> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT id, user_id, platform, access_token_encrypted, refresh_token_encrypted, key_version
         FROM platform_credentials
         WHERE key_version = ?
         ORDER BY user_id, platform
         LIMIT ? OFFSET ?`,
      )
      .bind(oldVersion, BATCH_SIZE, offset)
      .all<PlatformCredentialRow>();

    if (!rows.results || rows.results.length === 0) break;

    for (const row of rows.results) {
      if (!row.key_version) continue;

      const accessToken = await decryptApiKey(
        toBytes(new TextEncoder().encode(row.access_token_encrypted)),
        row.user_id,
        row.key_version,
      );
      const encryptedAccess = await encryptApiKey(accessToken, row.user_id, keyVersion);

      let encryptedRefresh: string | null = null;
      if (row.refresh_token_encrypted) {
        const refreshToken = await decryptApiKey(
          toBytes(new TextEncoder().encode(row.refresh_token_encrypted)),
          row.user_id,
          row.key_version,
        );
        encryptedRefresh = new TextDecoder().decode(
          await encryptApiKey(refreshToken, row.user_id, keyVersion),
        );
      }

      await db
        .prepare(
          `UPDATE platform_credentials
           SET access_token_encrypted = ?, refresh_token_encrypted = ?, key_version = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(new TextDecoder().decode(encryptedAccess), encryptedRefresh, keyVersion, row.id)
        .run();

      total += 1;
    }

    if (rows.results.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return total;
}

export async function retireOldKeyVersion(oldVersion: number): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE key_versions
       SET is_active = 0, rotated_at = datetime(?, 'unixepoch')
       WHERE version = ? AND is_active = 1`,
    )
    .bind(now, oldVersion)
    .run();
}
