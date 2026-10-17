/**
 * OAuth Token Vault using Web Crypto API.
 * HKDF-SHA256 per-channel key derivation and AES-256-GCM authenticated encryption.
 *
 * @module seed/security/oauth-token-vault
 */

import type { OAuthTokenPayload, VaultDerivationContext } from '@/seed/types/social-publisher-types';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  bytesToHex,
  hexToBytes,
  deriveChannelKey,
  parseVaultEnvelope,
} from './oauth-token-vault-crypto';

export { bytesToHex, hexToBytes, deriveChannelKey, parseVaultEnvelope };

export async function encryptString(
  plaintext: string,
  context: VaultDerivationContext,
  masterSecret?: string | Uint8Array,
  customSalt?: Uint8Array | string
): Promise<string> {
  const key = await deriveChannelKey(masterSecret, context, customSalt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as unknown as BufferSource
  );

  const encryptedBytes = new Uint8Array(encryptedBuf);
  const cipherBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);
  return `${bytesToHex(iv)}:${bytesToHex(tagBytes)}:${bytesToHex(cipherBytes)}`;
}

export async function decryptString(
  envelopeStr: string,
  context: VaultDerivationContext,
  masterSecret?: string | Uint8Array,
  customSalt?: Uint8Array | string
): Promise<string> {
  const parsed = parseVaultEnvelope(envelopeStr);
  const iv = hexToBytes(parsed.ivHex);
  if (iv.length !== 12) throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);

  let cipherData: Uint8Array;
  if (parsed.tagHex) {
    const tag = hexToBytes(parsed.tagHex);
    const cipher = hexToBytes(parsed.cipherHex);
    if (tag.length !== 16) throw new Error(`Invalid tag length: expected 16 bytes, got ${tag.length}`);
    cipherData = new Uint8Array(cipher.length + tag.length);
    cipherData.set(cipher, 0);
    cipherData.set(tag, cipher.length);
  } else {
    cipherData = hexToBytes(parsed.cipherHex);
  }

  const key = await deriveChannelKey(masterSecret, context, customSalt);
  try {
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      cipherData as unknown as BufferSource
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch (err) {
    throw new Error(`Vault decryption failed: ${getErrorMessage(err)}`);
  }
}

export async function encryptTokenVault(
  payload: OAuthTokenPayload,
  context: VaultDerivationContext,
  masterSecret?: string | Uint8Array,
  customSalt?: Uint8Array | string
): Promise<string> {
  if (!payload || typeof payload.accessToken !== 'string' || typeof payload.expiresAt !== 'number') {
    throw new Error('Invalid OAuthTokenPayload: accessToken and expiresAt are required');
  }
  return encryptString(JSON.stringify(payload), context, masterSecret, customSalt);
}

export async function decryptTokenVault(
  envelopeStr: string,
  context: VaultDerivationContext,
  masterSecret?: string | Uint8Array,
  customSalt?: Uint8Array | string
): Promise<OAuthTokenPayload> {
  const json = await decryptString(envelopeStr, context, masterSecret, customSalt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Failed to parse decrypted token vault payload as JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).accessToken !== 'string' ||
    typeof (parsed as Record<string, unknown>).expiresAt !== 'number'
  ) {
    throw new Error('Decrypted vault payload does not conform to OAuthTokenPayload');
  }

  return parsed as OAuthTokenPayload;
}
