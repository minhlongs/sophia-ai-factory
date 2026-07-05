/**
 * encryptValue / decryptValue — AES-GCM-256 credential encryption.
 *
 * Moved from tree/credentials/encryption.ts so that seed-layer modules
 * (platform-config-repo, etc.) can use crypto without crossing the
 * seed → tree boundary. Tree consumers re-export from here via
 * tree/credentials/encryption.ts.
 */

import { getActiveKeyVersion } from '@/tree/byok/byok-crypto'
import { getD1 } from '@/seed/db/client'

const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12
const KEY_LEN_BITS = 256
const KEY_LEN_BYTES = 32
const DUAL_DECRYPT_WINDOW_MS = 24 * 60 * 60 * 1000

interface KeyVersionRow {
  version: number
  encrypted_key: string
  rotated_at: string | null
  is_active: number
}

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

async function importKeyMaterial(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new Error(`Expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`)
  }
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importMasterKey(): Promise<CryptoKey> {
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
  return importKeyMaterial(raw)
}

async function loadKeyVersion(version: number): Promise<CryptoKey | null> {
  const db = getD1()
  if (!db) return null
  const row = await db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions WHERE version = ? LIMIT 1`,
    )
    .bind(version)
    .first<KeyVersionRow>()
  if (!row) return null
  try {
    return await importKeyMaterial(base64ToBytes(row.encrypted_key))
  } catch {
    return null
  }
}

async function getPreviousKeyVersion(): Promise<KeyVersionRow | null> {
  const db = getD1()
  if (!db) return null
  return db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions WHERE is_active = 0 ORDER BY version DESC LIMIT 1`,
    )
    .first<KeyVersionRow>()
}

async function canUsePreviousVersion(row: KeyVersionRow | null): Promise<boolean> {
  if (!row) return false
  if (!row.rotated_at) return false
  const rotatedAt = Date.parse(row.rotated_at)
  if (Number.isNaN(rotatedAt)) return false
  return Date.now() - rotatedAt <= DUAL_DECRYPT_WINDOW_MS
}

async function importKeyByVersion(version: number): Promise<CryptoKey> {
  const key = await loadKeyVersion(version)
  if (key) return key
  const previous = await getPreviousKeyVersion()
  if (previous && previous.version === version && (await canUsePreviousVersion(previous))) {
    const previousKey = await loadKeyVersion(version)
    if (previousKey) return previousKey
  }
  if (version === 1) return importMasterKey()
  throw new Error(
    `CREDENTIALS_DECRYPT_VERSION_UNSUPPORTED: version ${version} is outside the dual-decrypt window`,
  )
}

function parseEncryptedValue(
  encrypted: string,
): { version: number; iv: Uint8Array; ct: Uint8Array } {
  const parts = encrypted.split(':')
  let version = 1
  let ivPart: string
  let ctPart: string
  if (parts.length === 3 && parts[0].startsWith('v')) {
    version = Number(parts[0].slice(1))
    ivPart = parts[1]
    ctPart = parts[2]
  } else if (parts.length === 2) {
    ivPart = parts[0]
    ctPart = parts[1]
  } else {
    throw new Error('decryptValue: malformed -- expected <iv>:<ct> or v<version>:<iv>:<ct>')
  }
  const iv = base64ToBytes(ivPart)
  const ct = base64ToBytes(ctPart)
  if (iv.length !== IV_BYTES) throw new Error(`decryptValue: iv must be ${IV_BYTES} bytes`)
  return { version, iv, ct }
}

/**
 * Encrypt a plaintext string with optional AAD (userId) binding.
 * Returns "v<version>:<iv_b64>:<ciphertext_b64>" for storage in TEXT column.
 */
export async function encryptValue(
  plaintext: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  if (!plaintext) throw new Error('encryptValue: plaintext is empty')
  const version = keyVersion ?? (await getActiveKeyVersion())
  const key = await importKeyByVersion(version)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const pt = new TextEncoder().encode(plaintext)
  const params: AesGcmParams = userId
    ? {
        name: ALGORITHM,
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(userId) as BufferSource,
      }
    : { name: ALGORITHM, iv: iv as BufferSource }
  const ct = new Uint8Array(await crypto.subtle.encrypt(params, key, pt))
  return `v${version}:${bytesToBase64(iv)}:${bytesToBase64(ct)}`
}

/**
 * Decrypt a "v<version>:<iv_b64>:<ciphertext_b64>" string.
 * Tries AAD-bound decrypt first when userId given; falls back to legacy
 * (no-AAD) ciphertext for backward compatibility. Throws on tamper, wrong key,
 * or malformed input.
 */
export async function decryptValue(
  encrypted: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  const parsed = parseEncryptedValue(encrypted)
  const version = keyVersion ?? parsed.version
  const key = await importKeyByVersion(version)
  const ivBuf = parsed.iv as BufferSource
  const ctBuf = parsed.ct.buffer as ArrayBuffer
  if (userId) {
    try {
      const pt = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: ivBuf,
          additionalData: new TextEncoder().encode(userId) as BufferSource,
        },
        key,
        ctBuf,
      )
      return new TextDecoder().decode(pt)
    } catch {
      // fallthrough to legacy (no-AAD) decrypt
    }
  }
  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv: ivBuf }, key, ctBuf)
  return new TextDecoder().decode(pt)
}
