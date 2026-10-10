/**
 * @file key-scanner.ts
 * @description D1 key version scanner and new version provisioning
 */

import { getD1 } from '@/seed/db/client';
import { generateMasterKey } from '@/tree/byok/byok-crypto';
import { inngest } from '@/seed/inngest/client';

export interface LatestKeyVersionRow {
  version: number;
  created_at: string;
}

export async function checkLatestKeyVersion(): Promise<LatestKeyVersionRow | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare(
      `SELECT version, created_at
       FROM key_versions
       ORDER BY version DESC
       LIMIT 1`,
    )
    .first<LatestKeyVersionRow>();

  return row;
}

export async function createNewVersionAndFireEvent(
  oldVersion: number,
): Promise<{ keyVersion: number; oldVersion: number }> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const nextVersionRow = await db
    .prepare(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM key_versions`,
    )
    .first<{ next_version: number }>();

  const keyVersion = nextVersionRow?.next_version ?? oldVersion + 1;
  const encryptedKey = await generateMasterKey();

  await db
    .prepare(
      `INSERT INTO key_versions (key_type, version, encrypted_key, rotated_by)
       VALUES (?, ?, ?, ?)`,
    )
    .bind('master', keyVersion, encryptedKey, 'system')
    .run();

  await inngest.send({
    id: `key-rotation-cron-${keyVersion}-${Date.now()}`,
    name: 'key.rotation.requested',
    data: { keyVersion, oldVersion, reason: 'auto-rotation-cron' },
  });

  return { keyVersion, oldVersion };
}
