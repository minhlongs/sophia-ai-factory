import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { decryptApiKey, encryptApiKey } from '@/tree/byok/byok-crypto';

const BATCH_SIZE = 250;

interface UserApiKeyRow {
  user_id: string;
  provider: string;
  encrypted_key: ArrayBuffer | Uint8Array;
  key_version: number | null;
}

interface ProviderCredentialRow {
  id: string;
  user_id: string;
  provider: string;
  encrypted_value: string;
  key_version: number | null;
}

interface PlatformCredentialRow {
  id: string;
  user_id: string;
  platform: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  key_version: number | null;
}

interface RotationPayload {
  data: {
    keyVersion: number;
    reason?: string;
  };
}

function toBytes(blob: ArrayBuffer | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : new Uint8Array(blob);
}

async function reencryptUserApiKeys(keyVersion: number): Promise<number> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT user_id, provider, encrypted_key, key_version
         FROM user_api_keys
         ORDER BY user_id, provider
         LIMIT ? OFFSET ?`,
      )
      .bind(BATCH_SIZE, offset)
      .all<UserApiKeyRow>();

    if (!rows.results || rows.results.length === 0) break;

    for (const row of rows.results) {
      if (!row.key_version) continue;

      const plain = await decryptApiKey(toBytes(row.encrypted_key), row.user_id, row.key_version);
      const encrypted = await encryptApiKey(plain, row.user_id, keyVersion);

      await db
        .prepare(
          `UPDATE user_api_keys
           SET encrypted_key = ?, key_version = ?, updated_at = datetime('now')
           WHERE user_id = ? AND provider = ?`,
        )
        .bind(encrypted, keyVersion, row.user_id, row.provider)
        .run();

      total += 1;
    }

    if (rows.results.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return total;
}

async function reencryptProviderCredentials(keyVersion: number): Promise<number> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT id, user_id, provider, encrypted_value, key_version
         FROM user_provider_credentials
         ORDER BY user_id, provider
         LIMIT ? OFFSET ?`,
      )
      .bind(BATCH_SIZE, offset)
      .all<ProviderCredentialRow>();

    if (!rows.results || rows.results.length === 0) break;

    for (const row of rows.results) {
      if (!row.key_version) continue;

      const plain = await decryptApiKey(toBytes(new TextEncoder().encode(row.encrypted_value)), row.user_id, row.key_version);
      const encrypted = await encryptApiKey(plain, row.user_id, keyVersion);

      await db
        .prepare(
          `UPDATE user_provider_credentials
           SET encrypted_value = ?, key_version = ?, updated_at = strftime('%s', 'now')
           WHERE id = ?`,
        )
        .bind(new TextDecoder().decode(encrypted), keyVersion, row.id)
        .run();

      total += 1;
    }

    if (rows.results.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return total;
}

async function reencryptPlatformCredentials(keyVersion: number): Promise<number> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT id, user_id, platform, access_token_encrypted, refresh_token_encrypted, key_version
         FROM platform_credentials
         ORDER BY user_id, platform
         LIMIT ? OFFSET ?`,
      )
      .bind(BATCH_SIZE, offset)
      .all<PlatformCredentialRow>();

    if (!rows.results || rows.results.length === 0) break;

    for (const row of rows.results) {
      if (!row.key_version) continue;

      const accessToken = await decryptApiKey(toBytes(new TextEncoder().encode(row.access_token_encrypted)), row.user_id, row.key_version);
      const encryptedAccess = await encryptApiKey(accessToken, row.user_id, keyVersion);

      let encryptedRefresh: string | null = null;
      if (row.refresh_token_encrypted) {
        const refreshToken = await decryptApiKey(toBytes(new TextEncoder().encode(row.refresh_token_encrypted)), row.user_id, row.key_version);
        encryptedRefresh = new TextDecoder().decode(await encryptApiKey(refreshToken, row.user_id, keyVersion));
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

export const keyRotationReencrypt = inngest.createFunction(
  { id: 'key-rotation-reencrypt', retries: 3 },
  { event: 'key.rotation.requested' },
  async ({ event, step }) => {
    const payload = event as RotationPayload;
    const { keyVersion } = payload.data;

    logger.info('[key-rotation] Starting re-encrypt job', { keyVersion });

    const userApiKeys = await step.run('reencrypt-user-api-keys', async () => {
      return reencryptUserApiKeys(keyVersion);
    });

    const providerCredentials = await step.run('reencrypt-provider-credentials', async () => {
      return reencryptProviderCredentials(keyVersion);
    });

    const platformCredentials = await step.run('reencrypt-platform-credentials', async () => {
      return reencryptPlatformCredentials(keyVersion);
    });

    const total = userApiKeys + providerCredentials + platformCredentials;

    logger.info('[key-rotation] Re-encrypt job complete', {
      keyVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    });

    return {
      keyVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    };
  },
);
