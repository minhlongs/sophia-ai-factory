/**
 * Credentials encryption -- thin adapter over lib/byok/byok-crypto.
 *
 * Uses Web Crypto AES-GCM-256 (Cloudflare Workers compatible).
 * Master key: env CREDENTIALS_MASTER_KEY (64 hex chars = 32 bytes).
 * Falls back to BYOK_MASTER_KEY for backward compat so a single
 * deploy secret covers both user_api_keys and user_provider_credentials.
 *
 * Storage format: <iv_b64>:<ciphertext_b64>  (text column in D1)
 * The auth tag is baked into ciphertext via AES-GCM (16-byte tag appended).
 *
 * @module lib/credentials/encryption
 */

const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12
const KEY_LEN_BITS = 256
const KEY_LEN_BYTES = 32

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== KEY_LEN_BYTES * 2) {
    throw new Error(
      `CREDENTIALS_MASTER_KEY must be ${KEY_LEN_BYTES * 2} hex chars, got ${hex.length}`,
    )
  }
  const out = new Uint8Array(KEY_LEN_BYTES)
  for (let i = 0; i < KEY_LEN_BYTES; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function importKey(): Promise<CryptoKey> {
  const hexKey = process.env.CREDENTIALS_MASTER_KEY
  const b64Key = process.env.BYOK_MASTER_KEY

  let raw: Uint8Array
  if (hexKey) {
    raw = hexToBytes(hexKey)
  } else if (b64Key) {
    raw = base64ToBytes(b64Key)
    if (raw.length !== KEY_LEN_BYTES) {
      throw new Error(`BYOK_MASTER_KEY: expected ${KEY_LEN_BYTES} bytes, got ${raw.length}`)
    }
  } else {
    throw new Error('CREDENTIALS_MASTER_KEY (or BYOK_MASTER_KEY) not set')
  }

  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string.
 * Returns "<iv_b64>:<ciphertext_b64>" for storage in TEXT column.
 */
export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error('encryptValue: plaintext is empty')
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const pt = new TextEncoder().encode(plaintext)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, pt))
  return `${bytesToBase64(iv)}:${bytesToBase64(ct)}`
}

/**
 * Decrypt a "<iv_b64>:<ciphertext_b64>" string.
 * Throws on tamper, wrong key, or malformed input.
 */
export async function decryptValue(encrypted: string): Promise<string> {
  const sep = encrypted.indexOf(':')
  if (sep === -1) throw new Error('decryptValue: malformed -- missing separator')
  const iv = base64ToBytes(encrypted.slice(0, sep))
  const ct = base64ToBytes(encrypted.slice(sep + 1))
  if (iv.length !== IV_BYTES) throw new Error(`decryptValue: iv must be ${IV_BYTES} bytes`)
  const key = await importKey()
  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv: iv as BufferSource }, key, ct.buffer as ArrayBuffer)
  return new TextDecoder().decode(pt)
}
