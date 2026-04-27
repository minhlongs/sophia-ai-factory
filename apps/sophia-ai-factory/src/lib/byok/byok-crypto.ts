/**
 * BYOK crypto — Phase 4G-BYOK.
 *
 * Wraps Web Crypto AES-GCM-256 for encrypting per-user provider API
 * keys at rest in D1. Cloudflare Workers-native (no SDK).
 *
 * Format: `[iv (12 bytes)][ciphertext + auth tag]` packed as Uint8Array.
 * Master key is base64-encoded 32 bytes in `BYOK_MASTER_KEY` env.
 *
 * Tamper detection is guaranteed by AES-GCM's auth tag: any byte flip
 * in the stored blob causes `decrypt` to throw.
 */

const ALGORITHM   = 'AES-GCM'
const IV_BYTES    = 12
const KEY_LEN_BITS = 256
const KEY_LEN_BYTES = KEY_LEN_BITS / 8

export class ByokMissingMasterKeyError extends Error {
  constructor() {
    super('BYOK_MASTER_KEY_MISSING: set BYOK_MASTER_KEY env (base64 32 bytes)')
    this.name = 'ByokMissingMasterKeyError'
  }
}

export class ByokInvalidMasterKeyError extends Error {
  constructor(detail: string) {
    super(`BYOK_MASTER_KEY_INVALID: ${detail}`)
    this.name = 'ByokInvalidMasterKeyError'
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function importMasterKey(): Promise<CryptoKey> {
  const raw = process.env.BYOK_MASTER_KEY
  if (!raw) throw new ByokMissingMasterKeyError()
  let bytes: Uint8Array
  try { bytes = base64ToBytes(raw) }
  catch { throw new ByokInvalidMasterKeyError('not valid base64') }
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new ByokInvalidMasterKeyError(
      `expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`,
    )
  }
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string (typically a provider API key).
 * Returns a packed `[iv][ciphertext+tag]` Uint8Array ready for D1 BLOB.
 *
 * Throws `ByokMissingMasterKeyError` / `ByokInvalidMasterKeyError` if
 * BYOK_MASTER_KEY is absent or malformed.
 */
export async function encryptApiKey(plain: string): Promise<Uint8Array> {
  if (!plain) throw new Error('BYOK_ENCRYPT_EMPTY: plaintext is empty')
  const key = await importMasterKey()
  const iv  = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const pt  = new TextEncoder().encode(plain)
  const ct  = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, pt),
  )
  const packed = new Uint8Array(iv.length + ct.length)
  packed.set(iv, 0)
  packed.set(ct, iv.length)
  return packed
}

/**
 * Decrypt a packed `[iv][ciphertext+tag]` blob. Throws on tamper,
 * wrong master key, or malformed input.
 */
export async function decryptApiKey(packed: Uint8Array): Promise<string> {
  if (!packed || packed.length <= IV_BYTES) {
    throw new Error('BYOK_DECRYPT_MALFORMED: payload too short')
  }
  const key = await importMasterKey()
  const iv  = packed.slice(0, IV_BYTES)
  const ct  = packed.slice(IV_BYTES)
  const pt  = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ct)
  return new TextDecoder().decode(pt)
}

/**
 * Generate a fresh base64-encoded master key. Ops runs once and stores
 * the output as `BYOK_MASTER_KEY`. Not called at runtime.
 */
export async function generateMasterKey(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_LEN_BYTES))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
