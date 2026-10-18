/**
 * Seed-level AES-256-GCM key loading and payload encoding helpers.
 *
 * @module seed/crypto/encryption-helpers
 */

export const ALGORITHM = 'AES-GCM'
export const IV_BYTES = 12
const KEY_LEN_BYTES = 32

export interface KeyPair {
  current: CryptoKey
  previous: CryptoKey | null
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Key must be hex-encoded (even length)')
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

async function importKey(hex: string): Promise<CryptoKey> {
  const bytes = hexToBytes(hex)
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new Error(
      `CREDENTIALS_MASTER_KEY must be ${KEY_LEN_BYTES} bytes (64 hex chars), got ${bytes.length}`,
    )
  }
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function loadKeys(): Promise<KeyPair> {
  const currentRaw = process.env.CREDENTIALS_MASTER_KEY
  if (!currentRaw) {
    throw new Error('CREDENTIALS_MASTER_KEY env var is required')
  }
  const current = await importKey(currentRaw)
  const prevRaw = process.env.CREDENTIALS_MASTER_KEY_PREV
  let previous: CryptoKey | null = null
  if (prevRaw) {
    try {
      previous = await importKey(prevRaw)
    } catch {
      previous = null
    }
  }
  return { current, previous }
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}

export function encode(encrypted: ArrayBuffer, iv: Uint8Array): string {
  return `aes-v1:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`
}

export function decode(stored: string): { iv: Uint8Array; ct: Uint8Array } | null {
  const parts = stored.split(':')
  if (parts.length !== 3) return null
  const [, ivB64, ctB64] = parts
  return {
    iv: fromBase64(ivB64),
    ct: fromBase64(ctB64),
  }
}

export async function tryDecryptOne(
  key: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array,
): Promise<string | null> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv as BufferSource },
      key,
      ct as unknown as BufferSource,
    )
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}
