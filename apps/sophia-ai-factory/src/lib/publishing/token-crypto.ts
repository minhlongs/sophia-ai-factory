/**
 * Token encryption/decryption utilities.
 * Production: AES-256-GCM via Web Crypto API (OAUTH_TOKEN_ENC_KEY required).
 * Key: 32-byte hex string (64 hex chars) — generate with: openssl rand -hex 32
 *
 * MIGRATION NOTE: any rows encrypted with the old base64 "enc:" prefix must be
 * re-encrypted. Run: scripts/reencrypt-publishing-tokens.ts before deploying.
 */

const AES_KEY_PREFIX = 'aes:';

/** Validate and import the AES-GCM key from env. Throws on missing/short key. */
async function importEncKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const rawKey = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!rawKey) {
    throw new Error('OAUTH_TOKEN_ENC_KEY is required for token encryption');
  }
  const keyBuf = Buffer.from(rawKey, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error(
      `OAUTH_TOKEN_ENC_KEY must be 32 bytes (64 hex chars) for AES-256-GCM. Got ${keyBuf.length} bytes.`,
    );
  }
  return crypto.subtle.importKey(
    'raw',
    keyBuf as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    [usage],
  );
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Requires OAUTH_TOKEN_ENC_KEY env var (32-byte hex).
 * Returns "aes:<base64(iv + ciphertext)>".
 */
export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  const key = await importEncKey('encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded as unknown as BufferSource,
  );
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  return `${AES_KEY_PREFIX}${Buffer.from(combined).toString('base64')}`;
}

/**
 * Decrypt a token encrypted by encryptToken.
 * Handles legacy "enc:<base64>" tokens during migration window.
 * Requires OAUTH_TOKEN_ENC_KEY env var.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;

  // Legacy base64-only format — migration window backward compat
  if (ciphertext.startsWith('enc:')) {
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8');
  }

  if (!ciphertext.startsWith(AES_KEY_PREFIX)) {
    return ciphertext; // plaintext pre-encryption
  }

  const key = await importEncKey('decrypt');
  const combined = Buffer.from(ciphertext.slice(AES_KEY_PREFIX.length), 'base64');
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data as unknown as BufferSource,
  );

  return new TextDecoder().decode(decrypted);
}
