import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { decryptApiKey, encryptApiKey, generateMasterKey } from '@/tree/byok/byok-crypto';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';

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

interface RotationPayloadData {
  keyVersion: number;
  oldVersion: number;
  reason?: string;
}

function toBytes(blob: ArrayBuffer | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : new Uint8Array(blob);
}

async function reencryptUserApiKeys(keyVersion: number, oldVersion: number): Promise<number> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT user_id, provider, encrypted_key, key_version
         FROM user_api_keys
         WHERE key_version = ?
         ORDER BY user_id, provider
         LIMIT ? OFFSET ?`,
      )
      .bind(oldVersion, BATCH_SIZE, offset)
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

async function reencryptProviderCredentials(keyVersion: number, oldVersion: number): Promise<number> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db
      .prepare(
        `SELECT id, user_id, provider, encrypted_value, key_version
         FROM user_provider_credentials
         WHERE key_version = ?
         ORDER BY user_id, provider
         LIMIT ? OFFSET ?`,
      )
      .bind(oldVersion, BATCH_SIZE, offset)
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

async function reencryptPlatformCredentials(keyVersion: number, oldVersion: number): Promise<number> {
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
    const { keyVersion, oldVersion, reason } = event.data as RotationPayloadData;

    logger.info('[key-rotation] Starting re-encrypt job', { keyVersion, oldVersion });

    // SOC 2 CC7.2: Audit log for re-encrypt job start
    await logAuditEvent({
      action: 'key_rotation.reencrypt_start',
      userId: 'system',
      metadata: {
        keyVersion,
        oldVersion,
        reason,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation] Audit log (start) failed', { error: err });
      // Non-blocking
    });

    const userApiKeys = await step.run('reencrypt-user-api-keys', async () => {
      return reencryptUserApiKeys(keyVersion, oldVersion);
    });

    const providerCredentials = await step.run('reencrypt-provider-credentials', async () => {
      return reencryptProviderCredentials(keyVersion, oldVersion);
    });

    const platformCredentials = await step.run('reencrypt-platform-credentials', async () => {
      return reencryptPlatformCredentials(keyVersion, oldVersion);
    });

    const total = userApiKeys + providerCredentials + platformCredentials;

    logger.info('[key-rotation] Re-encrypt job complete', {
      keyVersion,
      oldVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    });

    // 1. Retire old key version (set is_active=0, rotated_at=NOW)
    await step.run('retire-old-version', async () => {
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
    });

    // SOC 2 CC7.2: Audit log for re-encrypt job completion
    await logAuditEvent({
      action: 'key_rotation.reencrypt_complete',
      userId: 'system',
      metadata: {
        keyVersion,
        oldVersion,
        userApiKeys,
        providerCredentials,
        platformCredentials,
        total,
        reason,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation] Audit log (complete) failed', { error: err });
    });

    return {
      keyVersion,
      oldVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    };
  },
);

export const keyRotationCron = inngest.createFunction(
  { id: 'key-rotation-cron' },
  { cron: '0 0 1 */3 *' },
  async ({ step }) => {
    const latestVersion = await step.run('check-latest-version', async () => {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const row = await db
        .prepare(
          `SELECT version, created_at
           FROM key_versions
           ORDER BY version DESC
           LIMIT 1`,
        )
        .first<{ version: number; created_at: string }>();

      return row;
    });

    // No key versions exist — log and skip
    if (!latestVersion) {
      await logAuditEvent({
        action: 'key_rotation.cron_skip_no_version',
        userId: 'system',
        metadata: { actorType: 'system' },
      }).catch((err) => {
        logger.error('[key-rotation-cron] Audit log failed', { error: err });
      });

      logger.info('[key-rotation-cron] Skipped — no key versions exist');
      return { skipped: true, reason: 'no_key_version' };
    }

    const ageMs = Date.now() - new Date(latestVersion.created_at).getTime();
    const ageDays = ageMs / 86_400_000;

    // Key version is younger than 90 days — skip
    if (ageDays < 90) {
      await logAuditEvent({
        action: 'key_rotation.cron_skip_too_young',
        userId: 'system',
        metadata: {
          currentVersion: latestVersion.version,
          ageDays: Math.round(ageDays * 10) / 10,
          actorType: 'system',
        },
      }).catch((err) => {
        logger.error('[key-rotation-cron] Audit log failed', { error: err });
      });

      logger.info('[key-rotation-cron] Skipped — key version too young', {
        version: latestVersion.version,
        ageDays,
      });

      return { skipped: true, reason: 'too_young', version: latestVersion.version, ageDays };
    }

    // Key version is 90 days or older — trigger rotation
    const rotationResult = await step.run('create-new-version-and-fire-event', async () => {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const oldVersion = latestVersion.version;

      // Calculate next version number
      const nextVersionRow = await db
        .prepare(
          `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
           FROM key_versions`,
        )
        .first<{ next_version: number }>();

      const keyVersion = nextVersionRow?.next_version ?? oldVersion + 1;
      const encryptedKey = await generateMasterKey();

      // Insert new key version (active by default)
      await db
        .prepare(
          `INSERT INTO key_versions (key_type, version, encrypted_key, rotated_by)
           VALUES (?, ?, ?, ?)`,
        )
        .bind('master', keyVersion, encryptedKey, 'system')
        .run();

      // Fire rotation event so the re-encrypt handler processes the re-encryption
      await inngest.send({
        id: `key-rotation-cron-${keyVersion}-${Date.now()}`,
        name: 'key.rotation.requested',
        data: { keyVersion, oldVersion, reason: 'auto-rotation-cron' },
      });

      return { keyVersion, oldVersion };
    });

    // SOC 2 CC7.2: Audit log for cron-triggered rotation
    await logAuditEvent({
      action: 'key_rotation.cron_triggered',
      userId: 'system',
      metadata: {
        keyVersion: rotationResult.keyVersion,
        oldVersion: rotationResult.oldVersion,
        ageDays: Math.round(ageDays * 10) / 10,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation-cron] Audit log failed', { error: err });
    });

    logger.info('[key-rotation-cron] Rotation triggered', {
      keyVersion: rotationResult.keyVersion,
      oldVersion: rotationResult.oldVersion,
      ageDays,
    });

    return {
      skipped: false,
      keyVersion: rotationResult.keyVersion,
      oldVersion: rotationResult.oldVersion,
      ageDays,
    };
  },
);
