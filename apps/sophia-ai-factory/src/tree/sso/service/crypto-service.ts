/**
 * @file crypto-service.ts
 * @description AES-256-GCM symmetric encryption for SSO OAuth/OIDC client secrets.
 * @layer tree
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { logger } from '@/seed/utils/logger-utility';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SSO_SECRET_ENCRYPTION_KEY ||
    process.env.CREDENTIALS_MASTER_KEY ||
    'sophia_sso_default_fallback_master_encryption_key_2026';
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt client secret using AES-256-GCM
 */
export function encryptClientSecret(secret: string): string {
  if (!secret) return '';
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: "aes-gcm:<iv_base64>:<tag_base64>:<data_base64>"
  return `aes-gcm:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt client secret using AES-256-GCM
 */
export function decryptClientSecret(encryptedPayload: string | null | undefined): string | null {
  if (!encryptedPayload) return null;
  if (!encryptedPayload.startsWith('aes-gcm:')) {
    // Unencrypted or legacy format
    return encryptedPayload;
  }

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 4) return null;

    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');

    const key = getEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.warn('[enterprise-sso-service] Decryption failed for client secret', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
