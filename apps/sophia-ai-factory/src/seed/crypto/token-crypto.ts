/**
 * Token encryption/decryption utilities.
 * Production: AES-256-GCM via Web Crypto API (OAUTH_TOKEN_ENC_KEY required).
 * Key: 32-byte hex string (64 hex chars) — generate with: openssl rand -hex 32
 *
 * KEY ROTATION: set OAUTH_TOKEN_ENC_KEY to new key, OAUTH_TOKEN_ENC_KEY_PREV to old key.
 * Decryption will try current key first, then fall back to previous key (read-repair on success).
 * Encrypted output uses version prefix "aes:v1:" to distinguish key versions.
 *
 * MIGRATION NOTE: rows encrypted with the old base64 "enc:" prefix must be
 * re-encrypted. Run: scripts/reencrypt-publishing-tokens.ts before deploying.
 *
 * @module seed/crypto/token-crypto
 */

const AES_KEY_PREFIX = 'aes:';
const AES_V1_PREFIX = 'aes:v1:';

/** Validate and import the AES-GCM key from a hex string. Throws on missing/short key. */
async function importHexKey(rawKey: string, usage: 'encrypt' | 'decrypt', envVarName: string): Promise<CryptoKey> {
  const keyBuf = Buffer.from(rawKey, 'hex');
  if (keyBuf.length !== 32) {
    throw new Error(
      `${envVarName} must be 32 bytes (64 hex chars) for AES-256-GCM. Got ${keyBuf.length} bytes.`,
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

/** Validate and import the current AES-GCM key from env. Throws on missing/short key. */
async function importEncKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const rawKey = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!rawKey) {
    throw new Error('OAUTH_TOKEN_ENC_KEY is required for token encryption');
  }
  return importHexKey(rawKey, usage, 'OAUTH_TOKEN_ENC_KEY');
}

/** Attempt AES-GCM decrypt with a given CryptoKey. Returns null on failure. */
async function tryDecrypt(key: CryptoKey, payload: string): Promise<string | null> {
  try {
    const combined = Buffer.from(payload, 'base64');
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data as unknown as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Requires OAUTH_TOKEN_ENC_KEY env var (32-byte hex).
 * Returns "aes:v1:<base64(iv + ciphertext)>" — versioned for key rotation.
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
  return `${AES_V1_PREFIX}${Buffer.from(combined).toString('base64')}`;
}

/**
 * Decrypt a token encrypted by encryptToken.
 * Handles:
 *   - "aes:v1:<payload>" — current versioned format
 *   - "aes:<payload>"   — legacy unversioned format
 *   - "enc:<base64>"    — legacy base64-only format
 *   - no prefix         — plaintext pre-encryption
 *
 * Key rotation: set OAUTH_TOKEN_ENC_KEY_PREV to old key.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;

  if (ciphertext.startsWith('enc:')) {
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8');
  }

  let payload: string;
  if (ciphertext.startsWith(AES_V1_PREFIX)) {
    payload = ciphertext.slice(AES_V1_PREFIX.length);
  } else if (ciphertext.startsWith(AES_KEY_PREFIX)) {
    payload = ciphertext.slice(AES_KEY_PREFIX.length);
  } else {
    return ciphertext;
  }

  const currentKey = await importEncKey('decrypt');
  const result = await tryDecrypt(currentKey, payload);
  if (result !== null) return result;

  const prevRawKey = process.env.OAUTH_TOKEN_ENC_KEY_PREV;
  if (prevRawKey) {
    try {
      const prevKey = await importHexKey(prevRawKey, 'decrypt', 'OAUTH_TOKEN_ENC_KEY_PREV');
      const prevResult = await tryDecrypt(prevKey, payload);
      if (prevResult !== null) {
        return prevResult;
      }
    } catch {
      // prev key invalid — fall through to throw
    }
  }

  throw new Error('Failed to decrypt token: decryption failed with all available keys');
}

/**
 * Re-encrypt a plaintext value with the current key.
 */
export async function reEncryptToken(plaintext: string): Promise<string> {
  return encryptToken(plaintext);
}
