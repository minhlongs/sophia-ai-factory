/**
 * D1 Secret Encryption Helper — Phase C
 *
 * Edge-safe AES-256-GCM symmetric encryption for storing customer-supplied
 * tunnel bearer tokens (and similar short secrets) at-rest in D1.
 *
 * Threat model:
 *   - Goal: protect secrets if D1 export leaks (e.g., misconfigured backup).
 *   - In scope: ciphertext-at-rest. Tamper detection (GCM auth tag).
 *   - Out of scope: protecting against a compromised Worker process — at
 *     decrypt time the plaintext is in memory by definition.
 *
 * Storage format (single base64 blob in TEXT column):
 *   base64(iv12 || ciphertext_with_gcm_tag)
 *
 * Key management:
 *   - Single Data Encryption Key (DEK) stored as CF Worker Secret
 *     `LOCAL_MODE_DEK` (32-byte random, base64-encoded).
 *   - Rotation: dual-DEK window. To rotate, set `LOCAL_MODE_DEK_NEXT` and
 *     re-encrypt rows on read; after migration window, drop old. (Phase B+
 *     implements the dual-read fallback when needed.)
 */

const IV_BYTES = 12 // GCM standard
const KEY_BYTES = 32 // AES-256

/** Resolve DEK from CF Worker env. Pass override for tests. */
function readDekBase64(envOverride?: string): string {
  if (envOverride) return envOverride
  // CF Worker secrets surface via globalThis.__env (Sophia convention)
  const env = (globalThis as Record<string, unknown>).__env as
    | Record<string, string | undefined>
    | undefined
  const dek = env?.LOCAL_MODE_DEK ?? process.env.LOCAL_MODE_DEK
  if (!dek) throw new Error('LOCAL_MODE_DEK not configured')
  return dek
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

async function loadKey(envOverride?: string): Promise<CryptoKey> {
  const raw = base64ToBytes(readDekBase64(envOverride))
  if (raw.byteLength !== KEY_BYTES) {
    throw new Error(`LOCAL_MODE_DEK must decode to ${KEY_BYTES} bytes, got ${raw.byteLength}`)
  }
  return globalThis.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a UTF-8 plaintext with AES-256-GCM.
 * Returns a single base64 blob: `iv (12B) || ciphertext+tag`.
 */
export async function encryptSecret(plaintext: string, dekOverride?: string): Promise<string> {
  const key = await loadKey(dekOverride)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const blob = new Uint8Array(IV_BYTES + ciphertext.byteLength)
  blob.set(iv, 0)
  blob.set(new Uint8Array(ciphertext), IV_BYTES)
  return bytesToBase64(blob)
}

/**
 * Decrypt a base64 blob produced by `encryptSecret`. Throws on tamper,
 * wrong key, or malformed input. Caller should treat any throw as auth failure.
 */
export async function decryptSecret(blob: string, dekOverride?: string): Promise<string> {
  const bytes = base64ToBytes(blob)
  if (bytes.byteLength <= IV_BYTES) throw new Error('encrypted blob too short')
  const iv = bytes.slice(0, IV_BYTES)
  const ciphertext = bytes.slice(IV_BYTES)
  const key = await loadKey(dekOverride)
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plain)
}
