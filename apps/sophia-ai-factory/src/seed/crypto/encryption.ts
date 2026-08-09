/**
 * Platform Config Encryption
 *
 * Uses Web Crypto AES-GCM-256 (Cloudflare Workers compatible).
 * Master key: env PLATFORM_CONFIG_ENC_KEY (64 hex chars = 32 bytes).
 * Generate with: openssl rand -hex 32
 *
 * Storage format: v1:<iv_b64>:<ciphertext_b64>
 * Simple versioned format for key rotation support.
 */

const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12
const KEY_LEN_BITS = 256
const KEY_LEN_BYTES = 32

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== KEY_LEN_BYTES * 2) {
    throw new Error(
      `PLATFORM_CONFIG_ENC_KEY must be ${KEY_LEN_BYTES * 2} hex chars, got ${hex.length}`,
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

async function getKey(): Promise<CryptoKey> {
  const hexKey = process.env.PLATFORM_CONFIG_ENC_KEY
  if (!hexKey) {
    throw new Error('PLATFORM_CONFIG_ENC_KEY not set')
  }
  return importKeyMaterial(hexToBytes(hexKey))
}

function parseEncryptedValue(encrypted: string): { version: number; iv: Uint8Array; ct: Uint8Array } {
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
 * Encrypt a plaintext string for platform config storage.
 * Returns "v1:<iv_b64>:<ciphertext_b64>" for storage in TEXT column.
 */
export async function encryptPlatformConfig(
  plaintext: string,
): Promise<string> {
  if (!plaintext) throw new Error('encryptPlatformConfig: plaintext is empty')
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const pt = new TextEncoder().encode(plaintext)
  const params: AesGcmParams = { name: ALGORITHM, iv: iv as BufferSource }
  const ct = new Uint8Array(await crypto.subtle.encrypt(params, key, pt))
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(ct)}`
}

/**
 * Decrypt a platform config value.
 * Handles "v1:<iv>:<ct>" format.
 */
export async function decryptPlatformConfig(
  encrypted: string,
): Promise<string> {
  const parsed = parseEncryptedValue(encrypted)
  const key = await getKey()
  const ivBuf = parsed.iv as BufferSource
  const ctBuf = parsed.ct.buffer as ArrayBuffer

  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv: ivBuf }, key, ctBuf)
  return new TextDecoder().decode(pt)
}