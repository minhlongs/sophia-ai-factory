/**
 * BYOK crypto — Phase 4G-BYOK.
 *
 * Wraps Web Crypto AES-GCM-256 for encrypting per-user provider API
 * keys at rest in D1. Cloudflare Workers-native (no SDK).
 *
 * Format: `[version (1 byte)][iv (12 bytes)][ciphertext + auth tag]`
 * packed as Uint8Array. Master key is base64-encoded 32 bytes in
 * `BYOK_MASTER_KEY` env.
 *
 * Tamper detection is guaranteed by AES-GCM's auth tag: any byte flip
 * in the stored blob causes `decrypt` to throw.
 */

import { getD1 } from '@/seed/db/client'

const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12
const VERSION_BYTES = 1
const KEY_LEN_BITS = 256
const KEY_LEN_BYTES = KEY_LEN_BITS / 8
const DUAL_DECRYPT_WINDOW_MS = 24 * 60 * 60 * 1000

interface KeyVersionRow {
  version: number
  encrypted_key: string
  rotated_at: string | null
  is_active: number
}

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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function packedToText(packed: Uint8Array): string {
  return bytesToBase64(packed)
}

function textToPacked(text: string): Uint8Array {
  return base64ToBytes(text)
}

async function importKeyMaterial(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importMasterKey(): Promise<CryptoKey> {
  const raw = process.env.BYOK_MASTER_KEY
  if (!raw) throw new ByokMissingMasterKeyError()

  let bytes: Uint8Array
  try { bytes = base64ToBytes(raw) }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ByokInvalidMasterKeyError(`not valid base64: ${msg}`)
  }
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new ByokInvalidMasterKeyError(
      `expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`,
    )
  }

  try {
    return await importKeyMaterial(bytes)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ByokInvalidMasterKeyError(`failed to import key material: ${msg}`)
  }
}

async function loadKeyVersion(version: number): Promise<CryptoKey | null> {
  const db = getD1()
  if (!db) return null

  const row = await db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions
       WHERE version = ?
       LIMIT 1`,
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

export async function getActiveKeyVersion(): Promise<number> {
  const db = getD1()
  if (!db) return 1

  const row = await db
    .prepare(
      `SELECT version
       FROM key_versions
       WHERE is_active = 1
       ORDER BY version DESC
       LIMIT 1`,
    )
    .first<{ version: number }>()

  return row?.version ?? 1
}

async function getPreviousKeyVersion(): Promise<KeyVersionRow | null> {
  const db = getD1()
  if (!db) return null

  return db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions
       WHERE is_active = 0
       ORDER BY version DESC
       LIMIT 1`,
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

  if (version === 1) return importMasterKey()

  throw new Error(`BYOK_DECRYPT_VERSION_UNSUPPORTED: version ${version} is outside the dual-decrypt window`)
}

function isDuplicateKeyVersionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /UNIQUE constraint failed: key_versions\.(key_type, version)|SQLITE_CONSTRAINT_UNIQUE/.test(msg)
}

export async function ensureKeyVersionRow(version: number): Promise<void> {
  const db = getD1()
  if (!db) return

  const existing = await db
    .prepare(
      `SELECT version
       FROM key_versions
       WHERE version = ?
       LIMIT 1`,
    )
    .bind(version)
    .first<{ version: number }>()

  if (existing) return

  const raw = process.env.BYOK_MASTER_KEY
  if (!raw) throw new ByokMissingMasterKeyError()

  let bytes: Uint8Array
  try { bytes = base64ToBytes(raw) }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ByokInvalidMasterKeyError(`not valid base64: ${msg}`)
  }
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new ByokInvalidMasterKeyError(`expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`)
  }

  try {
    await db
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, is_active)
         VALUES (?, ?, ?, 1)`,
      )
      .bind('master', version, bytesToBase64(bytes))
      .run()
  } catch (e) {
    if (!isDuplicateKeyVersionError(e)) throw e
  }
}

/**
 * Encrypt a plaintext string (typically a provider API key).
 * Returns a packed `[version][iv][ciphertext+tag]` Uint8Array ready for D1 BLOB.
 *
 * Throws `ByokMissingMasterKeyError` / `ByokInvalidMasterKeyError` if
 * BYOK_MASTER_KEY is absent or malformed.
 */
export async function encryptApiKey(
  plain: string,
  userId?: string,
  keyVersion?: number,
): Promise<Uint8Array> {
  if (!plain) throw new Error('BYOK_ENCRYPT_EMPTY: plaintext is empty')

  const version = keyVersion ?? (await getActiveKeyVersion())
  await ensureKeyVersionRow(version)

  const key = await importKeyByVersion(version)
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const pt = new TextEncoder().encode(plain)
  const params: AesGcmParams = userId
    ? {
        name: ALGORITHM,
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(userId) as BufferSource,
      }
    : { name: ALGORITHM, iv: iv as BufferSource }

  const ct = new Uint8Array(await crypto.subtle.encrypt(params, key, pt))
  const packed = new Uint8Array(VERSION_BYTES + iv.length + ct.length)
  packed[0] = version
  packed.set(iv, VERSION_BYTES)
  packed.set(ct, VERSION_BYTES + iv.length)
  return packed
}

async function decryptPackedWithKey(
  packedBytes: Uint8Array,
  key: CryptoKey,
  userId?: string,
  offset = 0,
): Promise<string> {
  const iv = packedBytes.slice(offset, offset + IV_BYTES)
  const ct = packedBytes.slice(offset + IV_BYTES)

  if (userId) {
    try {
      const pt = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv,
          additionalData: new TextEncoder().encode(userId),
        },
        key,
        ct,
      )
      return new TextDecoder().decode(pt)
    } catch {
      // fallthrough to legacy
    }
  }

  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ct)
  return new TextDecoder().decode(pt)
}

async function decryptLegacyApiKey(
  packedBytes: Uint8Array,
  userId?: string,
): Promise<string> {
  if (!packedBytes || packedBytes.length <= IV_BYTES) {
    throw new Error('BYOK_DECRYPT_MALFORMED: payload too short')
  }

  const key = await importMasterKey()
  return decryptPackedWithKey(packedBytes, key, userId)
}

/**
 * Decrypt a packed `[version][iv][ciphertext+tag]` blob. Tries AAD-bound
 * decrypt (userId) first; falls back to legacy (no-AAD) ciphertext for rows
 * written before V-2.1. Throws on tamper, wrong master key, or malformed input.
 */
export async function decryptApiKey(
  packed: Uint8Array | string,
  userId?: string,
  keyVersion?: number,
  legacyFormat = false,
): Promise<string> {
  const packedBytes = typeof packed === 'string' ? textToPacked(packed) : packed

  if (legacyFormat) {
    return decryptLegacyApiKey(packedBytes, userId)
  }

  if (!packedBytes || packedBytes.length <= VERSION_BYTES + IV_BYTES) {
    throw new Error('BYOK_DECRYPT_MALFORMED: payload too short')
  }

  const version = keyVersion ?? packedBytes[0]
  const key = await importKeyByVersion(version)
  return decryptPackedWithKey(packedBytes, key, userId, VERSION_BYTES)
}

export function encryptApiKeyText(
  plain: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  return encryptApiKey(plain, userId, keyVersion).then(packedToText)
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
