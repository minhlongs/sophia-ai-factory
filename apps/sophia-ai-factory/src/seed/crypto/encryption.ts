/**
 * Seed-level symmetric encryption — AES-256-GCM via Web Crypto API.
 *
 * This is the foundational crypto primitive for all symmetric encryption
 * across the platform.  No tree/land imports — pure seed.
 *
 * Env: CREDENTIALS_MASTER_KEY — 64 hex chars (32 bytes).
 * Key rotation: use CREDENTIALS_MASTER_KEY_PREV for the previous key.
 *
 * Storage format: aes-v1:<base64(iv)>:<base64(ciphertext+tag)>
 *
 * @module seed/crypto/encryption
 */

import {
  ALGORITHM,
  IV_BYTES,
  decode,
  encode,
  loadKeys,
  tryDecryptOne,
} from './encryption-helpers'

/**
 * Encrypt a plaintext string. Returns "aes-v1:<base64(iv)>:<base64(ciphertext)>".
 */
export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error('encryptValue: plaintext must not be empty')
  }
  const { current } = await loadKeys()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    current,
    new TextEncoder().encode(plaintext) as BufferSource,
  )
  return encode(encrypted, iv)
}

/**
 * Decrypt a value encrypted by encryptValue. Tries current key, then previous
 * key if available. Returns the plaintext string. Throws on failure.
 */
export async function decryptValue(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext
  const parsed = decode(ciphertext)
  if (!parsed) {
    throw new Error(`decryptValue: malformed ciphertext — expected aes-v1:<iv>:<ct>`)
  }
  const { current, previous } = await loadKeys()
  const result = await tryDecryptOne(current, parsed.iv, parsed.ct)
  if (result !== null) return result
  if (previous) {
    const prevResult = await tryDecryptOne(previous, parsed.iv, parsed.ct)
    if (prevResult !== null) return prevResult
  }
  throw new Error('decryptValue: decryption failed with all available keys')
}
