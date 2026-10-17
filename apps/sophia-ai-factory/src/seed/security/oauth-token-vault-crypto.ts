/**
 * Cryptographic primitives for OAuth Token Vault.
 * Hex encoding/decoding and HKDF-SHA256 channel key derivation.
 *
 * @module seed/security/oauth-token-vault-crypto
 */

import type { VaultDerivationContext } from '@/seed/types/social-publisher-types';

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

export function resolveSecretBytes(secret?: string | Uint8Array): Uint8Array {
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

export function parseVaultEnvelope(envelopeStr: string): { ivHex: string; tagHex?: string; cipherHex: string } {
  const parts = envelopeStr.split(':');
  if (parts.length === 3) return { ivHex: parts[0], tagHex: parts[1], cipherHex: parts[2] };
  if (parts.length === 2) return { ivHex: parts[0], cipherHex: parts[1] };
  throw new Error('Invalid vault envelope format. Expected ivHex:tagHex:cipherHex or ivHex:cipherHex');
}
