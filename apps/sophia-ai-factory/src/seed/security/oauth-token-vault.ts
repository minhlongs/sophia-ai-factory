/**
 * OAuth Token Vault using Web Crypto API.
 * HKDF-SHA256 per-channel key derivation and AES-256-GCM authenticated encryption.
 *
 * @module seed/security/oauth-token-vault
 */

import type { OAuthTokenPayload, VaultDerivationContext } from '@/seed/types/social-publisher-types';
import { getErrorMessage } from '@/seed/utils/to-error';

const DEFAULT_SALT = new TextEncoder().encode('sophia-social-vault-v1');

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string: odd length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`Invalid hex byte at index ${i}`);
    bytes[i / 2] = byte;
  }
  return bytes;
}

function resolveSecretBytes(secret?: string | Uint8Array): Uint8Array {
  if (secret instanceof Uint8Array) {
    if (secret.length < 16) throw new Error('Master secret must be at least 16 bytes');
    return secret;
  }
  const raw = secret || process.env.SOCIAL_VAULT_MASTER_KEY || process.env.OAUTH_TOKEN_ENC_KEY;
  if (!raw) throw new Error('Master secret not found in env or arguments');
  if (/^[0-9a-fA-F]{32,}$/.test(raw) && raw.length % 2 === 0) return hexToBytes(raw);
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length < 16) throw new Error('Master secret must be at least 16 bytes');
  return bytes;
}

export async function deriveChannelKey(
  masterSecret: string | Uint8Array | undefined,
  context: VaultDerivationContext,
  customSalt?: Uint8Array | string
): Promise<CryptoKey> {
  const secretBytes = resolveSecretBytes(masterSecret);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secretBytes as unknown as BufferSource,
    'HKDF',
    false,
    ['deriveKey']
  );
  const saltBytes = customSalt
    ? (typeof customSalt === 'string' ? new TextEncoder().encode(customSalt) : customSalt)
    : DEFAULT_SALT;

  const infoTag = `social-vault:${context.userId}:${context.platform}:${context.channelId}`;
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes as unknown as BufferSource,
      info: new TextEncoder().encode(infoTag) as unknown as BufferSource,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

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

export function parseVaultEnvelope(envelopeStr: string): { ivHex: string; tagHex?: string; cipherHex: string } {
  const parts = envelopeStr.split(':');
  if (parts.length === 3) return { ivHex: parts[0], tagHex: parts[1], cipherHex: parts[2] };
  if (parts.length === 2) return { ivHex: parts[0], cipherHex: parts[1] };
  throw new Error('Invalid vault envelope format. Expected ivHex:tagHex:cipherHex or ivHex:cipherHex');
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
