/**
 * Encryption utilities — Web Crypto API (Cloudflare Workers compatible).
 * Uses AES-GCM with 256-bit keys.
 */

const IV_LENGTH = 12; // GCM recommended IV length

function getEncryptionKey(): string {
  const keyHex = process.env.API_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('Encryption key not configured');
  }
  return keyHex;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts text using AES-256-GCM (Web Crypto API).
 * Returns format: iv:encryptedContent (hex encoded)
 */
export async function encrypt(text: string): Promise<string> {
  const keyHex = getEncryptionKey();
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text),
  );

  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypts text using AES-256-GCM (Web Crypto API).
 */
export async function decrypt(text: string): Promise<string> {
  const keyHex = getEncryptionKey();
  const key = await importKey(keyHex);

  const parts = text.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = hexToBytes(parts[0]);
  const ciphertext = hexToBytes(parts[1]);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Mask an API key for display (e.g., "sk-...482s")
 */
export function maskApiKey(key: string, visibleChars = 4): string {
  if (!key || key.length <= visibleChars * 2) return '********';
  return `${key.slice(0, 3)}...${key.slice(-visibleChars)}`;
}
