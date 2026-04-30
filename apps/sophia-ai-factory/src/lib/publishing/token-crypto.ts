/**
 * Token encryption/decryption utilities.
 * Sync shim: base64 encode/decode (for D1 writes where Web Crypto is unavailable).
 * Async AES-GCM: uses Web Crypto API when OAUTH_TOKEN_ENC_KEY is set.
 */

/** Sync shim — simply base64-encodes the token with an "enc:" prefix */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  return `enc:${Buffer.from(plaintext, 'utf8').toString('base64')}`;
}

/** Sync shim — decodes "enc:<base64>" prefix or returns as-is */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith('enc:')) return ciphertext;
  return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8');
}

/** AES-GCM encryption using Web Crypto (async, for edge runtime) */
export async function encryptTokenAsync(plaintext: string): Promise<string> {
  const rawKey = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!rawKey) return encryptToken(plaintext);

  const keyBuf = Buffer.from(rawKey, 'hex');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded as unknown as BufferSource,
  );

  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);
  return `aes:${Buffer.from(combined).toString('base64')}`;
}

/** AES-GCM decryption using Web Crypto (async, for edge runtime) */
export async function decryptTokenAsync(ciphertext: string): Promise<string> {
  const rawKey = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!rawKey || !ciphertext.startsWith('aes:')) return decryptToken(ciphertext);

  const keyBuf = Buffer.from(rawKey, 'hex');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const combined = Buffer.from(ciphertext.slice(4), 'base64');
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data as unknown as BufferSource,
  );

  return new TextDecoder().decode(decrypted);
}
